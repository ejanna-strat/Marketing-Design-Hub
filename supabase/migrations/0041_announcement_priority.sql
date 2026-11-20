-- Owner, Nov 20: announcements are tagged by priority, and the colour
-- follows it: urgent (pink), important (amber), new (blue), fyi (grey).
-- Higher priority shows first; urgent banners can't be closed.

alter table public.announcements rename column tone to priority;
alter table public.announcements drop constraint announcements_tone_check;
update public.announcements
  set priority = case priority
    when 'pink' then 'urgent'
    when 'amber' then 'important'
    when 'neutral' then 'fyi'
    else 'new'
  end;
alter table public.announcements alter column priority set default 'new';
alter table public.announcements
  add constraint announcements_priority_check check (priority in ('urgent', 'important', 'new', 'fyi'));
