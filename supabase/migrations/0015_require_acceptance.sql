-- Owner, Oct 22: the assigned designer must accept the request before it can
-- move to In progress, For requester's review, For revision or Completed.
-- Runs after requests_before_update (triggers fire in name order).

-- Older requests assigned before the Accept button existed count as accepted.
update public.requests
   set designer_response = 'accepted'
 where assigned_designer_id is not null
   and designer_response is null
   and status <> 'new_request';

create or replace function public.requests_require_acceptance()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('in_progress', 'for_review', 'for_revision', 'completed')
     and new.designer_response is distinct from 'accepted' then
    raise exception 'The assigned designer needs to accept the request first.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger requests_require_acceptance
  before update on public.requests
  for each row execute function public.requests_require_acceptance();
