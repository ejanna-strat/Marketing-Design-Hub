# Progress

_Last updated: Oct 21, 2026 · version 0.22.3_

## Done
- Phase 0: Next.js + TypeScript + Tailwind + shadcn/ui starter app; `dev` and `staging` branches (branch flow in CLAUDE.md §14).
- Phase 0: `.env.local` has the Supabase URL, anon key and service role key. Supabase MCP connected.
- Phase 1 Step 1: database schema, triggers and Row Level Security (`0001_schema.sql`, `0002_advisor_fixes.sql`).
- Phase 1 Step 2: seed data (`0003_seed.sql`) and the first team roster.
- Phase 1 Step 3: sign-in with a magic link or 6-digit code (`/login`, `/auth/confirm`). Signed-out visitors are sent to `/login`; non-@stratpoint.com emails are refused.
- Phase 1 Step 4: app shell. Home page with the four actions (Share Feedback and See Design SLAs show "Coming soon"), top bar with sign out, staff-only area at `/admin` with the left menu.
- Phase 1 Step 5: New Design Request form (`/requests/new`) for all 10 types, checked in the browser and again on the server; Request Submitted page.
- Phase 1 Step 6: My Design Requests (`/my-requests`) with search, status/type/date filters, sorting and paging; read-only details page. Rejected shows as "Returned" to requesters.
- Phase 1 Step 7: Marketing Design Pipeline (`/admin/pipeline`) with every column, filters (status, designer, team, type, date) and inline Status / Designer (admins) / Link to Output.
- Phase 1 Step 8: admin Request Details (`/admin/requests/MDR-…`) with Date Needed editing (admins), Date Started/Completed and the activity log.
- Phase 1 Step 9: emails N1 (new request → designers + Riann) and N8 (Completed → requester, once only), logged in `notifications_log`, test mode on.
- Fixed: the app showed a serif font instead of Geist.
- Tested locally against the real database: login, roles, all 10 request types (MDR-26-0001…0010), requester isolation (UI and database), pipeline editing, designer limits, activity log, N1/N8 logging and no double N8. Test data was removed afterwards; numbering restarts at MDR-26-0001.
- Steps 3–9 merged into `dev` and `staging`.
- v0.4.0: See Design SLAs on the home page links to the Marketing Hub SLA page (owner request, Oct 16).
- v0.5.0: new New Design Request intro text; "SLAs" on the form links to the SLA page (owner request, Oct 16).
- v0.6.0: Settings → Members (pulled forward from Phase 5, owner decision Oct 16). New Lead Designer tag (Jerome, Steve); Admins and Lead Designers manage members; N1 goes to Lead Designers + "Gets team emails". Owner's account is an Admin.
- v0.7.0: requesters can edit a request until it is accepted; note about this at the bottom of the form; Mandatory graphics, Design pegs/graphics and Other important information are now required; **Track My Request** in bold (owner requests, Oct 16).
- v0.8.0: sign up / sign in with email + password (email confirmed once at sign-up), Forgot password. Replaces the email link/code (owner decision, Oct 16). **Owner:** update Supabase settings and the two email templates (steps 2 and 4 of `docs/supabase-auth-setup.md`), then set your own password with Forgot password.
- v0.8.1: faster pages: server moved to Singapore (next to the database), sessions checked without a round trip, fewer queries per page, loading skeletons, smaller pages (home 193 → 108 KB). Separate **staging** Supabase project (`usnjrpnwhqascimtbzqk`) with all migrations, seed data, the team list and sign-in settings; staging/previews and local development use it, production keeps `ejkmuekrulshkmccjtxb`.
- v0.9.0: show/hide eye on password fields; Marketing Design Hub favicon (owner requests, Oct 16). Request numbers checked: one continuous series per year for everyone (MDR-26-0001, 0002, … then MDR-27-0001 in 2027); staging and production each keep their own series.
- v0.10.0: light bulb + pen app icon (no background in the tab, blue tile on iPhone); masters in `docs/brand/` (owner choice, Oct 16).
- v0.11.0 (owner list, Oct 17): spam heads-up on sign in/sign up/home/Request Submitted; all Marketing team members can edit the title and General Information (incl. Date Needed); automatic status when a designer is assigned/removed; "Rejected" shown as "Returned", Cancelled in the same red; every specification question required; tip above Submit; Save faded until changes + unsaved-changes prompt; removable filter tags; full-width tables/details; owner's icon; blue #0046bf brand; Inter bold app name; Change my name.
- v0.12.0 (owner list, Oct 18): staff can edit specifications (Output Needed follows the starred answer); leave prompts on the New Design Request form, spec editor and Edit details (pop-up layout fixed); Clear filters on the filter-tag row; work statuses need a designer first; refreshed email design (logo title, status tag, centred) with feedback in N8; branded sign-up/reset emails; **Feedback** pulled forward from Phase 3 (form, Share Feedback from home / request page / N8, Overall Feedback columns, team Feedback page); requester request page in the form-like layout; copy button for the approver's email; designer tabs in the pipeline; Jerome Casupanan in bold.
- v0.13.0 (owner list, Oct 18): **Phase 2 workflow** (reviewer Accept & assign / Return with reason; designer Accept / Ask to reassign; emails N2, N3, N4, N6, N7; Returned view for requesters; Link to Output required for For requester's review and Completed; designer locked once Completed; "Designer assigned" only from the designer's Accept). **Dashboard and Pendings** pulled forward from Phase 4 (Recharts added). Wider search (type, output, designer), sender name in the spam note, copy button for the requester's email, Feedback page filters.
- v0.14.0 (owner list, Oct 20): **deal requests** (tick box on the form + Deal Name + Deal Size in whole pesos; shown on request pages, editable by staff; Deal Requests page with Deal Name / Deal Size columns); **Inactive Requests** page for Cancelled and Returned (removed from the pipeline); Open / Completed / All switch (Open by default) on every pipeline tab; tick-box filters (several values); rows per page (10/25/50/100) on the pipeline, My Requests and Feedback; search matches highlighted; Pendings menu expands with counts per category; back link returns to the list you came from; Return hidden once a designer is assigned; For revision also needs a Link to Output; no N-codes in the app; new spam-note wording, full width on home; Feedback page summary first; dashboard with completion and inactive rates, deals summary, team donut + table, top 5 types and status shares in %.
- v0.15.0 (owner list, Oct 21): **Analytics** page pulled forward from Phase 4 (month by month for the year, brand team and designer productivity, deals by request type, CSV export); **3-day deadline reminder** pulled forward from Phase 3 (weekdays 8AM Manila via Vercel Cron; skipped for On hold, Cancelled, Returned, Completed); For revision and New request (after the designer accepts) greyed out; Cancelled/Returned requests keep their designer and link; New request shows at once after removing the designer; greyed-out status filter options; Deal Requests summary boxes + read-only table; Inactive Requests summary boxes; deal question is a required Yes / No with a description; "Associated Deal" label; designer email (with copy) for requesters; reviewer name in bold + email on returned requests and in the Returned email; Assigned Designer in the Accepted email; Initial Design Output Ready button opens the output and the Request ID links to the request; tab name always "Marketing Design Hub"; spam note on two lines; dashboard full labels, feedback link + response rate, donut pop-up fix.
- v0.16.0 (owner list, Oct 21, second round): Link to Output must be a web link; pipeline opens on All + Open for everyone with open counts on each designer tab and the total/unassigned in the subtitle; On Hold view (no longer under Open); toolbar on one row with a Request date button; dashboard status rows open the matching page; feedback note without "this year"; Request ID underlined in the Initial Design Output Ready email. Assignment emails still go out for On hold requests (owner decision).
- v0.17.0 (owner list, Oct 21, third round): Analytics tabs — Monthly report (last month by default, month list or custom range) and Month on Month (full year, year picker); same reports on both, month-by-month only on Month on Month; no CSV export. Dashboard: Pendings on the left, highlighted when a category has requests.
- v0.18.0 (owner list, Oct 21, fourth round): star rating only changes on click (faint hover preview + "Click to rate"); feedback form intro shortened; Feedback page note without the response count; deal totals leave out Returned and Cancelled (Dashboard and Analytics); Monthly report's Designer Productivity rebuilt around completed work (by type, total, open at month-end, turnaround, feedback "x ★ (n of m)"); Month on Month keeps its table.
- v0.19.0 (owner list, Oct 21, fifth round): Inactive Requests gets a Deal Associated column + filter and drops Link to Output / Overall Feedback; My Requests has Open / On Hold / Completed / Inactive / All; star text shortened; Analytics opens on the current month and year, three summary cards, "Open at the end" = New request to For revision, Requests by status on both tabs, "Monthly Pipeline Summary" + Key insights, frozen Designer column, Inactive Requests section.
- v0.20.0 (owner list, Oct 21, sixth round): requesters can cancel a request (reason required) any time before Completed, emailing the assigned designer if there is one; Cancelled/Returned requests are read-only except the status; Edit Request explains how to change the type; view switch shown as separate buttons with "Show:"; Analytics section bands + "Jump to" menu.
- v0.21.0 (owner list, Oct 21, seventh round): Inactive Requests shows who cancelled or returned each request; Requester's Email column removed from the staff tables; view switch restyled as one rounded bar with a filled pill.
- v0.22.0 (owner, Oct 21): Team and Type filters grey out options with no requests in the current tab/view (Pipeline, Deal Requests, My Requests), like Status.
- v0.22.1: the deal question and request pages say "None" instead of "No" (owner, Oct 21).
- v0.22.3: search boxes just say "Search" (owner, Oct 21).
- **Pending on production:** migrations `0007_staff_edits_auto_status.sql`, `0008_specs_status_feedback.sql`, `0009_phase2_workflow.sql`, `0010_deals.sql`, `0011_closed_requests.sql`, `0012_output_link_check.sql` and `0013_requester_cancel.sql` are applied to staging only. **Owner:** add `CRON_SECRET` (any long random text) to Vercel's Production environment so the daily reminder can run; Vercel only runs scheduled jobs on Production. At release also: create a public `brand` storage bucket with `logo.png` in production (emails load the logo from it) and paste `docs/emails/*.html` into production's Supabase email templates.
- (older note) migration `0007_staff_edits_auto_status.sql` is applied to staging only. Apply it to production when `staging` is merged into `main`. Production's Supabase email templates also still use the old purple button colour (update them from `docs/supabase-auth-setup.md`).

