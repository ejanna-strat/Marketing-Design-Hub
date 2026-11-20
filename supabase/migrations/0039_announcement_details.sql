-- Owner, Nov 20: an announcement's button can open a link or a longer
-- message (a pop-up). The message uses the FAQ formatting codes
-- (src/lib/faq-format.ts): bold, italic, underline, links and bullets.

alter table public.announcements
  add column details text check (details is null or length(trim(details)) between 1 and 5000);

-- A button has text and exactly one of: a link, or the longer message.
alter table public.announcements drop constraint announcements_check1;
alter table public.announcements
  add constraint announcements_button_check check (
    (link_label is null and link_url is null and details is null)
    or (link_label is not null and ((link_url is null) <> (details is null)))
  );
