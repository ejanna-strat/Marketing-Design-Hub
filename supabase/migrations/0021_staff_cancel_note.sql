-- Owner, Oct 22: when the Marketing team cancels a request, a note is
-- required (cancel_request()). Nobody is emailed; the requester sees the
-- note on their request page. Reopening a cancelled request clears it.

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

-- Signed-in people can only cancel through cancel_request() or
-- cancel_my_request() (both give a reason). Leaving Cancelled clears it.
create or replace function public.requests_cancel_note()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and auth.uid() is not null
     and coalesce(current_setting('app.workflow', true), '') <> 'on' then
    raise exception 'Please add a note on why the request is cancelled.' using errcode = '42501';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    new.cancel_reason := null;
    new.cancelled_by := null;
  end if;
  return new;
end;
$$;

create trigger requests_cancel_note
  before update on public.requests
  for each row execute function public.requests_cancel_note();
