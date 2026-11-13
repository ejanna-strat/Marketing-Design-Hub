-- Owner, Nov 13: Links to Output can be added or changed only once the
-- request has been In progress (date_started is set the first time it is).
-- That covers In progress, For requester's review, For revision, Completed,
-- and On hold after work started; not New request, Designer assigned, or On
-- hold before work started. Existing links stay as they are. Runs after
-- requests_before_update (name order), so a save that also moves the status
-- to In progress already has date_started.

create or replace function public.requests_links_need_work()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.date_started is null
     and (new.link_to_output, new.link_to_output_2, new.link_to_output_3,
          new.link_label_1, new.link_label_2, new.link_label_3)
         is distinct from
         (old.link_to_output, old.link_to_output_2, old.link_to_output_3,
          old.link_label_1, old.link_label_2, old.link_label_3) then
    raise exception 'Set the request to In progress first; then you can add the Link to Output.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.requests_links_need_work() from public, anon, authenticated;

create trigger requests_links_need_work
  before update on public.requests
  for each row execute function public.requests_links_need_work();
