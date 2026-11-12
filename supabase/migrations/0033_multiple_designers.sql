-- Owner, Nov 12: a request can have several designers, all equal (no main
-- designer, no maximum).
-- * Only Super Admins and Lead Designers add or remove designers
--   (set_request_designers). Adding yourself counts as accepted; anyone else
--   starts as pending and accepts on their own (designer_respond).
-- * New request → Designer assigned when the FIRST designer accepts; work
--   statuses need at least one accepted designer. A designer who hasn't
--   accepted yet can't change the status or the links.
-- * Ask to reassign removes only that designer; the last one leaving sends the
--   request back to New request, as before.
-- * Take this request (no designer yet) and the new "Add me as a designer"
--   (any active designer, once it has one) both count as accepted
--   (add_me_as_designer).
-- * Nothing changes once Completed; Cancelled and Returned stay locked.
-- requests.assigned_designer_id / designer_response / designer_responded_at
-- stay as a summary (first accepted designer, else the first added; accepted
-- if anyone accepted) so the existing rules keep working, plus
-- requests.designer_ids (everyone on it, in the order added) for the lists.
-- Only sync_request_designers() changes them (app.designer_sync).

create table public.request_designers (
  request_id uuid not null references public.requests (id) on delete cascade,
  designer_id uuid not null references public.designers (id),
  response text not null default 'pending' check (response in ('pending', 'accepted')),
  responded_at timestamptz,
  added_at timestamptz not null default clock_timestamp(),
  -- auth.users, not profiles: a link to profiles would make the app's
  -- profiles → designers lookups ambiguous.
  added_by uuid references auth.users (id) on delete set null,
  primary key (request_id, designer_id)
);

create index request_designers_designer_idx on public.request_designers (designer_id);

alter table public.request_designers enable row level security;

-- The Marketing team sees every request's designers; requesters see their own
-- requests' designers. Changes only go through the functions below.
create policy "request_designers: staff or requester" on public.request_designers
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.requests r where r.id = request_id and r.requester_id = (select auth.uid()))
  );

revoke insert, update, delete, truncate on public.request_designers from anon, authenticated;

alter table public.requests
  -- Everyone on the request, in the order they were added (pipeline tabs,
  -- filters and counts).
  add column designer_ids uuid[] not null default '{}',
  -- When the requester was told a designer accepted (sent once per request).
  add column accepted_notice_at timestamptz,
  -- The whole team was replaced after that: the requester hears about it when
  -- the first new designer accepts.
  add column designer_change_pending boolean not null default false;

create index requests_designer_ids_idx on public.requests using gin (designer_ids);

-- Existing requests: their designer becomes their first (and only) designer.
-- Triggers are off so nothing is logged and updated_at stays.
alter table public.requests disable trigger user;

insert into public.request_designers (request_id, designer_id, response, responded_at, added_at)
select r.id,
       r.assigned_designer_id,
       case when r.designer_response = 'accepted' or (r.designer_response is null and r.status <> 'new_request')
            then 'accepted' else 'pending' end,
       case when r.designer_response = 'accepted' or (r.designer_response is null and r.status <> 'new_request')
            then coalesce(r.designer_responded_at, r.updated_at) end,
       coalesce(
         (select max(l.created_at) from public.activity_log l
          where l.request_id = r.id and l.action = 'designer' and l.to_value is not null),
         r.created_at)
from public.requests r
where r.assigned_designer_id is not null;

update public.requests r set
  designer_ids = array[r.assigned_designer_id],
  designer_response = rd.response,
  designer_responded_at = rd.responded_at
from public.request_designers rd
where rd.request_id = r.id;

-- Requests where a designer ever accepted (or took it) already told the
-- requester.
update public.requests r set
  accepted_notice_at = coalesce(
    (select min(l.created_at) from public.activity_log l
     where l.request_id = r.id
       and (l.action = 'designer_accepted' or (l.action = 'designer' and l.note = 'Took the request'))),
    r.designer_responded_at)
