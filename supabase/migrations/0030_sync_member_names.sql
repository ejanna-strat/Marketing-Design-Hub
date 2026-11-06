-- Owner, Nov 6: a member's full name is the same in Settings → Members and
-- on their account (top-right corner). Editing it in Members updates the
-- account; changing your own display name updates your Members row. The
-- Designer list name stays separate. Filed requests keep their name.

create or replace function public.save_team_member(
  p_email text,
  p_full_name text,
  p_roles public.app_role[],
  p_designer_name text,
  p_copy_lead_emails boolean,
  p_copy_requester_emails boolean
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

  -- Lead Designers already get the Lead Designer emails.
  insert into public.team_members (email, full_name, roles, designer_display_name, copy_lead_emails, copy_requester_emails)
  values (member_email, member_name, p_roles, case when is_designer then designer_name end,
          coalesce(p_copy_lead_emails, false) and not ('lead_designer' = any (p_roles)),
          coalesce(p_copy_requester_emails, false))
  on conflict (email) do update set
    full_name = excluded.full_name,
    roles = excluded.roles,
    designer_display_name = excluded.designer_display_name,
    copy_lead_emails = excluded.copy_lead_emails,
    copy_requester_emails = excluded.copy_requester_emails;

  -- The account shows the same full name (top-right corner), once they've
  -- signed up (owner, Nov 6).
  update public.profiles set full_name = member_name
  where lower(email) = member_email and full_name is distinct from member_name;

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

create or replace function public.profiles_sync_member_name()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.team_members set full_name = new.full_name
  where email = lower(new.email) and full_name is distinct from new.full_name;
  return new;
end;
$$;
revoke execute on function public.profiles_sync_member_name() from public, anon, authenticated;

create trigger profiles_sync_member_name
  after update of full_name on public.profiles
  for each row when (new.full_name is distinct from old.full_name)
  execute function public.profiles_sync_member_name();

-- Owner: Jerome's name is "Jerome Casupanan" in both places.
update public.team_members set full_name = 'Jerome Casupanan' where email = 'jerome.casupanan@stratpoint.com';
update public.profiles set full_name = 'Jerome Casupanan' where lower(email) = 'jerome.casupanan@stratpoint.com';
