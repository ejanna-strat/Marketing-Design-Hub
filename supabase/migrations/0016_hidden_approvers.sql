-- Owner, Oct 22: people can remove a past approver from their Approver Name
-- suggestions. Stored per person as { "approver email": "hidden at" }; an
-- approver used again after that time shows up again.

alter table public.profiles
  add column hidden_approvers jsonb not null default '{}'::jsonb;

grant update (hidden_approvers) on public.profiles to authenticated;
