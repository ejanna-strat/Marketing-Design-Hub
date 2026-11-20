-- Owner, Nov 20: the green banner colour becomes pink.

alter table public.announcements drop constraint announcements_tone_check;
update public.announcements set tone = 'pink' where tone = 'green';
alter table public.announcements
  add constraint announcements_tone_check check (tone in ('blue', 'pink', 'amber', 'neutral'));
