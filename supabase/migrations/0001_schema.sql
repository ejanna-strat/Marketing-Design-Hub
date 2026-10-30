-- Marketing Design Hub — Phase 1 database schema
-- Tables, helper functions, triggers and Row Level Security (RLS).
-- Apply once, before 0002_seed.sql.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'designer', 'requester');

-- Labels shown to users live in src/lib/statuses.ts.
create type public.request_status as enum (
  'new_request',        -- New request
  'designer_assigned',  -- Designer assigned (not yet started)
  'in_progress',        -- In progress
  'for_review',         -- For requester's review
  'for_revision',       -- For revision
  'completed',          -- Completed
  'rejected',           -- Rejected (requester sees "Returned")
  'cancelled',          -- Cancelled
  'on_hold'             -- On hold
);

create type public.field_type as enum (
  'short_text', 'long_text', 'url', 'single_select', 'multi_select', 'date'
);

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_marketing boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.request_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

-- Specification questions per request type. General Information questions
-- (§6.1) are built into the form and stored as columns on `requests`.
-- Never delete a question that has answers: set active = false instead.
create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid references public.request_types (id),
  label text not null,
  help_text text,
  field_type public.field_type not null,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  allow_other boolean not null default false,
  required boolean not null default false,
  is_output_needed boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true
);
create index form_questions_type_idx on public.form_questions (request_type_id, sort_order);
create unique index form_questions_one_output_needed
  on public.form_questions (request_type_id) where is_output_needed and active;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  team_id uuid references public.teams (id),
  created_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

-- The Marketing roster, seeded from config/team.ts (npm run seed:team).
-- Anyone signing in who is not on it becomes a requester.
create table public.team_members (
  email text primary key check (email = lower(email)),
  full_name text not null,
  roles public.app_role[] not null default '{}',
  designer_display_name text
);

create table public.designers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  email text not null unique check (email = lower(email)),
  display_name text not null,
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------

create table public.request_counters (
  year int primary key,
  last_value int not null default 0
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,            -- MDR-26-0001, set by trigger
  title text not null check (length(trim(title)) > 0),
  requester_id uuid not null references public.profiles (id),
  requester_name text not null,
  requester_email text not null,
  team_id uuid not null references public.teams (id),
  request_type_id uuid not null references public.request_types (id),
  -- Copy of the ★ answer (or "Others"), saved at submit so the pipeline can
  -- search/sort/filter it. The one exception to "compute, don't store".
  output_needed text not null,
  date_needed date not null,
  final_approver_name text not null,
  final_approver_email text not null,
  status public.request_status not null default 'new_request',
  assigned_designer_id uuid references public.designers (id),
  link_to_output text,
  return_reason text,
  reassign_reason text,
  date_started timestamptz,
  date_completed timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_requester_idx on public.requests (requester_id, created_at desc);
create index requests_created_idx on public.requests (created_at desc);
create index requests_status_idx on public.requests (status);
create index requests_designer_idx on public.requests (assigned_designer_id);
create index requests_team_idx on public.requests (team_id);
create index requests_type_idx on public.requests (request_type_id);

-- value: a string for text and single-select answers, an array of strings for
-- multi-select. A typed "Other" answer is stored as "Other: <text>".
create table public.request_answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  question_id uuid not null references public.form_questions (id),
  question_label_snapshot text not null,
  value jsonb not null,
  unique (request_id, question_id)
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,     -- created | status | designer | link_to_output | date_needed
  from_value text,
  to_value text,
  note text,
  created_at timestamptz not null default now()
);
create index activity_log_request_idx on public.activity_log (request_id, created_at);

-- Every email send. A once-only email is "claimed" with a pending row before
-- sending; the unique index stops a second send of the same email.
create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests (id) on delete cascade,
  notification_key text not null,   -- e.g. N1_NEW_REQUEST
  recipients text[] not null default '{}',
  once_only boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz not null default now()
);
create unique index notifications_log_once_only
  on public.notifications_log (request_id, notification_key)
  where once_only and status in ('pending', 'sent');

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so RLS policies can call them safely)
-- ---------------------------------------------------------------------------

create function public.has_role(r public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = r
  );
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.has_role('admin'); $$;

create function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'designer')
  );
$$;

-- ---------------------------------------------------------------------------
-- New users: profile + roles from the roster
-- ---------------------------------------------------------------------------

