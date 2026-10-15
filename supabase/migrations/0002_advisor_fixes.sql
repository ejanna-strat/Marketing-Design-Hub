-- Fixes from the Supabase security/performance advisors after 0001.

-- Lock the search path of the sign-up hook.
alter function public.hook_restrict_signup_domain(jsonb) set search_path = '';

-- has_role is only used inside is_admin(); nobody needs to call it directly.
revoke execute on function public.has_role(public.app_role) from authenticated;

-- Evaluate auth.uid() once per query instead of once per row.
drop policy "profiles: own or staff" on public.profiles;
create policy "profiles: own or staff" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

drop policy "user_roles: own or staff" on public.user_roles;
create policy "user_roles: own or staff" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy "requests: own or staff" on public.requests;
create policy "requests: own or staff" on public.requests for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.is_staff()));

drop policy "requests: staff update" on public.requests;
create policy "requests: staff update" on public.requests for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy "request_answers: own or staff" on public.request_answers;
create policy "request_answers: own or staff" on public.request_answers for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.requests r
      where r.id = request_answers.request_id and r.requester_id = (select auth.uid())
    )
  );

drop policy "activity_log: staff" on public.activity_log;
create policy "activity_log: staff" on public.activity_log for select to authenticated
  using ((select public.is_staff()));

drop policy "team_members: admin" on public.team_members;
create policy "team_members: admin" on public.team_members for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Reference lists: one read policy, plus separate admin insert/update/delete
-- (instead of an "all" policy that also overlaps the read policy).
do $$
declare
  t text;
begin
  foreach t in array array['teams', 'request_types', 'form_questions', 'designers'] loop
    execute format('drop policy %I on public.%I', t || ': admin write', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      t || ': admin insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || ': admin update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
      t || ': admin delete', t);
  end loop;
end;
$$;

-- Indexes for foreign keys.
create index activity_log_actor_idx on public.activity_log (actor_id);
create index profiles_team_idx on public.profiles (team_id);
create index request_answers_question_idx on public.request_answers (question_id);
