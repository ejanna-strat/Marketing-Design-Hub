-- Owner, Nov 24: Settings → Reports.
-- 1. Anyone on the Marketing team downloads a summary report (no personal
--    details) for a month or a year.
-- 2. Archive a year: once every request filed that year is finished
--    (Completed, Cancelled or Returned) and the last one finished at least 2
--    years ago, anyone on the team can download its requests as a
--    pipeline-style file with names and emails replaced ("Requester 1"...).
--    A Super Admin who downloaded it can then remove those requests. The
--    year's report is saved first (archived_years), so Analytics and the
--    report download still show that year.

create table public.archived_years (
  year int primary key,
  report jsonb not null,
  requests_removed int not null,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles (id) on delete set null
);
alter table public.archived_years enable row level security;
revoke all on public.archived_years from anon;
create policy "archived_years: team read" on public.archived_years for select to authenticated
  using ((select public.is_staff()));

create table public.archive_exports (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  request_count int not null,
  exported_by uuid not null references public.profiles (id) on delete cascade,
  exported_at timestamptz not null default now()
);
alter table public.archive_exports enable row level security;
revoke all on public.archive_exports from anon;
create policy "archive_exports: team read" on public.archive_exports for select to authenticated
  using ((select public.is_staff()));

-- Where a year stands: how many finished requests it has, how many are still
-- open, and from when it can be archived (2 years after the last one closed).
create or replace function public.archive_status(p_year int)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  start_at timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Asia/Manila');
  end_at timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Asia/Manila');
  finished int;
  still_open int;
  last_closed timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Only the Marketing team can see this.' using errcode = '42501';
  end if;
  select count(*) filter (where status in ('completed', 'cancelled', 'rejected')),
         count(*) filter (where status not in ('completed', 'cancelled', 'rejected')),
         max(case when status = 'completed' then coalesce(date_completed, updated_at) else updated_at end)
           filter (where status in ('completed', 'cancelled', 'rejected'))
    into finished, still_open, last_closed
  from public.requests where created_at >= start_at and created_at < end_at;
  return jsonb_build_object(
    'year', p_year,
    'finished', finished,
    'open', still_open,
    'available_from', (last_closed + interval '2 years'),
    'archived', exists (select 1 from public.archived_years where year = p_year),
    'ready', finished > 0 and still_open = 0 and last_closed + interval '2 years' <= now()
             and not exists (select 1 from public.archived_years where year = p_year)
  );
end;
$$;
revoke execute on function public.archive_status(int) from public, anon;
grant execute on function public.archive_status(int) to authenticated;

-- Records that someone downloaded a year's requests (needed before removing).
create or replace function public.log_archive_export(p_year int, p_count int)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only the Marketing team can download this.' using errcode = '42501';
  end if;
  insert into public.archive_exports (year, request_count, exported_by) values (p_year, p_count, auth.uid());
end;
$$;
revoke execute on function public.log_archive_export(int, int) from public, anon;
grant execute on function public.log_archive_export(int, int) to authenticated;

-- Super Admins: saves the year's report, then removes its requests (and their
-- answers, history, feedback and email log). Only after this person
-- downloaded the same requests in the last 24 hours, and when the count they
-- typed matches. Can't be undone.
create or replace function public.archive_year(p_year int, p_expected int, p_report jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  st jsonb;
  removed int;
begin
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin') then
    raise exception 'Only Super Admins can remove archived requests.' using errcode = '42501';
  end if;
  st := public.archive_status(p_year);
  if not (st->>'ready')::boolean then
    raise exception 'This year can''t be archived yet.';
  end if;
  if (st->>'finished')::int <> p_expected then
    raise exception 'The number you typed doesn''t match the number of requests.';
  end if;
  if not exists (
    select 1 from public.archive_exports
    where year = p_year and exported_by = auth.uid() and request_count = p_expected
      and exported_at > now() - interval '24 hours'
  ) then
    raise exception 'Please download the requests first (within the last 24 hours).';
  end if;
  if p_report is null or jsonb_typeof(p_report) <> 'object' then
    raise exception 'The year''s report is missing.';
  end if;

  insert into public.archived_years (year, report, requests_removed, archived_by)
  values (p_year, p_report, p_expected, auth.uid());
  delete from public.requests
  where created_at >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Asia/Manila')
    and created_at < make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Asia/Manila')
    and status in ('completed', 'cancelled', 'rejected');
  get diagnostics removed = row_count;
  if removed <> p_expected then
    raise exception 'Something changed while archiving. Nothing was removed; please try again.';
  end if;
  return jsonb_build_object('year', p_year, 'removed', removed);
end;
$$;
revoke execute on function public.archive_year(int, int, jsonb) from public, anon;
grant execute on function public.archive_year(int, int, jsonb) to authenticated;
