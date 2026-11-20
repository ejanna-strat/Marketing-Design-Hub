-- Owner, Nov 20: Admins who aren't in the Designer list (and aren't Lead
-- Designers or Super Admins) no longer put requests On hold or cancel them,
-- so the Design team has more say in Creative Hub than Admins. They still see
-- everything, edit the details and the Link to Output, manage Members and
-- post announcements. An Admin who is also a Designer keeps the Designer's
-- rights.

-- True for an Admin with no Designer, Lead Designer or Super Admin role.
create or replace function public.is_admin_only()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
     and not public.is_manager()
     and not exists (select 1 from public.designers d where d.user_id = auth.uid() and d.active);
$$;
revoke execute on function public.is_admin_only() from public, anon;
grant execute on function public.is_admin_only() to authenticated;

create or replace function public.requests_admin_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null
     or coalesce(current_setting('app.workflow', true), '') = 'on'
     or not public.is_admin_only() then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only the Design team changes a request''s status.' using errcode = '42501';
  end if;
  if new.assigned_designer_id is distinct from old.assigned_designer_id then
    raise exception 'Only the Design team can change the designer.' using errcode = '42501';
  end if;
  return new;
end;
$$;

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
  if public.is_admin_only() then
    raise exception 'Only the Design team can cancel requests.' using errcode = '42501';
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
