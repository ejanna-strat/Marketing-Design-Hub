-- Owner, Oct 22: designers can volunteer. Anyone in the Designer list can
-- take a new, unassigned request for themselves (counts as accepted), and
-- change the designer to anyone once a request has one (the status stays).
-- Removing the designer and putting someone else on a fresh request stay
-- with Admins and Lead Designers.

create or replace function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  staff_editable text[] := array[
    'status', 'link_to_output', 'updated_at', 'output_needed',
    'title', 'requester_name', 'team_id', 'date_needed', 'final_approver_name', 'final_approver_email',
    'is_deal', 'deal_name', 'deal_size', 'project_overview', 'assigned_designer_id'
  ];
  -- The signed-in person's own designer record, if they're in the Designer list.
  my_designer uuid := (select d.id from public.designers d where d.user_id = auth.uid() and d.active);
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
        -- Designers (owner, Oct 22): take a new, unassigned request for
        -- themselves, or change the designer to anyone once it has one.
        -- Removing the designer and assigning others to fresh requests stay
        -- with Admins and Lead Designers.
        if new.assigned_designer_id is distinct from old.assigned_designer_id then
          if my_designer is null then
            raise exception 'Only the Design team can assign designers.' using errcode = '42501';
          end if;
          if new.assigned_designer_id is null then
            raise exception 'Only Admins and Lead Designers can remove the designer.' using errcode = '42501';
          end if;
          if old.assigned_designer_id is null and new.assigned_designer_id <> my_designer then
            raise exception 'You can take this request for yourself; a Lead Designer assigns it to someone else.'
              using errcode = '42501';
          end if;
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

  -- Cancelled and Returned requests are closed: no designer or link changes.
  if old.status in ('cancelled', 'rejected')
     and (new.assigned_designer_id is distinct from old.assigned_designer_id
          or nullif(trim(coalesce(new.link_to_output, '')), '') is distinct from old.link_to_output) then
    raise exception 'This request is Cancelled or Returned, so the designer and Link to Output can''t be changed.'
      using errcode = '42501';
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
    elsif new.assigned_designer_id = my_designer then
      -- Taking it for yourself counts as accepting it (owner, Oct 22).
      new.designer_response := 'accepted';
      new.designer_responded_at := now();
      if new.status = 'new_request' then
        new.status := 'designer_assigned';
        auto_note := 'Automatic: took the request';
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
    if new.status = 'new_request' and new.assigned_designer_id is not null and new.designer_response = 'accepted' then
      raise exception 'The designer already accepted this request, so it can''t go back to New request.'
        using errcode = '42501';
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
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value, note)
    values (new.id, actor, 'designer', old_text, new_text,
            case when new.assigned_designer_id = my_designer then 'Took the request' end);
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