-- Gives one user the roles listed for their email in team_members
-- (requester if not listed) and links their designers row.
create function public.sync_user_roles(uid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  user_email text;
  roster_roles public.app_role[];
begin
  select lower(email) into user_email from public.profiles where id = uid;
  if user_email is null then
    return;
  end if;

  select roles into roster_roles from public.team_members where email = user_email;
  if roster_roles is null or cardinality(roster_roles) = 0 then
    roster_roles := array['requester']::public.app_role[];
  end if;

  delete from public.user_roles where user_id = uid and role <> all (roster_roles);
  insert into public.user_roles (user_id, role)
  select uid, r from unnest(roster_roles) as r
  on conflict do nothing;

  update public.designers set user_id = uid
  where email = user_email and user_id is distinct from uid;
end;
$$;

-- Re-applies the roster to everyone who has already signed in.
-- Called by `npm run seed:team` after the roster changes.
create function public.sync_team_roster()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
begin
  for p in select id from public.profiles loop
    perform public.sync_user_roles(p.id);
  end loop;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  roster_name text;
begin
  select full_name into roster_name from public.team_members where email = lower(new.email);

  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      roster_name,
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      initcap(replace(split_part(new.email, '@', 1), '.', ' '))
    ),
    lower(new.email)
  );

  perform public.sync_user_roles(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Request ID: MDR-YY-NNNN, numbering restarts every year (Asia/Manila)
-- ---------------------------------------------------------------------------

create function public.assign_request_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  yr int := extract(year from (coalesce(new.created_at, now()) at time zone 'Asia/Manila'))::int;
  n int;
begin
  -- The upsert locks this year's counter row, so two requests can never get
  -- the same number.
  insert into public.request_counters as c (year, last_value)
  values (yr, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning c.last_value into n;

  new.request_code := format(
    'MDR-%s-%s',
    lpad((yr % 100)::text, 2, '0'),
    lpad(n::text, greatest(4, length(n::text)), '0')
  );
  return new;
end;
$$;

create trigger requests_assign_code
  before insert on public.requests
  for each row execute function public.assign_request_code();

-- ---------------------------------------------------------------------------
-- Request updates: column guard, auto dates, activity log
-- ---------------------------------------------------------------------------

create function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  designer_editable text[] := array['status', 'link_to_output', 'updated_at'];
  old_designer text;
  new_designer text;
begin
  -- Nobody can change these. A different type of request needs a new request.
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
    -- Date Started / Date Completed are only ever set below.
    new.date_started := old.date_started;
    new.date_completed := old.date_completed;

    -- Designers who are not admins may only change Status and Link to Output.
    if not public.is_admin()
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

create trigger requests_before_update
  before update on public.requests
  for each row execute function public.requests_before_update();

-- ---------------------------------------------------------------------------
-- Submit a request (one transaction: request + answers + log)
-- ---------------------------------------------------------------------------
-- payload: {
--   requester_name, title, team_id, request_type_id, date_needed (YYYY-MM-DD),
--   final_approver: "myself" | "other", approver_name, approver_email,
--   answers: { "<question_id>": "text" | ["a", "b"] }
-- }
-- Returns { "id": uuid, "request_code": "MDR-26-0001" }.

create function public.submit_request(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.profiles;
  req_type public.request_types;
  req_team uuid;
  req_title text := trim(coalesce(payload ->> 'title', ''));
  req_name text := trim(coalesce(payload ->> 'requester_name', ''));
  req_date date;
  approver_name text;
  approver_email text;
  answers jsonb := coalesce(payload -> 'answers', '{}'::jsonb);
  clean jsonb := '{}'::jsonb;
  output_needed text := 'Others';
  q public.form_questions;
  v jsonb;
  item text;
  is_empty boolean;
  new_id uuid;
  new_code text;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  if uid is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  select * into me from public.profiles where id = uid;
  if not found then
    raise exception 'Your profile was not found. Please sign out and sign in again.';
  end if;

  if req_name = '' then raise exception 'Please enter your name.'; end if;
  if req_title = '' then raise exception 'Please enter a request title.'; end if;

  select id into req_team from public.teams
  where id = nullif(payload ->> 'team_id', '')::uuid and active;
  if req_team is null then raise exception 'Please choose your business unit.'; end if;

  select * into req_type from public.request_types
  where id = nullif(payload ->> 'request_type_id', '')::uuid and active;
  if not found then raise exception 'Please choose a type of design request.'; end if;

  req_date := nullif(payload ->> 'date_needed', '')::date;
  if req_date is null then raise exception 'Please choose the date needed.'; end if;
  if req_date < today then raise exception 'The date needed cannot be in the past.'; end if;

  if payload ->> 'final_approver' = 'myself' then
    approver_name := req_name;
    approver_email := me.email;
  elsif payload ->> 'final_approver' = 'other' then
    approver_name := trim(coalesce(payload ->> 'approver_name', ''));
    approver_email := lower(trim(coalesce(payload ->> 'approver_email', '')));
    if approver_name = '' then raise exception 'Please enter the approver''s name.'; end if;
    if approver_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Please enter a valid approver email.';
    end if;
  else
    raise exception 'Please choose the final approver of the design.';
  end if;

  if jsonb_typeof(answers) <> 'object' then
    raise exception 'The answers could not be read. Please try again.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(answers) as k
    where not exists (
      select 1 from public.form_questions fq
      where fq.id::text = k and fq.request_type_id = req_type.id and fq.active
    )
  ) then
    raise exception 'Some answers do not match this type of request. Please reload the form.';
  end if;

  for q in
    select * from public.form_questions
    where request_type_id = req_type.id and active
    order by sort_order
  loop
    v := answers -> q.id::text;
    is_empty := v is null
      or jsonb_typeof(v) = 'null'
      or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '')
      or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0);

    if is_empty then
      if q.required then raise exception 'Please answer: %', q.label; end if;
      continue;
    end if;

    if q.field_type = 'multi_select' then
      if jsonb_typeof(v) <> 'array' then raise exception 'Please check your answer to: %', q.label; end if;
      for item in select jsonb_array_elements_text(v) loop
        if not (q.options ? item or (q.allow_other and item ~ '^Other: \S')) then
          raise exception 'Please check your answer to: %', q.label;
        end if;
      end loop;
    else
      if jsonb_typeof(v) <> 'string' then raise exception 'Please check your answer to: %', q.label; end if;
      v := to_jsonb(trim(v #>> '{}'));
      if q.field_type = 'single_select'
         and not (q.options ? (v #>> '{}') or (q.allow_other and (v #>> '{}') ~ '^Other: \S')) then
        raise exception 'Please check your answer to: %', q.label;
      end if;
    end if;

    if q.is_output_needed then
      output_needed := case jsonb_typeof(v)
        when 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(v) as x)
        else v #>> '{}'
      end;
    end if;

    clean := clean || jsonb_build_object(q.id::text, v);
  end loop;

  insert into public.requests (
    title, requester_id, requester_name, requester_email, team_id, request_type_id,
    output_needed, date_needed, final_approver_name, final_approver_email
  ) values (
    req_title, uid, req_name, me.email, req_team, req_type.id,
    output_needed, req_date, approver_name, approver_email
  )
  returning id, request_code into new_id, new_code;

  insert into public.request_answers (request_id, question_id, question_label_snapshot, value)
  select new_id, fq.id, fq.label, a.value
  from jsonb_each(clean) as a
  join public.form_questions fq on fq.id::text = a.key;

  insert into public.activity_log (request_id, actor_id, action, to_value)
  values (new_id, uid, 'created', 'new_request');

  -- Remember the business unit for next time.
  update public.profiles set team_id = req_team where id = uid;

  return jsonb_build_object('id', new_id, 'request_code', new_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth hook: only @stratpoint.com emails can create an account.
-- Turn it on in Supabase: Authentication → Hooks → Before User Created.
-- ---------------------------------------------------------------------------

create function public.hook_restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql stable
as $$
begin
  if coalesce(lower(event -> 'user' ->> 'email'), '') !~ '^[^@\s]+@stratpoint\.com$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Please use your @stratpoint.com email address.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.submit_request(jsonb) to authenticated;
grant execute on function public.sync_team_roster() to service_role;
grant execute on function public.sync_user_roles(uuid) to service_role;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_signup_domain(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.request_types enable row level security;
alter table public.form_questions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.team_members enable row level security;
alter table public.designers enable row level security;
alter table public.request_counters enable row level security;
alter table public.requests enable row level security;
alter table public.request_answers enable row level security;
alter table public.activity_log enable row level security;
alter table public.notifications_log enable row level security;

-- Signed-out visitors get nothing.
revoke all on all tables in schema public from anon;

-- Reference lists: everyone signed in can read; only admins can change.
create policy "teams: read" on public.teams for select to authenticated using (true);
create policy "teams: admin write" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "request_types: read" on public.request_types for select to authenticated using (true);
create policy "request_types: admin write" on public.request_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "form_questions: read" on public.form_questions for select to authenticated using (true);
create policy "form_questions: admin write" on public.form_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "designers: read" on public.designers for select to authenticated using (true);
create policy "designers: admin write" on public.designers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- People: your own profile and roles; staff can see everyone.
create policy "profiles: own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "user_roles: own or staff" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy "team_members: admin" on public.team_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- request_counters: no policies (only the request-code trigger uses it).

-- Requests: requesters see only their own; staff see and update all.
-- New requests are created only through submit_request().
create policy "requests: own or staff" on public.requests for select to authenticated
  using (requester_id = auth.uid() or public.is_staff());
create policy "requests: staff update" on public.requests for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "request_answers: own or staff" on public.request_answers for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.requests r
      where r.id = request_answers.request_id and r.requester_id = auth.uid()
    )
  );

create policy "activity_log: staff" on public.activity_log for select to authenticated
  using (public.is_staff());

-- notifications_log: no policies (server only, with the service role key).
