-- Owner, Nov 12: "Add me as a designer" sends the requester's Accepted
-- email when it is the request's first acceptance (once per request, so a
-- later accept by someone else sends nothing), and counts as the first new
-- acceptance after the whole team was replaced, like any accept. Otherwise
-- Add me still sends nothing.

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

  -- Announced either way: if this is the request's first acceptance, the
  -- requester gets the Accepted email (owner, Nov 12).
  return public.sync_request_designers(r.id, true) || jsonb_build_object('took', not has_any);
end;
$$;
