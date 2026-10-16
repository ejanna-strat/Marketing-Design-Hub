-- Requesters can edit their own request until it is accepted (status still
-- "New request" and no designer assigned). Also makes three spec questions
-- required (owner request, Oct 16: requesters can type N/A).

-- ---------------------------------------------------------------------------
-- Required questions
-- ---------------------------------------------------------------------------

update public.form_questions set required = true
where label in ('Mandatory graphics', 'Design pegs/graphics', 'Other important information');

-- ---------------------------------------------------------------------------
-- Shared checks for submit and edit. Returns the cleaned values:
--   { requester_name, title, team_id, date_needed, approver_name,
--     approver_email, output_needed, answers }
-- keep_date: a Date Needed that is allowed even if it's now in the past
-- (the request's current date, when editing).
-- ---------------------------------------------------------------------------

create function public.clean_request_payload(payload jsonb, req_type_id uuid, keep_date date default null)
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
    'answers', clean
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit (same behaviour as 0001, now using the shared checks)
-- ---------------------------------------------------------------------------

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
    output_needed, date_needed, final_approver_name, final_approver_email
  ) values (
    c ->> 'title', uid, c ->> 'requester_name', (select email from public.profiles where id = uid),
    (c ->> 'team_id')::uuid, req_type.id, c ->> 'output_needed', (c ->> 'date_needed')::date,
    c ->> 'approver_name', c ->> 'approver_email'
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

-- ---------------------------------------------------------------------------
-- Edit: the requester's own request, only while it is not yet accepted.
-- The type of request can't change.
-- ---------------------------------------------------------------------------

create function public.update_request(p_request_id uuid, payload jsonb)
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
    output_needed = c ->> 'output_needed'
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

-- ---------------------------------------------------------------------------
-- Column guard: also allow the requester's own edit (via update_request).
-- Same as 0005 otherwise.
-- ---------------------------------------------------------------------------

create or replace function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  designer_editable text[] := array['status', 'link_to_output', 'updated_at'];
  requester_edit boolean := coalesce(current_setting('app.requester_edit', true), '') = 'on'
    and actor is not null and actor = old.requester_id;
  old_designer text;
  new_designer text;
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
      -- The requester may change request details, never pipeline fields.
      new.status := old.status;
      new.assigned_designer_id := old.assigned_designer_id;
      new.link_to_output := old.link_to_output;
      new.return_reason := old.return_reason;
      new.reassign_reason := old.reassign_reason;
    elsif not public.is_manager()
       and (to_jsonb(new) - designer_editable) is distinct from (to_jsonb(old) - designer_editable) then
      raise exception 'Designers can only change Status and Link to Output.'
        using errcode = '42501';
    end if;
  end if;

  new.link_to_output := nullif(trim(new.link_to_output), '');
  new.updated_at := now();

  if new.status is distinct from old.status then
    if new.status = 'in_progress' and old.date_started is null then
      new.date_started := now();
    end if;
    if new.status = 'completed' then
      new.date_completed := now();
    end if;
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'status', old.status::text, new.status::text);
  end if;

  if new.assigned_designer_id is distinct from old.assigned_designer_id then
    select display_name into old_designer from public.designers where id = old.assigned_designer_id;
    select display_name into new_designer from public.designers where id = new.assigned_designer_id;
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'designer', old_designer, new_designer);
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

  return new;
end;
$$;

revoke execute on function public.clean_request_payload(jsonb, uuid, date) from public, anon, authenticated;
revoke execute on function public.update_request(uuid, jsonb) from public, anon;
grant execute on function public.update_request(uuid, jsonb) to authenticated;
