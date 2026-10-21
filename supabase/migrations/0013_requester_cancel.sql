-- Owner, Oct 21:
-- * Requesters can cancel their own request (any status except Completed,
--   Cancelled and Returned) with a reason.
-- * Once a request is Cancelled or Returned, its details and specification
--   answers are locked; only the status can still change (to reopen it).

alter table public.requests
  add column cancel_reason text,
  add column cancelled_by uuid references auth.users (id);

create or replace function public.cancel_my_request(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
  reason text := trim(coalesce(p_reason, ''));
begin
  if reason = '' then raise exception 'Please give the reason for cancelling the request.'; end if;
  if length(reason) > 1000 then raise exception 'Please keep the reason under 1,000 characters.'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.requester_id is distinct from auth.uid() then
    raise exception 'Request not found.' using errcode = '42501';
  end if;
  if r.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'This request can no longer be cancelled.';
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
  return jsonb_build_object('id', r.id, 'request_code', r.request_code, 'had_designer', r.assigned_designer_id is not null);
end;
$$;

revoke execute on function public.cancel_my_request(uuid, text) from public, anon;
grant execute on function public.cancel_my_request(uuid, text) to authenticated;

-- Details of Cancelled / Returned requests can't change (the status can).
-- Runs after requests_before_update (triggers fire in name order).
create or replace function public.requests_lock_closed()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status in ('cancelled', 'rejected')
     and (new.title, new.requester_name, new.team_id, new.date_needed, new.final_approver_name,
          new.final_approver_email, new.is_deal, new.deal_name, new.deal_size, new.output_needed)
         is distinct from
         (old.title, old.requester_name, old.team_id, old.date_needed, old.final_approver_name,
          old.final_approver_email, old.is_deal, old.deal_name, old.deal_size, old.output_needed) then
    raise exception 'This request is Cancelled or Returned, so its details can''t be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger requests_lock_closed
  before update on public.requests
  for each row execute function public.requests_lock_closed();

-- Same for specification answers (deleting still works, e.g. when a request
-- is removed).
create or replace function public.request_answers_lock_closed()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.requests where id = new.request_id and status in ('cancelled', 'rejected')) then
    raise exception 'This request is Cancelled or Returned, so its details can''t be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger request_answers_lock_closed
  before insert or update on public.request_answers
  for each row execute function public.request_answers_lock_closed();
