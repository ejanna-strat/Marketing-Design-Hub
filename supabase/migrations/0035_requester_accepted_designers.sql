-- Owner, Nov 12: requesters only see designers who have accepted (My
-- Requests table, filter, search and request page); the team still sees
-- everyone, with "waiting" beside anyone who hasn't accepted.
-- requests.accepted_designer_ids is kept by sync_request_designers like
-- designer_ids, and only that sync may change it.

alter table public.requests add column accepted_designer_ids uuid[] not null default '{}';
create index requests_accepted_designer_ids_idx on public.requests using gin (accepted_designer_ids);

-- Fill it for existing requests without touching anything else (the request
-- rules and updated_at stay as they are).
alter table public.requests disable trigger user;
update public.requests r set accepted_designer_ids = a.ids
from (select request_id, array_agg(designer_id order by added_at, designer_id) ids
      from public.request_designers where response = 'accepted' group by request_id) a
where a.request_id = r.id;
alter table public.requests enable trigger user;

create or replace function public.sync_request_designers(
  p_request_id uuid,
  p_announce boolean default false,
  p_reassign_reason text default null,
  p_team_replaced boolean default false
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  ids uuid[];
  accepted_ids uuid[];
  first_accepted uuid;
  first_any uuid;
  accepted_at timestamptz;
  latest uuid;
  new_status public.request_status;
  note text;
  notice_at timestamptz;
  change_pending boolean;
  told_first uuid;
  told_change uuid;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;

  select coalesce(array_agg(designer_id order by added_at, designer_id), '{}') into ids
  from public.request_designers where request_id = r.id;
  select coalesce(array_agg(designer_id order by added_at, designer_id), '{}') into accepted_ids
  from public.request_designers where request_id = r.id and response = 'accepted';
  select designer_id into first_any
  from public.request_designers where request_id = r.id order by added_at, designer_id limit 1;
  select designer_id into first_accepted
  from public.request_designers where request_id = r.id and response = 'accepted'
  order by added_at, designer_id limit 1;
  select min(responded_at) into accepted_at
  from public.request_designers where request_id = r.id and response = 'accepted';
  -- The designer who accepted most recently (the one who just did).
  select designer_id into latest
  from public.request_designers where request_id = r.id and response = 'accepted'
  order by responded_at desc nulls last, added_at desc limit 1;

  new_status := r.status;
  if cardinality(ids) = 0 and r.status not in ('new_request', 'completed', 'cancelled', 'rejected') then
    new_status := 'new_request';
    note := 'Automatic: designer removed';
  elsif first_accepted is not null and r.status = 'new_request' then
    new_status := 'designer_assigned';
    note := 'Automatic: designer accepted';
  end if;

  notice_at := r.accepted_notice_at;
  change_pending := r.designer_change_pending or (p_team_replaced and r.accepted_notice_at is not null);
  if p_announce and latest is not null then
    if notice_at is null then
      notice_at := now();
      told_first := latest;
      change_pending := false;
    elsif change_pending then
      change_pending := false;
      told_change := latest;
    end if;
  end if;

  perform set_config('app.designer_sync', 'on', true);
  perform set_config('app.workflow', 'on', true);
  perform set_config('app.status_note', coalesce(note, ''), true);
  update public.requests set
    designer_ids = ids,
    accepted_designer_ids = accepted_ids,
    assigned_designer_id = coalesce(first_accepted, first_any),
    designer_response = case
      when first_accepted is not null then 'accepted'
      when first_any is not null then 'pending'
    end,
    designer_responded_at = accepted_at,
    status = new_status,
    accepted_notice_at = notice_at,
    designer_change_pending = change_pending,
    reassign_reason = coalesce(p_reassign_reason, reassign_reason)
  where id = r.id;
  perform set_config('app.designer_sync', 'off', true);
  perform set_config('app.workflow', 'off', true);
  perform set_config('app.status_note', '', true);

  return jsonb_build_object(
    'id', r.id,
    'request_code', r.request_code,
    'status', new_status,
    'first_accepted', told_first,
    'team_changed', told_change
  );
end;
$$;

-- Only the designer sync changes the accepted list.
create or replace function public.requests_guard_accepted_designers()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.accepted_designer_ids is distinct from old.accepted_designer_ids
     and coalesce(current_setting('app.designer_sync', true), '') <> 'on' then
    raise exception 'Designers are added and removed with the Designers field on the request.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.requests_guard_accepted_designers() from public, anon, authenticated;

create trigger requests_guard_accepted_designers
  before update on public.requests
  for each row execute function public.requests_guard_accepted_designers();
