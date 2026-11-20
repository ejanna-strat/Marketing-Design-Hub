-- Owner, Nov 20: announcements on the main page (where people pick a space).
-- Up to 3 rotate in a top banner; a side panel lists every current one.
-- Super Admins always post; they tick who else can (announcement_posters).
-- Dates are Manila calendar days: live from starts_on through ends_on.

create table public.announcement_posters (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now()
);

create function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin');
$$;
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

create function public.can_post_announcements()
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- A ticked poster must still be on the team (removing a member stops it).
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
      or (exists (select 1 from public.announcement_posters where user_id = auth.uid())
          and exists (select 1 from public.user_roles
                      where user_id = auth.uid() and role in ('admin', 'lead_designer', 'designer')));
$$;
revoke execute on function public.can_post_announcements() from public, anon;
grant execute on function public.can_post_announcements() to authenticated;

alter table public.announcement_posters enable row level security;
revoke all on public.announcement_posters from anon;
-- Each person sees their own row (to know they can post); Super Admins see all.
create policy "announcement_posters: read" on public.announcement_posters for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()));
create policy "announcement_posters: super admin insert" on public.announcement_posters for insert to authenticated
  with check ((select public.is_super_admin()));
create policy "announcement_posters: super admin delete" on public.announcement_posters for delete to authenticated
  using ((select public.is_super_admin()));

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  headline text not null check (length(trim(headline)) between 1 and 80),
  message text not null default '' check (length(message) <= 240),
  link_label text check (link_label is null or length(trim(link_label)) between 1 and 30),
  link_url text check (link_url is null or link_url ~* '^(https://|mailto:)'),
  tone text not null default 'blue' check (tone in ('blue', 'green', 'amber', 'neutral')),
  in_banner boolean not null default true,
  starts_on date not null default ((now() at time zone 'Asia/Manila')::date),
  ends_on date check (ends_on is null or ends_on >= starts_on),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((link_label is null) = (link_url is null))
);
create index announcements_dates_idx on public.announcements (starts_on, ends_on);

alter table public.announcements enable row level security;
revoke all on public.announcements from anon;
-- Everyone signed in reads the live ones; posters also see scheduled and ended ones.
create policy "announcements: read" on public.announcements for select to authenticated
  using (
    (starts_on <= (now() at time zone 'Asia/Manila')::date
      and (ends_on is null or ends_on >= (now() at time zone 'Asia/Manila')::date))
    or (select public.can_post_announcements())
  );
create policy "announcements: poster insert" on public.announcements for insert to authenticated
  with check ((select public.can_post_announcements()));
create policy "announcements: poster update" on public.announcements for update to authenticated
  using ((select public.can_post_announcements())) with check ((select public.can_post_announcements()));
create policy "announcements: poster delete" on public.announcements for delete to authenticated
  using ((select public.can_post_announcements()));
