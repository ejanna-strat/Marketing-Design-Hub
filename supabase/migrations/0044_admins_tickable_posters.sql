-- Owner, Nov 23: Admins post announcements only when a Super Admin ticks
-- them, like Lead Designers and Designers (0042 had made it automatic). Only
-- Super Admins always can. Admins who already have an account start ticked,
-- so nobody loses access today.

create or replace function public.can_post_announcements()
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- A ticked poster must still be on the team (removing a member stops it).
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
      or (exists (select 1 from public.announcement_posters where user_id = auth.uid())
          and exists (select 1 from public.user_roles
                      where user_id = auth.uid() and role in ('admin', 'lead_designer', 'designer')));
$$;

insert into public.announcement_posters (user_id)
select distinct ur.user_id from public.user_roles ur
where ur.role = 'admin'
  and not exists (select 1 from public.user_roles s where s.user_id = ur.user_id and s.role = 'super_admin')
on conflict (user_id) do nothing;
