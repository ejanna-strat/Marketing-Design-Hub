-- Phase 2 workflow (owner decisions, Oct 18), CLAUDE.md §8.1:
--   * Reviewer (Admin / Lead Designer) accepts by assigning a designer, or
--     returns the request with a reason (status "rejected", shown "Returned").
--   * The assigned designer accepts (status → "Designer assigned (not yet
--     started)") or asks to reassign (designer cleared, back to New request).
--   * "Designer assigned (not yet started)" is set only by the designer's
--     Accept; it can't be picked by hand.
--   * The designer can't change once a request is Completed.
--   * For requester's review and Completed need a Link to Output.
--   * Work statuses still need an assigned designer.

alter table public.requests
  add column designer_response text check (designer_response in ('pending', 'accepted')),
  add column designer_responded_at timestamptz,
  add column returned_by uuid references public.profiles (id) on delete set null;
create index requests_returned_by_idx on public.requests (returned_by);

-- Existing requests that already have a designer count as accepted.
update public.requests set designer_response = 'accepted', designer_responded_at = updated_at
where assigned_designer_id is not null;

-- ---------------------------------------------------------------------------
-- Request updates
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
    if new.status in ('for_review', 'completed') and nullif(trim(coalesce(new.link_to_output, '')), '') is null then
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

  if new.output_needed is distinct from old.output_needed then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'output_needed', old.output_needed, new.output_needed);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviewer: return a request with a reason (Admins and Lead Designers).
-- ---------------------------------------------------------------------------

create function public.return_request(p_request_id uuid, p_reason text)
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

-- ---------------------------------------------------------------------------
-- Assigned designer: accept, or ask to reassign (Full plate / Other concerns).
-- ---------------------------------------------------------------------------

create function public.designer_respond(p_request_id uuid, p_accept boolean, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  me uuid;
  reason text := trim(coalesce(p_reason, ''));
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  select id into me from public.designers where user_id = auth.uid();
  if me is null or r.assigned_designer_id is distinct from me then
    raise exception 'Only the assigned designer can respond to this request.' using errcode = '42501';
  end if;
  if r.designer_response is distinct from 'pending' then
    raise exception 'You already responded to this request.';
  end if;

  perform set_config('app.workflow', 'on', true);
  if p_accept then
    update public.requests set
      designer_response = 'accepted',
      designer_responded_at = now(),
      status = case when status = 'new_request' then 'designer_assigned'::public.request_status else status end
    where id = r.id;
    insert into public.activity_log (request_id, actor_id, action)
    values (r.id, auth.uid(), 'designer_accepted');
  else
    if reason = '' then raise exception 'Please choose a reason for the reassignment.'; end if;
    update public.requests set
      assigned_designer_id = null,
      designer_response = null,
      designer_responded_at = null,
      reassign_reason = reason,
      status = 'new_request'
    where id = r.id;
    insert into public.activity_log (request_id, actor_id, action, note)
    values (r.id, auth.uid(), 'reassign_requested', reason);
  end if;
  perform set_config('app.workflow', 'off', true);

  return jsonb_build_object('id', r.id, 'request_code', r.request_code);
end;
$$;

revoke execute on function public.return_request(uuid, text) from public, anon;
revoke execute on function public.designer_respond(uuid, boolean, text) from public, anon;
grant execute on function public.return_request(uuid, text) to authenticated;
grant execute on function public.designer_respond(uuid, boolean, text) to authenticated;
