-- Owner, Nov 24: a reminder when a request has been On hold for 30 days, then
-- every 30 days, to its designers and the Lead Designers (not the requester).
-- From the request page they Keep on hold (the next reminder is 30 days
-- later), Resume (back to the status before On hold) or Cancel.

alter table public.requests
  add column on_hold_since timestamptz,
  add column on_hold_from public.request_status,
  add column on_hold_checked_at timestamptz;

-- Notes when a request goes On hold (and from which status), and clears it
-- when it leaves On hold.
create or replace function public.requests_track_on_hold()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'on_hold' and old.status is distinct from 'on_hold' then
    new.on_hold_since := now();
    new.on_hold_from := old.status;
    new.on_hold_checked_at := now();
  elsif new.status is distinct from 'on_hold' and old.status = 'on_hold' then
    new.on_hold_since := null;
    new.on_hold_from := null;
    new.on_hold_checked_at := null;
  end if;
  return new;
end;
$$;

create trigger requests_track_on_hold
  before update on public.requests
  for each row execute function public.requests_track_on_hold();

-- Requests already On hold: from their latest status change, else last update.
update public.requests r set
  on_hold_since = coalesce(l.created_at, r.updated_at),
  on_hold_from = l.from_value::public.request_status,
  on_hold_checked_at = coalesce(l.created_at, r.updated_at)
from (select r2.id, a.created_at, a.from_value
      from public.requests r2
      left join lateral (
        select a.created_at, a.from_value from public.activity_log a
        where a.request_id = r2.id and a.action = 'status' and a.to_value = 'on_hold'
        order by a.created_at desc limit 1
      ) a on true
      where r2.status = 'on_hold') l
where r.id = l.id;

-- Keep on hold: the next reminder comes 30 days from now. Same people who can
-- change the status (not Admins without a design tag, not a designer who
-- hasn't accepted).
create or replace function public.keep_on_hold(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
begin
  if not public.is_staff() or public.is_admin_only() then
    raise exception 'Only the Design team can update an On hold request.' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'on_hold' then raise exception 'This request is no longer On hold.'; end if;
  if not public.is_manager() and exists (
    select 1 from public.request_designers rd join public.designers d on d.id = rd.designer_id
    where rd.request_id = r.id and d.user_id = auth.uid() and rd.response = 'pending'
  ) then
    raise exception 'Please accept the request first.' using errcode = '42501';
  end if;
  perform set_config('app.workflow', 'on', true);
  update public.requests set on_hold_checked_at = now() where id = r.id;
  perform set_config('app.workflow', 'off', true);
  insert into public.activity_log (request_id, actor_id, action)
  values (r.id, auth.uid(), 'kept_on_hold');
  return jsonb_build_object('id', r.id, 'request_code', r.request_code);
end;
$$;
revoke execute on function public.keep_on_hold(uuid) from public, anon;
grant execute on function public.keep_on_hold(uuid) to authenticated;

-- Resume: back to the status before On hold, with the usual checks (a
-- designer for work statuses, a Link to Output for review and Completed).
-- Allowed to return to "Designer assigned", which can't be picked by hand.
-- No email: the requester already had the one for that step.
create or replace function public.resume_request(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
begin
  if not public.is_staff() or public.is_admin_only() then
    raise exception 'Only the Design team can resume a request.' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'on_hold' then raise exception 'This request is no longer On hold.'; end if;
  if r.on_hold_from is null or r.on_hold_from in ('on_hold', 'cancelled', 'rejected') then
    raise exception 'We don''t know its status before On hold. Please pick the status in the Status menu.';
  end if;
  if not public.is_manager() and exists (
    select 1 from public.request_designers rd join public.designers d on d.id = rd.designer_id
    where rd.request_id = r.id and d.user_id = auth.uid() and rd.response = 'pending'
  ) then
    raise exception 'Please accept the request first.' using errcode = '42501';
  end if;
  perform set_config('app.workflow', 'on', true);
  update public.requests set status = r.on_hold_from where id = r.id;
  perform set_config('app.workflow', 'off', true);
  return jsonb_build_object('id', r.id, 'request_code', r.request_code, 'status', r.on_hold_from);
end;
$$;
revoke execute on function public.resume_request(uuid) from public, anon;
grant execute on function public.resume_request(uuid) to authenticated;
