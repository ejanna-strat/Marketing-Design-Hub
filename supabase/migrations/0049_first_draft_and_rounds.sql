-- Owner, Nov 26:
-- 1. Review rounds: For review – 1st draft (for_review) → For revision → V2 →
--    For revision → V3 → Completed. V3 is the last round: from V3 only
--    Completed, On hold or Cancelled. Rounds can't be skipped; going back to
--    an earlier round is a correction only Super Admins / Lead Designers make.
-- 2. First Draft Deadline (`first_draft_due`), required on new requests, on or
--    before the Final Deadline (`date_needed`, shown as "Final Deadline").
-- 3. For Analytics: `first_draft_at` (first time sent as 1st draft) and
--    `review_round` (the latest review round: 0 none, 1–3).

alter table public.requests
  add column first_draft_due date,
  add column first_draft_at timestamptz,
  add column review_round smallint not null default 0 check (review_round between 0 and 3);

-- Requests already sent for review: round 1, from their first For review.
-- Triggers off so updated_at and the activity log stay as they were.
alter table public.requests disable trigger user;
update public.requests r set
  review_round = 1,
  first_draft_at = l.first_at
from (select request_id, min(created_at) first_at from public.activity_log
      where action = 'status' and to_value = 'for_review' group by request_id) l
where r.id = l.request_id;
alter table public.requests enable trigger user;

-- Review rounds, the First Draft Deadline check and its log entry. Runs after
-- requests_before_update (trigger names run in alphabetical order).
create or replace function public.requests_review_rounds()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  stage int;
  workflow boolean := coalesce(current_setting('app.workflow', true), '') = 'on';
begin
  -- Only this trigger moves these two.
  new.review_round := old.review_round;
  new.first_draft_at := old.first_draft_at;

  if (new.first_draft_due is distinct from old.first_draft_due or new.date_needed is distinct from old.date_needed)
     and new.first_draft_due is not null and new.first_draft_due > new.date_needed then
    raise exception 'The First Draft Deadline must be on or before the Final Deadline.';
  end if;
  if new.first_draft_due is distinct from old.first_draft_due then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, auth.uid(), 'first_draft_due', old.first_draft_due::text, new.first_draft_due::text);
  end if;

  if new.status is distinct from old.status then
    stage := case new.status::text
      when 'for_review' then 1 when 'for_review_v2' then 2 when 'for_review_v3' then 3 end;
    if stage is not null then
      if stage > old.review_round + 1 then
        raise exception '%', case stage
          when 2 then 'Please send the 1st draft for review first.'
          else 'Please send V2 for review first.' end
          using errcode = '42501';
      end if;
      if stage < old.review_round and not workflow and not public.is_manager() then
        raise exception 'This request is already past that review round. A Lead Designer can correct it.'
          using errcode = '42501';
      end if;
      new.review_round := stage;
      if stage = 1 and old.first_draft_at is null then
        new.first_draft_at := now();
      end if;
    elsif old.review_round >= 3 and new.status in ('in_progress', 'for_revision') and not workflow then
      raise exception 'V3 is the last review round. From here the request can only be Completed, put On hold or cancelled.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger requests_review_rounds
  before update on public.requests
  for each row execute function public.requests_review_rounds();

-- Work statuses need an accepted designer: the two new review rounds too.
create or replace function public.requests_require_acceptance()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('in_progress', 'for_review', 'for_review_v2', 'for_review_v3', 'for_revision', 'completed')
     and new.designer_response is distinct from 'accepted' then
    raise exception 'The assigned designer needs to accept the request first.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Cancelled / Returned requests: the First Draft Deadline is locked too.
create or replace function public.requests_lock_closed()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status in ('cancelled', 'rejected')
     and (new.title, new.requester_name, new.team_id, new.date_needed, new.final_approver_name,
          new.final_approver_email, new.is_deal, new.deal_name, new.deal_size, new.output_needed,
          new.project_overview, new.first_draft_due)
         is distinct from
         (old.title, old.requester_name, old.team_id, old.date_needed, old.final_approver_name,
          old.final_approver_email, old.is_deal, old.deal_name, old.deal_size, old.output_needed,
          old.project_overview, old.first_draft_due) then
    raise exception 'This request is Cancelled or Returned, so its details can''t be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The column guard: the team can edit the First Draft Deadline; the new
