-- Owner, Nov 6 (option B): the name on someone's account always wins.
-- * Adding or editing a member who has signed up uses their account name
--   (the form shows it locked).
-- * Someone added before signing up gets the name they sign up with
--   (handle_new_user, 0032).
-- * Changing your own display name still updates Members (0030 trigger).
-- Existing members take their account name now (e.g. Steve Ryan Ko).

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
  account_name text;
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

  -- Someone who has signed up keeps the name they chose (owner, Nov 6).
  select full_name into account_name from public.profiles where lower(email) = member_email;
  if nullif(trim(account_name), '') is not null then
    member_name := account_name;
  end if;

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

-- A blank account name never replaces the Members name.
create or replace function public.profiles_sync_member_name()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if nullif(trim(new.full_name), '') is null then
    return new;
  end if;
  update public.team_members set full_name = new.full_name
  where email = lower(new.email) and full_name is distinct from new.full_name;
  return new;
end;
$$;

create trigger profiles_sync_member_name_on_signup
  after insert on public.profiles
  for each row execute function public.profiles_sync_member_name();

update public.team_members m set full_name = p.full_name
from public.profiles p
where lower(p.email) = m.email and nullif(trim(p.full_name), '') is not null and m.full_name is distinct from p.full_name;
