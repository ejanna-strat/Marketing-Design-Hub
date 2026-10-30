-- Owner, Oct 30: Admins who aren't in the Designer list (and aren't Lead
-- Designers or Super Admins) no longer move requests through the work
-- statuses. They can still put a request On hold or cancel it (with a note,
-- through cancel_request()), edit the details and the Link to Output, but not
-- change the designer. An Admin who is also a Designer keeps the Designer's
-- rights.

create or replace function public.requests_admin_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null
     or coalesce(current_setting('app.workflow', true), '') = 'on'
     or not public.is_admin()
     or public.is_manager()
     or exists (select 1 from public.designers d where d.user_id = auth.uid() and d.active) then
    return new;
  end if;
  if new.status is distinct from old.status and new.status not in ('on_hold', 'cancelled') then
    raise exception 'Admins can put a request On hold or cancel it; the designer changes the other statuses.'
      using errcode = '42501';
  end if;
  if new.assigned_designer_id is distinct from old.assigned_designer_id then
    raise exception 'Only the Design team can change the designer.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger requests_admin_limits
  before update on public.requests
  for each row execute function public.requests_admin_limits();