where r.designer_response = 'accepted'
   or exists (select 1 from public.activity_log l
              where l.request_id = r.id
                and (l.action = 'designer_accepted' or (l.action = 'designer' and l.note = 'Took the request')));

alter table public.requests enable trigger user;

-- Recomputes a request's summary columns from request_designers and moves the
-- status: no designers → New request (unless Completed / closed); someone
-- accepted while it's a New request → Designer assigned.
-- p_announce: this change is an acceptance the requester should hear about.
-- Returns the designer to name in the requester's email: `first_accepted`
-- (the first acceptance on the request) or `team_changed` (the first new
-- designer after the whole team was replaced).
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

revoke execute on function public.sync_request_designers(uuid, boolean, text, boolean) from public, anon, authenticated;

-- Super Admins and Lead Designers: the request's designers become exactly
-- p_designer_ids (added in that order). Adding yourself counts as accepted;
-- others start as pending. Returns `added` (designers added by someone else,
-- for the assigned email) and sync_request_designers()'s result.
create or replace function public.set_request_designers(p_request_id uuid, p_designer_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  me uuid := (select d.id from public.designers d where d.user_id = auth.uid() and d.active);
  wanted uuid[];
  old_ids uuid[];
  pending_added uuid[] := '{}';
  d uuid;
  changed boolean := false;
begin
  if not public.is_manager() then
    raise exception 'Only Super Admins and Lead Designers can add or remove designers.' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status = 'completed' then
    raise exception 'This request is Completed, so its designers can''t be changed.' using errcode = '42501';
  end if;
  if r.status in ('cancelled', 'rejected') then
    raise exception 'This request is Cancelled or Returned, so its designers can''t be changed.'
      using errcode = '42501';
  end if;

  -- The new list without repeats, in the order given.
  select coalesce(array_agg(x order by o), '{}') into wanted
  from (select x, min(o) as o from unnest(coalesce(p_designer_ids, '{}')) with ordinality as u(x, o)
        where x is not null group by x) s;
  select coalesce(array_agg(designer_id), '{}') into old_ids
  from public.request_designers where request_id = r.id;

  -- Newly added people must be in the Designer list (former designers can
  -- stay on requests they already have).
  if exists (select 1 from unnest(wanted) x
             where not (x = any(old_ids))
               and not exists (select 1 from public.designers dd where dd.id = x and dd.active)) then
    raise exception 'Please choose designers from the Designer list.';
  end if;

  for d in
    select designer_id from public.request_designers
    where request_id = r.id and not (designer_id = any(wanted))
    order by added_at
  loop
    delete from public.request_designers where request_id = r.id and designer_id = d;
    insert into public.activity_log (request_id, actor_id, action, from_value)
    values (r.id, auth.uid(), 'designer_removed', (select display_name from public.designers where id = d));
    changed := true;
  end loop;

  foreach d in array wanted loop
    continue when d = any(old_ids);
    insert into public.request_designers (request_id, designer_id, response, responded_at, added_by)
    values (r.id, d, case when d = me then 'accepted' else 'pending' end,
            case when d = me then now() end, auth.uid());
    insert into public.activity_log (request_id, actor_id, action, to_value, note)
    values (r.id, auth.uid(), 'designer_added', (select display_name from public.designers where id = d),
            case when d = me then 'Added themselves' end);
    if d is distinct from me then pending_added := pending_added || d; end if;
    changed := true;
  end loop;

  if not changed then
    return jsonb_build_object('id', r.id, 'request_code', r.request_code, 'status', r.status, 'added', '[]'::jsonb);
  end if;

  -- The whole team replaced: none of the previous designers remain.
  return public.sync_request_designers(r.id, true, null, cardinality(old_ids) > 0 and not (old_ids && wanted))
    || jsonb_build_object('added', to_jsonb(pending_added));
end;
$$;

revoke execute on function public.set_request_designers(uuid, uuid[]) from public, anon;
grant execute on function public.set_request_designers(uuid, uuid[]) to authenticated;

-- Anyone in the Designer list: "Take this request" (a New request with no
-- designer) or "Add me as a designer" (once it has one, any status except
-- Completed, Cancelled and Returned). Both count as accepted. `took`: it was
-- a take (the requester hears about it); adding yourself sends no emails.
create or replace function public.add_me_as_designer(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  me uuid := (select d.id from public.designers d where d.user_id = auth.uid() and d.active);
  mine text;
  has_any boolean;
begin
  if me is null then
    raise exception 'Only people in the Designer list can add themselves to a request.' using errcode = '42501';
  end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status = 'completed' then
    raise exception 'This request is Completed, so its designers can''t be changed.' using errcode = '42501';
  end if;
  if r.status in ('cancelled', 'rejected') then
    raise exception 'This request is Cancelled or Returned, so its designers can''t be changed.'
      using errcode = '42501';
  end if;
  select response into mine from public.request_designers where request_id = r.id and designer_id = me;
  if mine = 'accepted' then raise exception 'You''re already a designer on this request.'; end if;
  if mine = 'pending' then raise exception 'You''re already on this request. Please use Accept.'; end if;
  has_any := exists (select 1 from public.request_designers where request_id = r.id);
  if not has_any and r.status <> 'new_request' then
    raise exception 'A Lead Designer assigns this request.' using errcode = '42501';
  end if;

  insert into public.request_designers (request_id, designer_id, response, responded_at, added_by)
  values (r.id, me, 'accepted', now(), auth.uid());
  insert into public.activity_log (request_id, actor_id, action, to_value, note)
  values (r.id, auth.uid(), 'designer_added', (select display_name from public.designers where id = me),
          case when has_any then 'Added themselves' else 'Took the request' end);

  return public.sync_request_designers(r.id, not has_any) || jsonb_build_object('took', not has_any);
end;
$$;

revoke execute on function public.add_me_as_designer(uuid) from public, anon;
grant execute on function public.add_me_as_designer(uuid) to authenticated;

-- A designer on the request answers for themselves: Accept, or Ask to
-- reassign (removes only them, with the reason; the last one leaving sends
-- the request back to New request).
create or replace function public.designer_respond(p_request_id uuid, p_accept boolean, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  me uuid;
  mine text;
  reason text := trim(coalesce(p_reason, ''));
  remaining boolean;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  select id into me from public.designers where user_id = auth.uid();
  select response into mine from public.request_designers where request_id = r.id and designer_id = me;
  if me is null or mine is null then
    raise exception 'Only a designer on this request can respond to it.' using errcode = '42501';
  end if;
  if mine <> 'pending' then
    raise exception 'You already responded to this request.';
  end if;
  if r.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'This request is closed, so it can''t be accepted or reassigned.';
  end if;

  if p_accept then
    update public.request_designers set response = 'accepted', responded_at = now()
    where request_id = r.id and designer_id = me;
    insert into public.activity_log (request_id, actor_id, action)
    values (r.id, auth.uid(), 'designer_accepted');
    return public.sync_request_designers(r.id, true);
  end if;

  if reason = '' then raise exception 'Please choose a reason for the reassignment.'; end if;
  delete from public.request_designers where request_id = r.id and designer_id = me;
  insert into public.activity_log (request_id, actor_id, action, note)
  values (r.id, auth.uid(), 'reassign_requested', reason);
  remaining := exists (select 1 from public.request_designers where request_id = r.id);
  -- The last designer leaving after the requester heard about one: the next
  -- designer to accept is a change of team.
  return public.sync_request_designers(r.id, false, reason, not remaining);
end;
$$;

revoke execute on function public.designer_respond(uuid, boolean, text) from public, anon;
grant execute on function public.designer_respond(uuid, boolean, text) to authenticated;

-- Staff cancel: a designer who hasn't accepted yet can't change the status
-- (owner, Nov 12). Otherwise as 0021.
create or replace function public.cancel_request(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  reason text := trim(coalesce(p_reason, ''));
begin
  if not public.is_staff() then
    raise exception 'Only the Marketing team can cancel requests here.' using errcode = '42501';
  end if;
  if reason = '' then raise exception 'Please add a note on why the request is cancelled.'; end if;
  if length(reason) > 1000 then raise exception 'Please keep the note under 1,000 characters.'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status = 'cancelled' then raise exception 'This request is already cancelled.'; end if;
  if not public.is_manager() and exists (
    select 1 from public.request_designers rd join public.designers d on d.id = rd.designer_id
    where rd.request_id = r.id and d.user_id = auth.uid() and rd.response = 'pending'
  ) then
    raise exception 'Please accept the request first; then you can change its status.' using errcode = '42501';
  end if;

  perform set_config('app.workflow', 'on', true);
  update public.requests set
    status = 'cancelled',
    cancel_reason = reason,
    cancelled_by = auth.uid()
  where id = r.id;
  perform set_config('app.workflow', 'off', true);

  insert into public.activity_log (request_id, actor_id, action, note)
  values (r.id, auth.uid(), 'cancelled', reason);
  return jsonb_build_object('id', r.id, 'request_code', r.request_code);
end;
$$;

revoke execute on function public.cancel_request(uuid, text) from public, anon;
grant execute on function public.cancel_request(uuid, text) to authenticated;

-- The request guard (latest: 0027). Changes from 0027:
-- * designer columns change only through sync_request_designers()
--   (app.designer_sync); a direct change is refused, and the old single-
--   designer rules (take / swap / remove) moved to the functions above;
-- * a designer who hasn't accepted yet can't change the status or links;
-- * designer changes are logged by the functions (designer_added /
--   designer_removed), not here.
create or replace function public.requests_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  staff_editable text[] := array[
    'status', 'link_to_output', 'updated_at', 'output_needed',
    'title', 'requester_name', 'team_id', 'date_needed', 'final_approver_name', 'final_approver_email',
    'is_deal', 'deal_name', 'deal_size', 'project_overview',
    'link_to_output_2', 'link_to_output_3', 'link_label_1', 'link_label_2', 'link_label_3'
  ];
  has_link boolean;
  requester_edit boolean := coalesce(current_setting('app.requester_edit', true), '') = 'on'
    and actor is not null and actor = old.requester_id;
  -- Set by designer_respond() / return_request() etc., which do their own checks.
  workflow boolean := coalesce(current_setting('app.workflow', true), '') = 'on';
  -- Set by sync_request_designers() only.
  designer_sync boolean := coalesce(current_setting('app.designer_sync', true), '') = 'on';
  old_text text;
  new_text text;
  auto_note text;
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

  if not designer_sync
     and (new.assigned_designer_id, new.designer_ids, new.designer_response, new.designer_responded_at,
          new.accepted_notice_at, new.designer_change_pending)
         is distinct from
         (old.assigned_designer_id, old.designer_ids, old.designer_response, old.designer_responded_at,
          old.accepted_notice_at, old.designer_change_pending) then
    raise exception 'Designers are added and removed with the Designers field on the request.'
      using errcode = '42501';
  end if;

  if actor is not null then
    new.date_started := old.date_started;
    new.date_completed := old.date_completed;

    if requester_edit then
      new.status := old.status;
      new.link_to_output := old.link_to_output;
      new.link_to_output_2 := old.link_to_output_2;
      new.link_to_output_3 := old.link_to_output_3;
      new.link_label_1 := old.link_label_1;
      new.link_label_2 := old.link_label_2;
      new.link_label_3 := old.link_label_3;
      new.return_reason := old.return_reason;
      new.reassign_reason := old.reassign_reason;
      new.returned_by := old.returned_by;
    elsif not workflow then
      if not public.is_manager() then
        if (to_jsonb(new) - staff_editable) is distinct from (to_jsonb(old) - staff_editable) then
          raise exception 'That field can''t be changed here.' using errcode = '42501';
        end if;
        -- A designer on the request who hasn't accepted yet (owner, Nov 12).
        if (new.status, new.link_to_output, new.link_to_output_2, new.link_to_output_3,
            new.link_label_1, new.link_label_2, new.link_label_3)
           is distinct from
           (old.status, old.link_to_output, old.link_to_output_2, old.link_to_output_3,
            old.link_label_1, old.link_label_2, old.link_label_3)
           and exists (
             select 1 from public.request_designers rd join public.designers d on d.id = rd.designer_id
             where rd.request_id = old.id and d.user_id = actor and rd.response = 'pending'
           ) then
          raise exception 'Please accept the request first; then you can change its status and links.'
            using errcode = '42501';
        end if;
      end if;
      -- Only a designer's Accept sets "Designer assigned (not yet started)",
      -- and Returned only comes from return_request() (with a reason).
      if new.status is distinct from old.status and new.status = 'designer_assigned' then
        raise exception 'This status is set automatically when the designer accepts.' using errcode = '42501';
      end if;
      if new.status is distinct from old.status and new.status = 'rejected' then
        raise exception 'Please use Return (with a reason) to return a request.' using errcode = '42501';
      end if;
      new.returned_by := old.returned_by;
      new.return_reason := old.return_reason;
    end if;
  end if;

  -- Cancelled and Returned requests are closed: no designer or link changes.
  if old.status in ('cancelled', 'rejected')
     and (new.designer_ids is distinct from old.designer_ids
          or nullif(trim(coalesce(new.link_to_output, '')), '') is distinct from old.link_to_output
          or nullif(trim(coalesce(new.link_to_output_2, '')), '') is distinct from old.link_to_output_2
          or nullif(trim(coalesce(new.link_to_output_3, '')), '') is distinct from old.link_to_output_3) then
    raise exception 'This request is Cancelled or Returned, so the designer and Link to Output can''t be changed.'
      using errcode = '42501';
  end if;

  -- The designers can't change once the request is Completed.
  if new.designer_ids is distinct from old.designer_ids and old.status = 'completed' then
    raise exception 'This request is Completed, so the designer can''t be changed.' using errcode = '42501';
  end if;

  if designer_sync then
    auto_note := nullif(current_setting('app.status_note', true), '');
  end if;

  -- Work statuses need a designer; review and completion need an output link
  -- (any one of the three, owner Nov 4).
  has_link := coalesce(nullif(trim(coalesce(new.link_to_output, '')), ''),
                       nullif(trim(coalesce(new.link_to_output_2, '')), ''),
                       nullif(trim(coalesce(new.link_to_output_3, '')), '')) is not null;
  if new.status is distinct from old.status then
    if new.assigned_designer_id is null
       and new.status in ('designer_assigned', 'in_progress', 'for_review', 'for_revision', 'completed') then
      raise exception 'Please assign a designer before setting this status.' using errcode = '42501';
    end if;
    if new.status = 'new_request' and new.assigned_designer_id is not null and new.designer_response = 'accepted' then
      raise exception 'The designer already accepted this request, so it can''t go back to New request.'
        using errcode = '42501';
    end if;
    if new.status in ('for_review', 'for_revision', 'completed') and not has_link then
      raise exception 'Please add the Link to Output before setting this status.' using errcode = '42501';
    end if;
  end if;

  new.link_to_output := nullif(trim(new.link_to_output), '');
  new.link_to_output_2 := nullif(trim(new.link_to_output_2), '');
  new.link_to_output_3 := nullif(trim(new.link_to_output_3), '');
  new.link_label_1 := nullif(trim(new.link_label_1), '');
  new.link_label_2 := nullif(trim(new.link_label_2), '');
  new.link_label_3 := nullif(trim(new.link_label_3), '');
  new.updated_at := now();

  if new.status is distinct from old.status then
    if new.status = 'in_progress' and old.date_started is null then
      new.date_started := now();
    end if;
    if new.status = 'completed' then
      new.date_completed := now();
    end if;
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value, note)
    values (new.id, actor, 'status', old.status::text, new.status::text, auto_note);
  end if;

  if new.link_to_output is distinct from old.link_to_output then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'link_to_output', old.link_to_output, new.link_to_output);
  end if;

  if new.link_to_output_2 is distinct from old.link_to_output_2 then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'link_to_output_2', old.link_to_output_2, new.link_to_output_2);
  end if;

  if new.link_to_output_3 is distinct from old.link_to_output_3 then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'link_to_output_3', old.link_to_output_3, new.link_to_output_3);
  end if;

  if new.date_needed is distinct from old.date_needed then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'date_needed', old.date_needed::text, new.date_needed::text);
  end if;

  if new.title is distinct from old.title then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'title', old.title, new.title);
  end if;

  if new.requester_name is distinct from old.requester_name then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'requester_name', old.requester_name, new.requester_name);
  end if;

  if new.team_id is distinct from old.team_id then
    select name into old_text from public.teams where id = old.team_id;
    select name into new_text from public.teams where id = new.team_id;
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'team', old_text, new_text);
  end if;

  if new.final_approver_name is distinct from old.final_approver_name
     or new.final_approver_email is distinct from old.final_approver_email then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'final_approver',
            old.final_approver_name || ' · ' || old.final_approver_email,
            new.final_approver_name || ' · ' || new.final_approver_email);
  end if;

  if new.is_deal is distinct from old.is_deal
     or new.deal_name is distinct from old.deal_name
     or new.deal_size is distinct from old.deal_size then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'deal',
            case when old.is_deal then old.deal_name || ' · ₱' || old.deal_size else 'Not a deal' end,
            case when new.is_deal then new.deal_name || ' · ₱' || new.deal_size else 'Not a deal' end);
  end if;

  if new.project_overview is distinct from old.project_overview then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'project_overview', old.project_overview, new.project_overview);
  end if;

  if new.output_needed is distinct from old.output_needed then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'output_needed', old.output_needed, new.output_needed);
  end if;

  return new;
