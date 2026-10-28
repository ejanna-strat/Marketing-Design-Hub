-- Owner, Oct 28: privacy clean-up, once a month (pg_cron). Can't be undone.
-- * 5 years after a request was closed (Completed, Cancelled or Returned,
--   counted from its last change), the people on it are replaced:
--   requester → "Former requester #3FA91C" (the same tag for the same person),
--   final approver → "Former approver" (or the requester's tag if it was
--   them), designer → "Former designer" (on that request only). Its activity
--   log shows "Former requester" / "Former team member", the email log loses
--   its recipients, and free text (text answers, "Other:" answers, Project
--   Overview, feedback comments, return / reassign / cancel reasons and log
--   notes) becomes "Removed after 5 years". Ratings, dates, type, team,
--   status, title and Request ID stay, so Analytics still adds up.
-- * Accounts with no sign-in for 5 years are deleted, except people on the
--   Marketing team list (Settings → Members) and anyone with a request that
--   isn't anonymized yet. Their old requests and feedback stay, unlinked.
-- The requester still sees their own name on their own old requests (the app
-- fills it in from their account).

create extension if not exists pg_cron with schema pg_catalog;

alter table public.requests add column anonymized_at timestamptz;
-- Who did it, once the person behind actor_id is anonymized or deleted.
alter table public.activity_log add column actor_label text;

-- Deleting an account keeps its old requests and feedback.
alter table public.requests alter column requester_id drop not null;
alter table public.feedback alter column requester_id drop not null;
alter table public.feedback drop constraint feedback_requester_id_fkey,
  add constraint feedback_requester_id_fkey
    foreign key (requester_id) references public.profiles (id) on delete set null;
alter table public.requests drop constraint requests_cancelled_by_fkey,
  add constraint requests_cancelled_by_fkey
    foreign key (cancelled_by) references auth.users (id) on delete set null;

-- Old requests point here instead of their designer. Hidden like any former
-- designer, and no account can match its address.
insert into public.designers (email, display_name, active)
values ('former-designer@example.invalid', 'Former designer', false)
on conflict (email) do nothing;

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
      from_value = case l.action
        when 'requester_name' then t.name
        when 'final_approver' then 'Former approver'
        when 'designer' then case when l.from_value is not null then 'Former designer' end
        when 'project_overview' then null
        else l.from_value
      end,
      to_value = case l.action
        when 'requester_name' then t.name
        when 'final_approver' then 'Former approver'
        when 'designer' then case when l.to_value is not null then 'Former designer' end
        when 'project_overview' then null
        else l.to_value
      end,
      -- Automatic notes ("Automatic: …", "Took the request") hold no names.
      note = case
        when l.note is null or l.note like 'Automatic:%' or l.note = 'Took the request' then l.note
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

    update public.requests r set
      requester_name = t.name,
      requester_email = t.email,
      final_approver_name = case when t.approver_is_requester then t.name else 'Former approver' end,
      final_approver_email = case when t.approver_is_requester then t.email else 'former-approver@example.invalid' end,
      assigned_designer_id = case when r.assigned_designer_id is not null then former_designer end,
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

-- 1st of every month, 18:00 UTC (2AM on the 2nd, Manila time).
select cron.schedule('anonymize-old-data', '0 18 1 * *', $$select public.anonymize_old_data()$$);