-- review rounds need a designer and a Link to Output like For review.
create or replace function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  staff_editable text[] := array[
    'status', 'link_to_output', 'updated_at', 'output_needed',
    'title', 'requester_name', 'team_id', 'date_needed', 'final_approver_name', 'final_approver_email',
    'is_deal', 'deal_name', 'deal_size', 'project_overview',
    'link_to_output_2', 'link_to_output_3', 'link_label_1', 'link_label_2', 'link_label_3',
    'first_draft_due'
  ];
  has_link boolean;
  requester_edit boolean := coalesce(current_setting('app.requester_edit', true), '') = 'on'
    and actor is not null and actor = old.requester_id;
  -- Set by designer_respond() / return_request() etc., which do their own checks.
  workflow boolean := coalesce(current_setting('app.workflow', true), '') = 'on';
  -- Set by sync_request_designers() only.
  designer_sync boolean := coalesce(current_setting('app.designer_sync', true), '') = 'on';
  old_text text;
  new_text text;
  auto_note text;
begin
  if new.request_type_id is distinct from old.request_type_id then
    raise exception 'The type of request cannot be changed. Please submit a new request instead.'
      using errcode = '42501';
  end if;
  if new.id is distinct from old.id
     or new.request_code is distinct from old.request_code
     or new.requester_id is distinct from old.requester_id
     or new.created_at is distinct from old.created_at then
    raise exception 'This field cannot be changed.' using errcode = '42501';
  end if;

  if not designer_sync
     and (new.assigned_designer_id, new.designer_ids, new.designer_response, new.designer_responded_at,
          new.accepted_notice_at, new.designer_change_pending)
         is distinct from
         (old.assigned_designer_id, old.designer_ids, old.designer_response, old.designer_responded_at,
          old.accepted_notice_at, old.designer_change_pending) then
    raise exception 'Designers are added and removed with the Designers field on the request.'
      using errcode = '42501';
  end if;

  if actor is not null then
    new.date_started := old.date_started;
    new.date_completed := old.date_completed;

    if requester_edit then
      new.status := old.status;
      new.link_to_output := old.link_to_output;
      new.link_to_output_2 := old.link_to_output_2;
      new.link_to_output_3 := old.link_to_output_3;
      new.link_label_1 := old.link_label_1;
      new.link_label_2 := old.link_label_2;
      new.link_label_3 := old.link_label_3;
      new.return_reason := old.return_reason;
      new.reassign_reason := old.reassign_reason;
      new.returned_by := old.returned_by;
    elsif not workflow then
      if not public.is_manager() then
        if (to_jsonb(new) - staff_editable) is distinct from (to_jsonb(old) - staff_editable) then
          raise exception 'That field can''t be changed here.' using errcode = '42501';
        end if;
        -- A designer on the request who hasn't accepted yet (owner, Nov 12).
        if (new.status, new.link_to_output, new.link_to_output_2, new.link_to_output_3,
            new.link_label_1, new.link_label_2, new.link_label_3)
           is distinct from
           (old.status, old.link_to_output, old.link_to_output_2, old.link_to_output_3,
            old.link_label_1, old.link_label_2, old.link_label_3)
           and exists (
             select 1 from public.request_designers rd join public.designers d on d.id = rd.designer_id
             where rd.request_id = old.id and d.user_id = actor and rd.response = 'pending'
           ) then
          raise exception 'Please accept the request first; then you can change its status and links.'
            using errcode = '42501';
        end if;
      end if;
      -- Only a designer's Accept sets "Designer assigned (not yet started)",
      -- and Returned only comes from return_request() (with a reason).
      if new.status is distinct from old.status and new.status = 'designer_assigned' then
        raise exception 'This status is set automatically when the designer accepts.' using errcode = '42501';
      end if;
      if new.status is distinct from old.status and new.status = 'rejected' then
        raise exception 'Please use Return (with a reason) to return a request.' using errcode = '42501';
      end if;
      new.returned_by := old.returned_by;
      new.return_reason := old.return_reason;
    end if;
  end if;

  -- Cancelled and Returned requests are closed: no designer or link changes.
  if old.status in ('cancelled', 'rejected')
     and (new.designer_ids is distinct from old.designer_ids
          or nullif(trim(coalesce(new.link_to_output, '')), '') is distinct from old.link_to_output
          or nullif(trim(coalesce(new.link_to_output_2, '')), '') is distinct from old.link_to_output_2
          or nullif(trim(coalesce(new.link_to_output_3, '')), '') is distinct from old.link_to_output_3) then
    raise exception 'This request is Cancelled or Returned, so the designer and Link to Output can''t be changed.'
      using errcode = '42501';
  end if;

  -- The designers can't change once the request is Completed.
  if new.designer_ids is distinct from old.designer_ids and old.status = 'completed' then
    raise exception 'This request is Completed, so the designer can''t be changed.' using errcode = '42501';
  end if;

  if designer_sync then
    auto_note := nullif(current_setting('app.status_note', true), '');
  end if;

  -- Work statuses need a designer; review and completion need an output link
  -- (any one of the three, owner Nov 4).
  has_link := coalesce(nullif(trim(coalesce(new.link_to_output, '')), ''),
                       nullif(trim(coalesce(new.link_to_output_2, '')), ''),
                       nullif(trim(coalesce(new.link_to_output_3, '')), '')) is not null;
  if new.status is distinct from old.status then
    if new.assigned_designer_id is null
       and new.status in ('designer_assigned', 'in_progress', 'for_review', 'for_review_v2', 'for_review_v3',
                          'for_revision', 'completed') then
      raise exception 'Please assign a designer before setting this status.' using errcode = '42501';
    end if;
    if new.status = 'new_request' and new.assigned_designer_id is not null and new.designer_response = 'accepted' then
      raise exception 'The designer already accepted this request, so it can''t go back to New request.'
        using errcode = '42501';
    end if;
    if new.status in ('for_review', 'for_review_v2', 'for_review_v3', 'for_revision', 'completed') and not has_link then
      raise exception 'Please add the Link to Output before setting this status.' using errcode = '42501';
    end if;
  end if;

  new.link_to_output := nullif(trim(new.link_to_output), '');
  new.link_to_output_2 := nullif(trim(new.link_to_output_2), '');
  new.link_to_output_3 := nullif(trim(new.link_to_output_3), '');
  new.link_label_1 := nullif(trim(new.link_label_1), '');
  new.link_label_2 := nullif(trim(new.link_label_2), '');
  new.link_label_3 := nullif(trim(new.link_label_3), '');
  new.updated_at := now();

  if new.status is distinct from old.status then
    if new.status = 'in_progress' and old.date_started is null then
      new.date_started := now();
    end if;
    if new.status = 'completed' then
      new.date_completed := now();
    end if;
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value, note)
    values (new.id, actor, 'status', old.status::text, new.status::text, auto_note);
  end if;

  if new.link_to_output is distinct from old.link_to_output then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'link_to_output', old.link_to_output, new.link_to_output);
  end if;

  if new.link_to_output_2 is distinct from old.link_to_output_2 then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'link_to_output_2', old.link_to_output_2, new.link_to_output_2);
  end if;

  if new.link_to_output_3 is distinct from old.link_to_output_3 then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'link_to_output_3', old.link_to_output_3, new.link_to_output_3);
  end if;

  if new.date_needed is distinct from old.date_needed then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'date_needed', old.date_needed::text, new.date_needed::text);
  end if;

  if new.title is distinct from old.title then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'title', old.title, new.title);
  end if;

  if new.requester_name is distinct from old.requester_name then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'requester_name', old.requester_name, new.requester_name);
  end if;

  if new.team_id is distinct from old.team_id then
    select name into old_text from public.teams where id = old.team_id;
    select name into new_text from public.teams where id = new.team_id;
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'team', old_text, new_text);
  end if;

  if new.final_approver_name is distinct from old.final_approver_name
     or new.final_approver_email is distinct from old.final_approver_email then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'final_approver',
            old.final_approver_name || ' · ' || old.final_approver_email,
            new.final_approver_name || ' · ' || new.final_approver_email);
  end if;

  if new.is_deal is distinct from old.is_deal
     or new.deal_name is distinct from old.deal_name
     or new.deal_size is distinct from old.deal_size then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'deal',
            case when old.is_deal then old.deal_name || ' · ₱' || old.deal_size else 'Not a deal' end,
            case when new.is_deal then new.deal_name || ' · ₱' || new.deal_size else 'Not a deal' end);
  end if;

  if new.project_overview is distinct from old.project_overview then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'project_overview', old.project_overview, new.project_overview);
  end if;

  if new.output_needed is distinct from old.output_needed then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'output_needed', old.output_needed, new.output_needed);
  end if;

  return new;
