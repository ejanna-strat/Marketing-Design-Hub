-- Owner, Nov 20: Admins can always post announcements too, like Super
-- Admins. Lead Designers and Designers still need a Super Admin's tick.

create or replace function public.can_post_announcements()
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- A ticked poster must still be on the team (removing a member stops it).
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('super_admin', 'admin'))
      or (exists (select 1 from public.announcement_posters where user_id = auth.uid())
          and exists (select 1 from public.user_roles
                      where user_id = auth.uid() and role in ('lead_designer', 'designer')));
$$;
