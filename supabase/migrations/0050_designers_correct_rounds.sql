-- Owner, Nov 27: the request's own designers (who accepted it) can also move
-- it back to an earlier review round to correct a mistake, not only Super
-- Admins and Lead Designers. Otherwise the same as 0049.

create or replace function public.requests_review_rounds()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  stage int;
  workflow boolean := coalesce(current_setting('app.workflow', true), '') = 'on';
begin
  -- Only this trigger moves these two.
  new.review_round := old.review_round;
  new.first_draft_at := old.first_draft_at;

  if (new.first_draft_due is distinct from old.first_draft_due or new.date_needed is distinct from old.date_needed)
     and new.first_draft_due is not null and new.first_draft_due > new.date_needed then
    raise exception 'The First Draft Deadline must be on or before the Final Deadline.';
  end if;
  if new.first_draft_due is distinct from old.first_draft_due then
    insert into public.activity_log (request_id, actor_id, action, from_value, to_value)
    values (new.id, auth.uid(), 'first_draft_due', old.first_draft_due::text, new.first_draft_due::text);
  end if;

  if new.status is distinct from old.status then
    stage := case new.status::text
      when 'for_review' then 1 when 'for_review_v2' then 2 when 'for_review_v3' then 3 end;
    if stage is not null then
      if stage > old.review_round + 1 then
        raise exception '%', case stage
          when 2 then 'Please send the 1st draft for review first.'
          else 'Please send V2 for review first.' end
          using errcode = '42501';
      end if;
      if stage < old.review_round and not workflow and not public.is_manager()
         and not exists (
           select 1 from public.request_designers rd join public.designers d on d.id = rd.designer_id
           where rd.request_id = old.id and d.user_id = auth.uid() and rd.response = 'accepted'
         ) then
        raise exception 'This request is already past that review round. Its designers or a Lead Designer can correct it.'
          using errcode = '42501';
      end if;
      new.review_round := stage;
      if stage = 1 and old.first_draft_at is null then
        new.first_draft_at := now();
      end if;
    elsif old.review_round >= 3 and new.status in ('in_progress', 'for_revision') and not workflow then
      raise exception 'V3 is the last review round. From here the request can only be Completed, put On hold or cancelled.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
