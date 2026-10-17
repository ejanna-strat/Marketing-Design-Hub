-- Owner requests, Oct 18:
--   * Marketing team members can edit a request's specification answers
--     (and so Output Needed); the type of request still can't change.
--   * In progress / For requester's review / For revision / Completed need an
--     assigned designer first.
--   * Feedback (§9, pulled forward from Phase 3): one rating per Completed
--     request, from its requester.

-- ---------------------------------------------------------------------------
-- Request updates: column guard, automatic status, designer rule, log.
-- Same as 0007 plus: output_needed is staff-editable, and the designer rule.
-- ---------------------------------------------------------------------------

create or replace function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  staff_editable text[] := array[
    'status', 'link_to_output', 'updated_at', 'output_needed',
    'title', 'requester_name', 'team_id', 'date_needed', 'final_approver_name', 'final_approver_email'
  ];
  requester_edit boolean := coalesce(current_setting('app.requester_edit', true), '') = 'on'
    and actor is not null and actor = old.requester_id;
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
    elsif not public.is_manager() then
      if new.assigned_designer_id is distinct from old.assigned_designer_id then
        raise exception 'Only Admins and Lead Designers can assign designers.' using errcode = '42501';
      end if;
      if (to_jsonb(new) - staff_editable) is distinct from (to_jsonb(old) - staff_editable) then
        raise exception 'That field can''t be changed here.' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Automatic status when the designer changes.
  if new.assigned_designer_id is distinct from old.assigned_designer_id and new.status = old.status then
    if new.assigned_designer_id is null then
      new.status := 'new_request';
      auto_note := 'Automatic: designer removed';
    elsif old.assigned_designer_id is null and old.status = 'new_request' then
      new.status := 'designer_assigned';
      auto_note := 'Automatic: designer assigned';
    end if;
  end if;

  -- Work statuses need a designer.
  if new.status is distinct from old.status and new.assigned_designer_id is null
     and new.status in ('in_progress', 'for_review', 'for_revision', 'completed') then
    raise exception 'Please assign a designer before setting this status.' using errcode = '42501';
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

  if new.output_needed is distinct from old.output_needed then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'output_needed', old.output_needed, new.output_needed);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff edit of specification answers (same checks as submitting).
-- ---------------------------------------------------------------------------

create function public.update_request_specs(p_request_id uuid, p_answers jsonb)
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

revoke execute on function public.update_request_specs(uuid, jsonb) from public, anon;
grant execute on function public.update_request_specs(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Feedback (§9)
-- ---------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  process_rating int not null check (process_rating between 1 and 5),
  output_rating int not null check (output_rating between 1 and 5),
  comments text check (comments is null or length(comments) <= 5000),
  submitted_at timestamptz not null default now()
);
create index feedback_requester_idx on public.feedback (requester_id);
create index feedback_submitted_idx on public.feedback (submitted_at desc);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon;
create policy "feedback: own or staff" on public.feedback for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.is_staff()));
-- Feedback is only added through submit_feedback().

create function public.submit_feedback(p_request_code text, p_process int, p_output int, p_comments text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.requests;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  select * into r from public.requests where request_code = upper(trim(p_request_code));
  if not found or r.requester_id <> uid then
    raise exception 'We couldn''t find that request among your requests.';
  end if;
  if r.status <> 'completed' then
    raise exception 'You can share feedback once the request is Completed.';
  end if;
  if exists (select 1 from public.feedback where request_id = r.id) then
    raise exception 'You already shared feedback for this request. Thank you!';
  end if;
  if p_process not between 1 and 5 or p_output not between 1 and 5 then
    raise exception 'Please rate both the process and the output.';
  end if;

  insert into public.feedback (request_id, requester_id, process_rating, output_rating, comments)
  values (r.id, uid, p_process, p_output, nullif(trim(coalesce(p_comments, '')), ''));

  insert into public.activity_log (request_id, actor_id, action, to_value)
  values (r.id, uid, 'feedback', ((p_process + p_output) / 2.0)::text);

  return jsonb_build_object('request_code', r.request_code);
end;
$$;

revoke execute on function public.submit_feedback(text, int, int, text) from public, anon;
grant execute on function public.submit_feedback(text, int, int, text) to authenticated;