## Next (owner)
1. **Vercel:** connect the GitHub repo and set the environment variables for Preview (staging) and Production. See "Owner setup" below.
2. **Supabase dashboard:** follow `docs/supabase-auth-setup.md` (sign-up hook, redirect URLs, email template, session length).
3. **Resend (done Oct 16):** sending from `marketingdesignhub@ejoo.site` (owner's domain, verified in Resend). The key is in `.env.local` and Vercel (Sensitive), and test mode still sends every app email to `EMAIL_TEST_RECIPIENT`. **Owner:** set Resend as Supabase's custom SMTP (step 5 of `docs/supabase-auth-setup.md`) so colleagues can receive sign-in emails.
4. Click through staging and OK Phase 1 Steps 3–9 (checklist below).
5. Then Phase 1 Step 10: production (real team emails, production env vars, smoke test).

## Owner setup: Vercel
Vercel → project **marketing-design-hub** → Settings:
- **Git:** connect `ejanna-strat/Marketing-Design-Hub`. Production branch = `main`. Pushes to `staging` then get their own preview link.
- **Environment Variables** (tick Preview and Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_MODE=true`, `EMAIL_TEST_RECIPIENT=erylljanna.ong@stratpoint.com`, `NEXT_PUBLIC_APP_URL` (the production address). Copy the values from `.env.local`.
- After saving the variables, redeploy the `staging` branch (Deployments → … → Redeploy).

## Staging checklist (Phase 1 ✅ list)
- [ ] A @stratpoint.com email gets in with the link and with the code; a gmail.com email is refused.
- [ ] Submit one request of each type: the right questions appear, required fields block submit, the IDs are MDR-26-0001…, and the confirmation page shows.
- [ ] Two requester accounts each see only their own requests; search and filters work.
- [ ] As an admin: change Status, Designer and Link inline and on the details page. Date Started fills on In progress; the activity log shows each change.
- [ ] A designer-only account can't change the designer.
- [ ] N1 arrives on submit; N8 arrives once on Completed (after Resend is set up).

## Open questions for the owner
1. **Dates:** the plan's Phase 1 test date (Wed Oct 7) has passed. Please pick new target dates for Phase 1 and later phases.
2. Real email addresses for Steve, Sofia and Riann: they are placeholders. Fix them in Settings → Members (remove the placeholder, add the real email). Should `marketing-ai@stratpoint.com` stay an admin?
3. Sender address for emails: `marketingdesignhub@ejoo.site` for now. Move to a Stratpoint address before go-live (needs IT's DNS records).
4. Which specification questions are required (current default is in CLAUDE.md §6).
5. **Before go-live:** rotate the Supabase service role key and the personal access token (both were pasted in chat).
6. Supabase's built-in email only delivers to members of the Supabase project team, a few per hour. Other colleagues can sign in only after Resend is set as the custom SMTP (step 5 of `docs/supabase-auth-setup.md`).