end;
$$;

-- The form's checks: First Draft Deadline required (not in the past, on or
-- before the Final Deadline). Staff spec edits of older requests pass
-- require_first_draft = false; an edit keeps a past date it already had
-- (keep_first_draft, set by the calling function, never by the browser).
create or replace function public.clean_request_payload(payload jsonb, req_type_id uuid, keep_date date default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.profiles;
  req_team uuid;
  req_title text := trim(coalesce(payload ->> 'title', ''));
  req_name text := trim(coalesce(payload ->> 'requester_name', ''));
  req_date date;
  req_first date;
  approver_name text;
  approver_email text;
  is_deal boolean := coalesce((payload ->> 'is_deal')::boolean, false);
  deal_name text;
  deal_size bigint;
  -- General Information for every type (owner, Oct 22).
  overview text := trim(coalesce(payload ->> 'project_overview', ''));
  answers jsonb := coalesce(payload -> 'answers', '{}'::jsonb);
  clean jsonb := '{}'::jsonb;
  output_needed text := 'Others';
  q public.form_questions;
  v jsonb;
  item text;
  is_empty boolean;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  if uid is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  select * into me from public.profiles where id = uid;
  if not found then
    raise exception 'Your profile was not found. Please sign out and sign in again.';
  end if;

  if req_name = '' then raise exception 'Please enter your name.'; end if;
  if req_title = '' then raise exception 'Please enter a request title.'; end if;

  select id into req_team from public.teams
  where id = nullif(payload ->> 'team_id', '')::uuid and active;
  if req_team is null then raise exception 'Please choose your business unit.'; end if;

  req_date := nullif(payload ->> 'date_needed', '')::date;
  if req_date is null then raise exception 'Please choose the Final Deadline.'; end if;
  if req_date < today and req_date is distinct from keep_date then
    raise exception 'The Final Deadline cannot be in the past.';
  end if;

  req_first := nullif(payload ->> 'first_draft_due', '')::date;
  if req_first is null then
    if coalesce((payload ->> 'require_first_draft')::boolean, true) then
      raise exception 'Please choose the First Draft Deadline.';
    end if;
  else
    if req_first < today and req_first is distinct from nullif(payload ->> 'keep_first_draft', '')::date then
      raise exception 'The First Draft Deadline cannot be in the past.';
    end if;
    if req_first > req_date then
      raise exception 'The First Draft Deadline must be on or before the Final Deadline.';
    end if;
  end if;

  if payload ->> 'final_approver' = 'myself' then
    approver_name := req_name;
    approver_email := me.email;
  elsif payload ->> 'final_approver' = 'other' then
    approver_name := trim(coalesce(payload ->> 'approver_name', ''));
    approver_email := lower(trim(coalesce(payload ->> 'approver_email', '')));
    if approver_name = '' then raise exception 'Please enter the approver''s name.'; end if;
    if approver_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Please enter a valid approver email.';
    end if;
  else
    raise exception 'Please choose the final approver of the design.';
  end if;

  -- Required when filing or editing; staff spec edits of older requests
  -- (which may not have one) pass require_overview = false.
  if overview = '' and coalesce((payload ->> 'require_overview')::boolean, true) then
    raise exception 'Please answer: Project Overview and Objective';
  end if;
  if length(overview) > 5000 then
    raise exception 'Please keep the Project Overview and Objective under 5,000 characters.';
  end if;

  -- Deal (owner, Oct 20): name and whole-peso size required when ticked.
  if is_deal then
    deal_name := trim(coalesce(payload ->> 'deal_name', ''));
    if deal_name = '' then raise exception 'Please enter the deal name.'; end if;
    if coalesce(payload ->> 'deal_size', '') !~ '^\d{1,15}$' then
      raise exception 'Please enter the deal size in whole pesos.';
    end if;
    deal_size := (payload ->> 'deal_size')::bigint;
  end if;

  if jsonb_typeof(answers) <> 'object' then
    raise exception 'The answers could not be read. Please try again.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(answers) as k
    where not exists (
      select 1 from public.form_questions fq
      where fq.id::text = k and fq.request_type_id = req_type_id and fq.active
    )
  ) then
    raise exception 'Some answers do not match this type of request. Please reload the form.';
  end if;

  for q in
    select * from public.form_questions
    where request_type_id = req_type_id and active
    order by sort_order
  loop
    v := answers -> q.id::text;
    is_empty := v is null
      or jsonb_typeof(v) = 'null'
      or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '')
      or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0);

    if is_empty then
      if q.required then raise exception 'Please answer: %', q.label; end if;
      continue;
    end if;

    if q.field_type = 'multi_select' then
      if jsonb_typeof(v) <> 'array' then raise exception 'Please check your answer to: %', q.label; end if;
      for item in select jsonb_array_elements_text(v) loop
        if not (q.options ? item or (q.allow_other and item ~ '^Other: \S')) then
          raise exception 'Please check your answer to: %', q.label;
        end if;
      end loop;
    else
      if jsonb_typeof(v) <> 'string' then raise exception 'Please check your answer to: %', q.label; end if;
      v := to_jsonb(trim(v #>> '{}'));
      if q.field_type = 'single_select'
         and not (q.options ? (v #>> '{}') or (q.allow_other and (v #>> '{}') ~ '^Other: \S')) then
        raise exception 'Please check your answer to: %', q.label;
      end if;
    end if;

    if q.is_output_needed then
      output_needed := case jsonb_typeof(v)
        when 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(v) as x)
        else v #>> '{}'
      end;
    end if;

    clean := clean || jsonb_build_object(q.id::text, v);
  end loop;

  return jsonb_build_object(
    'requester_name', req_name,
    'title', req_title,
    'team_id', req_team,
    'date_needed', req_date,
    'first_draft_due', req_first,
    'approver_name', approver_name,
    'approver_email', approver_email,
    'output_needed', output_needed,
    'is_deal', is_deal,
    'deal_name', deal_name,
    'deal_size', deal_size,
    'project_overview', nullif(overview, ''),
    'answers', clean
  );
end;
$$;

create or replace function public.submit_request(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  req_type public.request_types;
  c jsonb;
  new_id uuid;
  new_code text;
begin
  if uid is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  select * into req_type from public.request_types
  where id = nullif(payload ->> 'request_type_id', '')::uuid and active;
  if not found then raise exception 'Please choose a type of design request.'; end if;

  -- New requests always need the First Draft Deadline.
  c := public.clean_request_payload(payload - 'require_first_draft' - 'keep_first_draft', req_type.id);

  insert into public.requests (
    title, requester_id, requester_name, requester_email, team_id, request_type_id,
    output_needed, date_needed, first_draft_due, final_approver_name, final_approver_email,
    is_deal, deal_name, deal_size, project_overview
  ) values (
    c ->> 'title', uid, c ->> 'requester_name', (select email from public.profiles where id = uid),
    (c ->> 'team_id')::uuid, req_type.id, c ->> 'output_needed', (c ->> 'date_needed')::date,
    (c ->> 'first_draft_due')::date,
    c ->> 'approver_name', c ->> 'approver_email',
    (c ->> 'is_deal')::boolean, c ->> 'deal_name', (c ->> 'deal_size')::bigint, c ->> 'project_overview'
  )
  returning id, request_code into new_id, new_code;

  insert into public.request_answers (request_id, question_id, question_label_snapshot, value)
  select new_id, fq.id, fq.label, a.value
  from jsonb_each(c -> 'answers') as a
  join public.form_questions fq on fq.id::text = a.key;

  insert into public.activity_log (request_id, actor_id, action, to_value)
  values (new_id, uid, 'created', 'new_request');

  update public.profiles set team_id = (c ->> 'team_id')::uuid where id = uid;

  return jsonb_build_object('id', new_id, 'request_code', new_code);
end;
$$;

create or replace function public.update_request(p_request_id uuid, payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.requests;
  c jsonb;
begin
  if uid is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.requester_id <> uid then
    raise exception 'Request not found.';
  end if;
  if r.status <> 'new_request' or r.assigned_designer_id is not null then
    raise exception 'This request has already been accepted, so it can no longer be edited. Please contact the Design team for changes.';
  end if;

  c := public.clean_request_payload(
    (payload - 'require_first_draft') || jsonb_build_object('keep_first_draft', r.first_draft_due),
    r.request_type_id,
    r.date_needed
  );

  -- Lets the column guard know this change comes from the requester's edit.
  perform set_config('app.requester_edit', 'on', true);
  update public.requests set
    requester_name = c ->> 'requester_name',
    title = c ->> 'title',
    team_id = (c ->> 'team_id')::uuid,
    date_needed = (c ->> 'date_needed')::date,
    first_draft_due = (c ->> 'first_draft_due')::date,
    final_approver_name = c ->> 'approver_name',
    final_approver_email = c ->> 'approver_email',
    output_needed = c ->> 'output_needed',
    is_deal = (c ->> 'is_deal')::boolean,
    deal_name = c ->> 'deal_name',
    deal_size = (c ->> 'deal_size')::bigint,
    project_overview = c ->> 'project_overview'
  where id = r.id;
  perform set_config('app.requester_edit', 'off', true);

  delete from public.request_answers where request_answers.request_id = r.id;
  insert into public.request_answers (request_id, question_id, question_label_snapshot, value)
  select r.id, fq.id, fq.label, a.value
  from jsonb_each(c -> 'answers') as a
  join public.form_questions fq on fq.id::text = a.key;

  insert into public.activity_log (request_id, actor_id, action, note)
  values (r.id, uid, 'edited', 'Updated the request details');

  update public.profiles set team_id = (c ->> 'team_id')::uuid where id = uid;

  return jsonb_build_object('id', r.id, 'request_code', r.request_code);
end;
$$;

create or replace function public.update_request_specs(p_request_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  c jsonb;
begin
  if not public.is_staff() then
    raise exception 'Only the Marketing team can change specifications.' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;

  -- Re-use the submit checks with the request's current general details.
  c := public.clean_request_payload(
    jsonb_build_object(
      'requester_name', r.requester_name, 'title', r.title, 'team_id', r.team_id,
      'date_needed', r.date_needed::text, 'final_approver', 'other',
      'approver_name', r.final_approver_name, 'approver_email', r.final_approver_email,
      'is_deal', r.is_deal, 'deal_name', r.deal_name, 'deal_size', r.deal_size::text,
      'project_overview', r.project_overview, 'require_overview', false,
      'first_draft_due', r.first_draft_due::text, 'keep_first_draft', r.first_draft_due::text,
      'require_first_draft', false,
      'answers', coalesce(p_answers, '{}'::jsonb)
    ),
    r.request_type_id,
    r.date_needed
  );

  update public.requests set output_needed = c ->> 'output_needed' where id = r.id;

  delete from public.request_answers where request_answers.request_id = r.id;
  insert into public.request_answers (request_id, question_id, question_label_snapshot, value)
  select r.id, fq.id, fq.label, a.value
  from jsonb_each(c -> 'answers') as a
  join public.form_questions fq on fq.id::text = a.key;

  insert into public.activity_log (request_id, actor_id, action, note)
  values (r.id, auth.uid(), 'specs', 'Updated the request specifications');

  return jsonb_build_object('id', r.id, 'request_code', r.request_code);
end;
$$;
