-- Owner, Oct 22: Super Admin and Admin.
--   super_admin    everything (what Admin could do before): reviews new
--                  requests (Accept & assign, Return), removes designers,
--                  manages members. Only Super Admins give, remove or change
--                  the tag; one can step down once someone else has it.
--   admin          like a Designer for requests (can't Accept & assign,
--                  Return or remove the designer; can change an assigned
--                  request's designer even without being in the Designer
--                  list), manages members, gives or removes the Admin tag.
-- The owner's Admin tag becomes Super Admin.

-- Super Admin counts as Admin wherever Admin is checked (reference tables).
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin', 'admin')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin', 'admin', 'lead_designer', 'designer')
  );
$$;

-- Reviewers: Super Admins and Lead Designers (Admins no longer, owner Oct 22).
create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin', 'lead_designer')
  );
$$;

-- Settings → Members: Super Admins, Admins and Lead Designers.
create function public.can_manage_members()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin', 'admin', 'lead_designer')
  );
$$;
revoke execute on function public.can_manage_members() from public, anon;
grant execute on function public.can_manage_members() to authenticated;

drop policy "team_members: managers read" on public.team_members;
create policy "team_members: managers read" on public.team_members for select to authenticated
  using ((select public.can_manage_members()));

create or replace function public.save_team_member(
  p_email text,
  p_full_name text,
  p_roles public.app_role[],
  p_designer_name text,
  p_gets_team_emails boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  member_email text := lower(trim(coalesce(p_email, '')));
  member_name text := trim(coalesce(p_full_name, ''));
  designer_name text := nullif(trim(coalesce(p_designer_name, '')), '');
  old_roles public.app_role[];
  is_designer boolean;
  member_id uuid;
begin
  if not public.can_manage_members() then
    raise exception 'Only Super Admins, Admins and Lead Designers can manage members.' using errcode = '42501';
  end if;
  if member_email !~ '^[^@\s]+@stratpoint\.com$' then
    raise exception 'Please enter a @stratpoint.com email address.';
  end if;
  if member_name = '' then
    raise exception 'Please enter the member''s name.';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Please choose at least one tag.';
  end if;
  if 'requester' = any (p_roles) then
    raise exception 'Members are tagged Super Admin, Admin, Lead Designer or Designer.';
  end if;

  select roles into old_roles from public.team_members where email = member_email;

  -- Only Super Admins can change a Super Admin, or give or remove the tag.
  if not public.has_role('super_admin')
     and ('super_admin' = any (coalesce(old_roles, '{}')) or 'super_admin' = any (p_roles)) then
    raise exception 'Only Super Admins can give, remove or change the Super Admin tag.' using errcode = '42501';
  end if;
  -- A Super Admin can step down, but never the last one (owner, Oct 22).
  if 'super_admin' = any (coalesce(old_roles, '{}')) and not ('super_admin' = any (p_roles))
     and not exists (select 1 from public.team_members
                     where 'super_admin' = any (roles) and email <> member_email) then
    raise exception 'Someone else needs the Super Admin tag first, so the team always has one.';
  end if;
  -- Super Admins and Admins give or take away the Admin tag.
  if not public.is_admin()
     and (('admin' = any (p_roles)) is distinct from ('admin' = any (coalesce(old_roles, '{}')))) then
    raise exception 'Only Super Admins and Admins can give or remove the Admin tag.' using errcode = '42501';
  end if;
  -- Admins can't remove their own Admin tag (so the team can't lock itself out).
  if member_email = (select lower(email) from public.profiles where id = auth.uid())
     and 'admin' = any (coalesce(old_roles, '{}')) and not ('admin' = any (p_roles)) then
    raise exception 'You can''t remove your own Admin tag. Ask another Admin.';
  end if;

  is_designer := p_roles && array['designer', 'lead_designer']::public.app_role[];
  if is_designer and designer_name is null then
    designer_name := split_part(member_name, ' ', 1);
  end if;

  insert into public.team_members (email, full_name, roles, designer_display_name, gets_team_emails)
  values (member_email, member_name, p_roles, case when is_designer then designer_name end, coalesce(p_gets_team_emails, false))
  on conflict (email) do update set
    full_name = excluded.full_name,
    roles = excluded.roles,
    designer_display_name = excluded.designer_display_name,
    gets_team_emails = excluded.gets_team_emails;

  -- Designers and Lead Designers appear in the Designer dropdown. Former
  -- designers are hidden, not deleted, so old requests keep their name.
  if is_designer then
    insert into public.designers (email, display_name, active)
    values (member_email, designer_name, true)
    on conflict (email) do update set display_name = excluded.display_name, active = true;
  else
    update public.designers set active = false where email = member_email;
  end if;

  select id into member_id from public.profiles where lower(email) = member_email;
  if member_id is not null then
    perform public.sync_user_roles(member_id);
  end if;
end;
$$;

create or replace function public.remove_team_member(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  member_email text := lower(trim(coalesce(p_email, '')));
  old_roles public.app_role[];
  member_id uuid;
begin
  if not public.can_manage_members() then
    raise exception 'Only Super Admins, Admins and Lead Designers can manage members.' using errcode = '42501';
  end if;
  select roles into old_roles from public.team_members where email = member_email;
  if not found then
    raise exception 'That member was not found.';
  end if;
  if member_email = (select lower(email) from public.profiles where id = auth.uid()) then
    raise exception 'You can''t remove yourself. Ask another Super Admin, Admin or Lead Designer.';
  end if;
  if 'super_admin' = any (old_roles) and not public.has_role('super_admin') then
    raise exception 'Only Super Admins can remove a Super Admin.' using errcode = '42501';
  end if;
  if 'admin' = any (old_roles) and not public.is_admin() then
    raise exception 'Only Super Admins and Admins can remove an Admin.' using errcode = '42501';
  end if;

  delete from public.team_members where email = member_email;
  update public.designers set active = false where email = member_email;

  select id into member_id from public.profiles where lower(email) = member_email;
  if member_id is not null then
    perform public.sync_user_roles(member_id);
  end if;
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
    raise exception 'Only Super Admins and Lead Designers can return requests.' using errcode = '42501';
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
        -- Designers and Admins (owner, Oct 22): take a new, unassigned
        -- request for yourself, or change the designer to anyone once it has
        -- one. Removing the designer and assigning others to fresh requests
        -- stay with Super Admins and Lead Designers.
        if new.assigned_designer_id is distinct from old.assigned_designer_id then
          -- Admins who aren't designers can still change an assigned
          -- request's designer, but not take a fresh one.
          if my_designer is null and not public.is_admin() then
            raise exception 'Only the Design team can assign designers.' using errcode = '42501';
          end if;
          if new.assigned_designer_id is null then
            raise exception 'Only Super Admins and Lead Designers can remove the designer.' using errcode = '42501';
          end if;
          if old.assigned_designer_id is null and new.assigned_designer_id is distinct from my_designer then
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

-- The owner becomes the first Super Admin (replacing their Admin tag).
update public.team_members
set roles = array_append(array_remove(roles, 'admin'), 'super_admin')
where email = 'erylljanna.ong@stratpoint.com' and not ('super_admin' = any (roles));
select public.sync_user_roles(p.id) from public.profiles p where lower(p.email) = 'erylljanna.ong@stratpoint.com';