end;
$$;

-- Privacy clean-up (latest: 0024): every designer on an old request becomes
-- the one "Former designer" row, and the new log entries lose their names too.
create or replace function public.anonymize_old_data()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  cutoff constant timestamptz := now() - interval '5 years';
  removed constant text := 'Removed after 5 years';
  former_designer uuid := (select id from public.designers where email = 'former-designer@example.invalid');
  ids uuid[];
  gone uuid;
  accounts int := 0;
begin
  select coalesce(array_agg(id), '{}') into ids
  from public.requests
  where anonymized_at is null
    and status in ('completed', 'cancelled', 'rejected')
    and updated_at < cutoff;

  -- The request rules (locked closed requests, the activity log) would refuse
  -- or log these edits, so they're off until the end of this run. Other
  -- changes wait for the run to finish (the tables are locked meanwhile).
  alter table public.requests disable trigger user;
  alter table public.request_answers disable trigger user;

  if cardinality(ids) > 0 then
    create temporary table anon_tags on commit drop as
    select r.id,
           r.requester_id,
           'Former requester #' || upper(substr(md5(coalesce(r.requester_id, r.id)::text), 1, 6)) as name,
           'former-requester-' || substr(md5(coalesce(r.requester_id, r.id)::text), 1, 6) || '@example.invalid' as email,
           lower(r.final_approver_email) = lower(r.requester_email) as approver_is_requester
    from public.requests r
    where r.id = any(ids);

    update public.activity_log l set
      actor_label = case
        when l.actor_id is null then l.actor_label
        when l.actor_id = t.requester_id then 'Former requester'
        else 'Former team member'
      end,
      actor_id = null,
      from_value = case
        when l.action = 'requester_name' then t.name
        when l.action = 'final_approver' then 'Former approver'
        when l.action in ('designer', 'designer_added', 'designer_removed') then
          case when l.from_value is not null then 'Former designer' end
        when l.action = 'project_overview' then null
        else l.from_value
      end,
      to_value = case
        when l.action = 'requester_name' then t.name
        when l.action = 'final_approver' then 'Former approver'
        when l.action in ('designer', 'designer_added', 'designer_removed') then
          case when l.to_value is not null then 'Former designer' end
        when l.action = 'project_overview' then null
        else l.to_value
      end,
      -- Automatic notes ("Automatic: …", "Took the request", "Added
      -- themselves") hold no names.
      note = case
        when l.note is null or l.note like 'Automatic:%'
          or l.note in ('Took the request', 'Added themselves') then l.note
        else removed
      end
    from anon_tags t
    where l.request_id = t.id;

    update public.request_answers a set value = case
      when q.field_type in ('short_text', 'long_text') then to_jsonb(removed)
      when jsonb_typeof(a.value) = 'string' and a.value #>> '{}' like 'Other:%' then to_jsonb('Other: ' || removed)
      when jsonb_typeof(a.value) = 'array' then coalesce(
        (select jsonb_agg(case when e like 'Other:%' then 'Other: ' || removed else e end)
         from jsonb_array_elements_text(a.value) e),
        '[]'::jsonb)
      else a.value
    end
    from public.form_questions q
    where q.id = a.question_id and a.request_id = any(ids);

    update public.feedback set comments = null where request_id = any(ids);

    update public.notifications_log set recipients = '{}', error = null where request_id = any(ids);

    -- All of a request's designers become one "Former designer" row.
    insert into public.request_designers (request_id, designer_id, response, responded_at, added_at)
    select request_id, former_designer,
           case when bool_or(response = 'accepted') then 'accepted' else 'pending' end,
           min(responded_at), min(added_at)
    from public.request_designers
    where request_id = any(ids) and designer_id <> former_designer
    group by request_id
    on conflict (request_id, designer_id) do nothing;
    delete from public.request_designers where request_id = any(ids) and designer_id <> former_designer;
    update public.request_designers set added_by = null where request_id = any(ids);

    update public.requests r set
      requester_name = t.name,
      requester_email = t.email,
      final_approver_name = case when t.approver_is_requester then t.name else 'Former approver' end,
      final_approver_email = case when t.approver_is_requester then t.email else 'former-approver@example.invalid' end,
      assigned_designer_id = case when r.assigned_designer_id is not null then former_designer end,
      designer_ids = case when cardinality(r.designer_ids) > 0 then array[former_designer] else '{}' end,
      project_overview = case when r.project_overview is not null then removed end,
      return_reason = case when r.return_reason is not null then removed end,
      reassign_reason = case when r.reassign_reason is not null then removed end,
      cancel_reason = case when r.cancel_reason is not null then removed end,
      returned_by = null,
      cancelled_by = null,
      anonymized_at = now()
    from anon_tags t
    where r.id = t.id;
  end if;

  for gone in
    select u.id
    from auth.users u
    where coalesce(u.last_sign_in_at, u.created_at) < cutoff
      and not exists (select 1 from public.team_members m where m.email = lower(u.email))
      and not exists (select 1 from public.requests r where r.requester_id = u.id and r.anonymized_at is null)
  loop
    -- One account that can't be deleted doesn't stop the rest.
    begin
      update public.requests set requester_id = null where requester_id = gone;
      update public.activity_log set actor_label = coalesce(actor_label, 'Former user'), actor_id = null
      where actor_id = gone;
      delete from auth.users where id = gone;
      accounts := accounts + 1;
    exception when others then
      raise warning 'anonymize_old_data: account % was not deleted: %', gone, sqlerrm;
    end;
  end loop;

  alter table public.requests enable trigger user;
  alter table public.request_answers enable trigger user;

  return jsonb_build_object('requests', cardinality(ids), 'accounts', accounts);
end;
$$;

revoke execute on function public.anonymize_old_data() from public, anon, authenticated;
