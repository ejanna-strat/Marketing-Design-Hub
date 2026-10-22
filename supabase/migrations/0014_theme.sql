-- Owner, Oct 22: each person chooses Light, Dark or System (follows their
-- computer). Saved on their profile so it follows them on any device.

alter table public.profiles
  add column theme text not null default 'light' check (theme in ('light', 'dark', 'system'));

-- People can update their own name (0007) and now their theme.
grant update (theme) on public.profiles to authenticated;
