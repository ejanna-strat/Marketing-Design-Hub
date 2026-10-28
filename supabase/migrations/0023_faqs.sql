-- Owner, Oct 28: FAQs for requesters on the home page. Super Admins, Admins
-- and Lead Designers edit them in Settings → Requester FAQs.
-- Answers allow **bold**, [link text](https://…), "- " bullet lines and
-- blank lines between paragraphs (src/components/FaqAnswer.tsx).

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(trim(question)) between 1 and 300),
  answer text not null check (length(trim(answer)) between 1 and 5000),
  position int not null,
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);
create index faqs_position_idx on public.faqs (position);

alter table public.faqs enable row level security;
revoke all on public.faqs from anon;
create policy "faqs: read" on public.faqs for select to authenticated
  using (visible or (select public.can_manage_members()));
create policy "faqs: manager insert" on public.faqs for insert to authenticated
  with check ((select public.can_manage_members()));
create policy "faqs: manager update" on public.faqs for update to authenticated
  using ((select public.can_manage_members())) with check ((select public.can_manage_members()));
create policy "faqs: manager delete" on public.faqs for delete to authenticated
  using ((select public.can_manage_members()));

insert into public.faqs (position, question, answer) values
(1, 'How do I submit a design request?', $$Click **New Design Request** on the home page.

- Fill in the General Information (title, overview, Date Needed and so on).
- Pick the Type of Request. Its questions appear below it.
- Answer every question. If one doesn't apply, write N/A.
- Click **Submit**.

You'll see your Request ID (it starts with MDR-). Keep it handy: you'll use it to track the request and share feedback.$$),

(2, 'Does submitting mean my request is accepted?', $$No. Every request is reviewed by the Marketing Brand Team first.

- If it's accepted, you'll get an email once a designer accepts it and starts on it.
- If it's returned, you'll get an email with the reason. A returned request can't be reopened, so submit a new one with the changes.$$),

(3, 'How long will my request take?', $$It depends on the type of design. See the timelines on [See Design SLAs](https://sites.google.com/stratpoint.com/marketing-hub/templates/design-requests/service-level-agreement), also on the home page.

Please set your Date Needed with these timelines in mind, and submit your request as early as you can.$$),

(4, 'How do I track my request, and what does each status mean?', $$Open **Track My Request** on the home page to see every request you filed. Click a request to see its details, its designer and the Link to Output.

- **New request:** received, waiting for review and a designer.
- **Designer assigned (not yet started):** a designer accepted your request.
- **In progress:** the designer is working on it.
- **For requester's review:** the output is ready. Open the Link to Output and tell your designer if it's good to go or needs changes.
- **For revision:** the designer is working on your requested changes.
- **Completed:** the final output is approved and delivered.
- **On hold:** paused for now.
- **Returned:** sent back to you by the team, with the reason.
- **Cancelled:** the request was cancelled, with a note.$$),

(5, 'Can I edit or cancel my request after submitting?', $$**Edit:** yes, while it's still a New request and no designer has been assigned. Open it from **Track My Request** and click **Edit request**. After a designer is assigned, contact them for any changes. The Type of Request can't be changed; submit a new request instead.

**Cancel:** yes, any time before it's Completed. Open it from **Track My Request**, click **Cancel request** and give a reason. If a designer is assigned, they're notified.$$),

(6, 'Why didn''t I get an email?', $$Our emails come from **marketingcreativehub@ejoo.site** and sometimes land in Spam or Junk.

- Check your Spam or Junk folder and mark the email as "Not spam".
- Add marketingcreativehub@ejoo.site to your contacts so future emails reach your inbox.
- Make sure you signed up with your main @stratpoint.com email, not an alias.

You can always see the latest status on **Track My Request**, even without the email.$$),

(7, 'How do I give feedback on a finished request?', $$Once your request is Completed, you'll get an email with a link to the feedback form. You can also:

- click **Share Feedback** on the home page and pick your request, or
- open **Track My Request** and click **Share feedback** beside the completed request.

Rate the request process and the design output, and add comments if you like. It takes about a minute.$$),

(8, 'Who do I contact if I have a concern?', $$For anything about a specific request, contact its assigned designer. Their name shows on the request in **Track My Request**.

For other concerns, contact Jerome Casupanan at [jerome.casupanan@stratpoint.com](mailto:jerome.casupanan@stratpoint.com).$$);
