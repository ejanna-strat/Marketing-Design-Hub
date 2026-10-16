-- Settings → Members: the team roster is managed in the app from now on
-- (it replaces config/team.ts and `npm run seed:team`).
--
-- Roles (a person can have more than one):
--   admin          everything, including giving or removing the Admin tag
--   lead_designer  reviews/assigns requests, manages members, is a designer
--   designer       works on assigned requests (Status and Link to Output)
-- Anyone not on the roster is a requester.

-- ---------------------------------------------------------------------------
-- Roster columns
-- ---------------------------------------------------------------------------

-- Gets the Marketing-team emails that go to "Lead Designers + Riann" (N1).
alter table public.team_members
  add column gets_team_emails boolean not null default false,
  add column added_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

-- Admin, Lead Designer or Designer: can open the pipeline.
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'lead_designer', 'designer')
  );
$$;

-- Admin or Lead Designer: can change every pipeline field and manage members.
create function public.is_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'lead_designer')
  );
$$;
revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

-- ---------------------------------------------------------------------------
-- Column guard: Designers (not Admin / Lead Designer) may only change Status
-- and Link to Output. Same as 0001 with is_admin() → is_manager().
-- ---------------------------------------------------------------------------

create or replace function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  designer_editable text[] := array['status', 'link_to_output', 'updated_at'];
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

    if not public.is_manager()
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

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Members: read by Admins and Lead Designers; changed only through the two
-- functions below, which enforce the rules.
-- ---------------------------------------------------------------------------

drop policy "team_members: admin" on public.team_members;
create policy "team_members: managers read" on public.team_members for select to authenticated
  using ((select public.is_manager()));

-- Adds a member or updates their name, tags and email setting.
create function public.save_team_member(
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
  if not public.is_manager() then
    raise exception 'Only Admins and Lead Designers can manage members.' using errcode = '42501';
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
    raise exception 'Members are tagged Admin, Lead Designer or Designer.';
  end if;

  select roles into old_roles from public.team_members where email = member_email;

  -- Only Admins can give or take away the Admin tag.
  if not public.has_role('admin')
     and (('admin' = any (p_roles)) is distinct from ('admin' = any (coalesce(old_roles, '{}')))) then
    raise exception 'Only Admins can give or remove the Admin tag.' using errcode = '42501';
  end if;
  -- Nobody can remove their own Admin tag (so the team can't lock itself out).
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

-- Removes a member: they become a requester again.
create function public.remove_team_member(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  member_email text := lower(trim(coalesce(p_email, '')));
  old_roles public.app_role[];
  member_id uuid;
begin
  if not public.is_manager() then
    raise exception 'Only Admins and Lead Designers can manage members.' using errcode = '42501';
  end if;
  select roles into old_roles from public.team_members where email = member_email;
  if not found then
    raise exception 'That member was not found.';
  end if;
  if member_email = (select lower(email) from public.profiles where id = auth.uid()) then
    raise exception 'You can''t remove yourself. Ask another Admin or Lead Designer.';
  end if;
  if 'admin' = any (old_roles) and not public.has_role('admin') then
    raise exception 'Only Admins can remove an Admin.' using errcode = '42501';
  end if;

  delete from public.team_members where email = member_email;
  update public.designers set active = false where email = member_email;

  select id into member_id from public.profiles where lower(email) = member_email;
  if member_id is not null then
    perform public.sync_user_roles(member_id);
  end if;
end;
$$;

revoke execute on function public.save_team_member(text, text, public.app_role[], text, boolean) from public, anon;
revoke execute on function public.remove_team_member(text) from public, anon;
grant execute on function public.save_team_member(text, text, public.app_role[], text, boolean) to authenticated;
grant execute on function public.remove_team_member(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Current team: Jerome and Steve review and assign → Lead Designers.
-- Riann gets the team emails. (Tags can be changed in Settings → Members.)
-- ---------------------------------------------------------------------------

update public.team_members set roles = array['lead_designer']::public.app_role[]
where email in ('jerome.casupanan@stratpoint.com', 'steve@stratpoint.com');
update public.team_members set gets_team_emails = true where email = 'riann@stratpoint.com';
select public.sync_team_roster();
