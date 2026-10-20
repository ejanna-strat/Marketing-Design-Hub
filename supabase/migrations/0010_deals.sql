-- Owner requests, Oct 20:
--   * Deal association: "Associated with a deal?" with Deal Name and Deal Size
--     (whole pesos), filled in on the request form and editable by staff.
--   * For revision also needs a Link to Output.
--   * Return only before a designer is assigned.
-- The functions below are the latest versions (0006/0008/0009) with those
-- changes.

alter table public.requests
  add column is_deal boolean not null default false,
  add column deal_name text,
  add column deal_size bigint check (deal_size is null or deal_size >= 0),
  add constraint requests_deal_complete check (not is_deal or (deal_name is not null and deal_size is not null));
create index requests_is_deal_idx on public.requests (is_deal) where is_deal;

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
  approver_name text;
  approver_email text;
  is_deal boolean := coalesce((payload ->> 'is_deal')::boolean, false);
  deal_name text;
  deal_size bigint;
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
  if req_date is null then raise exception 'Please choose the date needed.'; end if;
  if req_date < today and req_date is distinct from keep_date then
    raise exception 'The date needed cannot be in the past.';
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
    'approver_name', approver_name,
    'approver_email', approver_email,
    'output_needed', output_needed,
    'is_deal', is_deal,
    'deal_name', deal_name,
    'deal_size', deal_size,
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

  c := public.clean_request_payload(payload, req_type.id);

  insert into public.requests (
    title, requester_id, requester_name, requester_email, team_id, request_type_id,
    output_needed, date_needed, final_approver_name, final_approver_email,
    is_deal, deal_name, deal_size
  ) values (
    c ->> 'title', uid, c ->> 'requester_name', (select email from public.profiles where id = uid),
    (c ->> 'team_id')::uuid, req_type.id, c ->> 'output_needed', (c ->> 'date_needed')::date,
    c ->> 'approver_name', c ->> 'approver_email',
    (c ->> 'is_deal')::boolean, c ->> 'deal_name', (c ->> 'deal_size')::bigint
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

  c := public.clean_request_payload(payload, r.request_type_id, r.date_needed);

  -- Lets the column guard know this change comes from the requester's edit.
  perform set_config('app.requester_edit', 'on', true);
  update public.requests set
    requester_name = c ->> 'requester_name',
    title = c ->> 'title',
    team_id = (c ->> 'team_id')::uuid,
    date_needed = (c ->> 'date_needed')::date,
    final_approver_name = c ->> 'approver_name',
    final_approver_email = c ->> 'approver_email',
    output_needed = c ->> 'output_needed',
    is_deal = (c ->> 'is_deal')::boolean,
    deal_name = c ->> 'deal_name',
    deal_size = (c ->> 'deal_size')::bigint
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

create or replace function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  staff_editable text[] := array[
    'status', 'link_to_output', 'updated_at', 'output_needed',
    'title', 'requester_name', 'team_id', 'date_needed', 'final_approver_name', 'final_approver_email',
    'is_deal', 'deal_name', 'deal_size'
  ];
  requester_edit boolean := coalesce(current_setting('app.requester_edit', true), '') = 'on'
    and actor is not null and actor = old.requester_id;
  -- Set by designer_respond() / return_request(), which do their own checks.
  workflow boolean := coalesce(current_setting('app.workflow', true), '') = 'on';
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

  if actor is not null then
    new.date_started := old.date_started;
    new.date_completed := old.date_completed;

    if requester_edit then
      new.status := old.status;
      new.assigned_designer_id := old.assigned_designer_id;
      new.link_to_output := old.link_to_output;
      new.return_reason := old.return_reason;
      new.reassign_reason := old.reassign_reason;
      new.designer_response := old.designer_response;
      new.designer_responded_at := old.designer_responded_at;
      new.returned_by := old.returned_by;
    elsif not workflow then
      if not public.is_manager() then
        if new.assigned_designer_id is distinct from old.assigned_designer_id then
          raise exception 'Only Admins and Lead Designers can assign designers.' using errcode = '42501';
        end if;
        if (to_jsonb(new) - staff_editable) is distinct from (to_jsonb(old) - staff_editable) then
          raise exception 'That field can''t be changed here.' using errcode = '42501';
        end if;
      end if;
      -- Only the designer's Accept sets "Designer assigned (not yet started)",
      -- and Returned only comes from return_request() (with a reason).
      if new.status is distinct from old.status and new.status = 'designer_assigned' then
        raise exception 'This status is set automatically when the designer accepts.' using errcode = '42501';
      end if;
      if new.status is distinct from old.status and new.status = 'rejected' then
        raise exception 'Please use Return (with a reason) to return a request.' using errcode = '42501';
      end if;
      new.designer_response := old.designer_response;
      new.designer_responded_at := old.designer_responded_at;
      new.returned_by := old.returned_by;
      new.return_reason := old.return_reason;
    end if;
  end if;

  -- The designer can't change once the request is Completed.
  if new.assigned_designer_id is distinct from old.assigned_designer_id and old.status = 'completed' then
    raise exception 'This request is Completed, so the designer can''t be changed.' using errcode = '42501';
  end if;

  -- Designer changes: a new designer must respond; removing the designer
  -- sends the request back to New request.
  if new.assigned_designer_id is distinct from old.assigned_designer_id then
    if new.assigned_designer_id is null then
      new.designer_response := null;
      new.designer_responded_at := null;
      if new.status = old.status and old.status <> 'new_request' then
        new.status := 'new_request';
        auto_note := 'Automatic: designer removed';
      end if;
    else
      new.designer_response := 'pending';
      new.designer_responded_at := null;
    end if;
  end if;

  -- Work statuses need a designer; review and completion need the output link.
  if new.status is distinct from old.status then
    if new.assigned_designer_id is null
       and new.status in ('designer_assigned', 'in_progress', 'for_review', 'for_revision', 'completed') then
      raise exception 'Please assign a designer before setting this status.' using errcode = '42501';
    end if;
    if new.status in ('for_review', 'for_revision', 'completed') and nullif(trim(coalesce(new.link_to_output, '')), '') is null then
      raise exception 'Please add the Link to Output before setting this status.' using errcode = '42501';
    end if;
  end if;

  new.link_to_output := nullif(trim(new.link_to_output), '');
  new.updated_at := now();

  if new.assigned_designer_id is distinct from old.assigned_designer_id then
    select display_name into old_text from public.designers where id = old.assigned_designer_id;
    select display_name into new_text from public.designers where id = new.assigned_designer_id;
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'designer', old_text, new_text);
  end if;

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

  if new.output_needed is distinct from old.output_needed then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'output_needed', old.output_needed, new.output_needed);
  end if;

  return new;
end;
$$;

create or replace function public.return_request(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  reason text := trim(coalesce(p_reason, ''));
begin
  if not public.is_manager() then
    raise exception 'Only Admins and Lead Designers can return requests.' using errcode = '42501';
  end if;
  if reason = '' then raise exception 'Please give the reason for returning the request.'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'new_request' then
    raise exception 'Only new requests can be returned.';
  end if;
  if r.assigned_designer_id is not null then
    raise exception 'A designer is already assigned, so this request can''t be returned. Remove the designer first.';
  end if;

  perform set_config('app.workflow', 'on', true);
  update public.requests set
    status = 'rejected',
    return_reason = reason,
    returned_by = auth.uid(),
    assigned_designer_id = null,
    designer_response = null,
    designer_responded_at = null
  where id = r.id;
  perform set_config('app.workflow', 'off', true);

  insert into public.activity_log (request_id, actor_id, action, note)
  values (r.id, auth.uid(), 'returned', reason);
  return jsonb_build_object('id', r.id, 'request_code', r.request_code);
end;
$$;
