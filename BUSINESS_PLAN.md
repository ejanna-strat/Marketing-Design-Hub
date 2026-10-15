# Marketing Design Hub — Business Plan & Build Spec

> **For Claude Code:** This file is the source of truth for the project. Save it as `CLAUDE.md` in the project root. Read it fully at the start of every session.
> Owner: Stratpoint Marketing (marketing-ai@stratpoint.com) · Version 1.0 · 2026-10-01

---

## 0. How to work with me (the owner)

- **I am a marketer, not a developer.** Explain every step in plain language. Before running anything that needs me (creating accounts, pasting keys, clicking in a dashboard), tell me exactly where to click and what to copy.
- Work **one phase at a time**, and within a phase **one step at a time**. After each step, tell me how to check it in the browser, then wait for my OK before moving on.
- **Never add features that belong to a later phase.** If I ask for something out of scope, put it in `BACKLOG.md` and tell me which phase it fits.
- Never put secrets (API keys, passwords) in code or commit them. Use `.env.local` and Vercel environment variables, and keep `.env.example` up to date.
- Commit to git after every working step with a clear message. Push to GitHub so Vercel deploys a preview.
- Keep `PROGRESS.md` updated with: what's done, what's next, and any open questions for me.
- When something breaks, explain what went wrong in one or two sentences before fixing it.

---

## 1. Business context

**Problem.** The Stratpoint Marketing Design team (Brand team) tracks design requests in a Google Sheet. Specifically:

1. Request details and status are hard to track; the Sheet feels overwhelming, especially when you're checking specifications.
2. The pipeline depends on Sheet formulas, so one accidental edit can break the tracker.
3. Adding or removing form fields means editing formulas by hand.
4. Productivity reports are tracked manually.

**Solution.** The Marketing Design Hub is an internal web app where Stratpoint staff submit design requests and track them. The design team reviews, assigns, works on and delivers each request in one pipeline, with automatic email notifications and reports.

**Success metrics** (these are what "done" means):

| # | Metric | How we'll know |
|---|---|---|
| 1 | Easier tracking of request details & status | Requesters and designers find any request in < 10 seconds via search/filter; all specs on one details page |
| 2 | Confident navigation & filtering of pipeline | No formulas; edits only through controlled fields; activity log of changes |
| 3 | Flexible request form fields | Admins add/edit/remove questions without code (stored in database; admin UI in Phase 5) |
| 4 | Automated productivity reports | Monthly analytics page generated from data, no manual tracking (Phase 4) |

**Start state:** fresh database. No data migration from the Google Sheet.

---

## 2. Users & roles

Everyone signs in with an **email magic link** sent to their **@stratpoint.com** address. Requests are tied to the signed-in email. Tell users to always use their main email (not an alias). Phase 5 adds an admin tool to merge duplicate accounts.

| Role | People (initial seed) | Can do |
|---|---|---|
| **Admin** | Jerome, Steve, Riann | Everything: see/edit all requests, review (accept/return), assign/reassign, change any field, manage settings, see dashboard & analytics |
| **Designer** | Jerome, Steve, Sofia | See the pipeline, edit Status and Link to Output on requests, accept/reassign tasks assigned to them |
| **Requester** | Any other @stratpoint.com user (default role) | Submit requests, see **only their own** requests, view details, share feedback |

- A person can hold more than one role (Jerome and Steve are Admin + Designer).
- Seed the real emails from a config file `config/team.ts` (I will provide the emails; use placeholders like `jerome@stratpoint.com` until then and remind me).
- **"Reviewers"** (who accept/return new requests) = Jerome and Steve. Riann is an admin who receives admin notifications and can edit everything.
- **Marketing team exclusion:** feedback from requesters whose team is "Marketing" is excluded from feedback averages (Phase 3+).
- **One link for everyone.** After sign-in, the UI shows each user only the screens their role allows.

---

## 3. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase for screens + server logic |
| UI | **Tailwind CSS + shadcn/ui**, TanStack Table for data tables | Clean admin UI fast; good filtering/sorting tables |
| Database + Auth | **Supabase** (Postgres, Auth, Row Level Security) | Free tier, Google sign-in built in, secure per-row access |
| Login | **Supabase email magic link + 6-digit one-time code in the same email**, restricted to `@stratpoint.com` (check the domain server-side). Sessions last ~30 days | Needs no IT approval. Google OAuth may be added later (optional, Phase 5) without data changes |
| Email | **Resend** + **React Email** templates; also set Resend as Supabase Auth's custom SMTP so login emails aren't rate-limited | Simple API, branded HTML emails. Needs one DNS record from IT; fallback: Stratpoint Workspace SMTP |
| Scheduled jobs (Phase 3) | **Vercel Cron** hitting protected API routes (or Supabase `pg_cron`) | Daily 8AM (Asia/Manila) reminders |
| Hosting | **Vercel** | Auto-deploy from GitHub, preview links per change |
| Charts (Phase 4) | Recharts | Dashboard & analytics |

**Conventions**
- Timezone: **Asia/Manila** for all displayed dates and scheduled jobs. Store timestamps in UTC.
- Date format shown to users: `Oct 7, 2026`.
- All database access is enforced by **Row Level Security** (requesters can only read their own requests).
- Branding: the app name is "Marketing Design Hub"; the email footer reads "Marketing Design Hub | Stratpoint Technologies" and "Automated notification | For internal use only". The primary accent color is purple (to match the plan's mockups); keep it configurable in one theme file.

---

## 4. Core concepts

### 4.1 Request ID
- Format **`MDR-YY-NNNN`**, e.g. `MDR-26-0001`. YY = 2-digit year of the request date. NNNN resets every year.
- Generated in the database (sequence per year inside a transaction) so there are never duplicates.

### 4.2 Statuses (single source of truth: use the same labels in UI, filters and emails)

| Status | Meaning | Set by |
|---|---|---|
| New request | Submitted, not yet assigned/accepted by a designer | System on submit; also when a designer asks to reassign |
| Designer assigned (not yet started) | Designer accepted the task | Designer accept (Phase 2) / admin dropdown (MVP) |
| In progress | Designer working, including marketing review/revision rounds | Designer / admin |
| For requester's review | Output link shared; waiting for requester's approval | Designer / admin (requires Link to Output) |
| For revision | Requester asked for revisions | Designer / admin |
| Completed | Final output approved and turned over | Designer / admin (requires Link to Output) |
| Rejected | Returned to requester by reviewer (shown to requester as "Returned") | Reviewer |
| Cancelled | Request cancelled | Admin |
| On hold | Paused | Admin |

- **Date Started** fills automatically the first time status becomes *In progress*; it shows "—" until then.
- **Date Completed** fills automatically when status becomes *Completed* (used for turnaround time).
- Every status/designer/link/date change is written to an **activity log** (who, what, old → new, when).

### 4.3 Reference lists (store in DB tables so admins can edit later)

**Business Unit / Team:** AI/ML · Cloud & Data · QA · Software Services · Marketing · Sales · Human Resources · Finance & Admin · ITSM · Product Strategy

**Designers:** Jerome · Steve · Sofia

**Type of Design Request** (10):
1. Presentation Deck
2. Social Media Materials (static)
3. Social Media Materials (dynamic)
4. External Event Collaterals
5. Stratpoint Website Assets / Development
6. Newsletters / Emails
7. Internal Company / Holiday Event Material
8. Marketing Print and Digital Publications
9. New Merchandise Design
10. Others / Stratpoint Initiatives

---

## 5. Data model (Supabase / Postgres)

Use these tables (names can be adjusted, but keep the concepts):

- `profiles` — id (= auth user id), full_name, email, team_id, created_at
- `user_roles` — user_id, role (`admin` | `designer` | `requester`)
- `teams` — id, name, is_marketing (bool), sort_order, active
- `designers` — id, user_id, display_name, active
- `request_types` — id, name, sort_order, active
- `form_questions` — id, request_type_id (null = General section), label, help_text, field_type (`short_text` | `long_text` | `url` | `single_select` | `multi_select` | `date`), options (jsonb array), allow_other (bool, adds "Other: ___" text), required (bool), is_output_needed (bool — marks the question whose answer fills the pipeline's "Output Needed" column), sort_order, active
- `requests` — id, request_code (MDR-26-0001), title, requester_id, requester_name, requester_email, team_id, request_type_id, date_needed, final_approver_name, final_approver_email, status, assigned_designer_id, link_to_output, return_reason, reassign_reason, date_started, date_completed, created_at, updated_at
- `request_answers` — id, request_id, question_id, **question_label_snapshot**, value (jsonb). Snapshot the label so old requests still read correctly if a question is edited later.
- `activity_log` — id, request_id, actor_id, action, from_value, to_value, note, created_at
- `feedback` (Phase 3) — id, request_id, requester_id, process_rating (1–5), output_rating (1–5), comments, submitted_at
- `notifications_log` — id, request_id, notification_key (e.g. `N1_NEW_REQUEST`), recipients, sent_at, status. Use it to avoid double-sending and to drive daily repeats.

**Derived values (compute, don't store):**
- Overall feedback per request = (process_rating + output_rating) ÷ 2, e.g. 4.5 ⭐
- Process Average = total process points ÷ total responses; Output Average likewise; Overall rating = (Process Avg + Output Avg) ÷ 2 — **exclude requesters whose team is Marketing**.
- Turnaround time = working days (Mon–Fri) from request date to date completed.

**Editing questions safely:** never hard-delete a question that has answers; set `active = false` instead.

---

## 6. Request form questions (seed data)

Source: *"Marketing Design Request Form — Simplified Questions List as of Oct 14"* (final). Unless a question says **(select all that apply)** it is single-choice. "+ Other" means show an "Other: ___" short text option. Seed these into `form_questions`. Help text ("Description") is shown in grey under the label. Text fields that ask for links stay **open text** (people may paste several links or a note), not strict URL fields.

**Form intro** (show at the top of the New Design Request form):
> Good day! This is the Design Request Form of the Marketing Team. Please allow us within the working day to confirm receipt of your request. If we do not respond, please send Jerome Casupanan Ko a follow-up via Google Chat or e-mail at jerome.casupanan@stratpoint.com.
>
> Please be informed that your design requests are still subject to approval after submission.
>
> Kindly note that the request has not been started unless you get a confirmation from one of our designers. Thank you!

Also show: *"Please submit a separate request for each design type."* and *"Reminder: Please review our SLAs to set expectations for request turnaround times."* (SLA link from Phase 5).

### 6.1 General Information (all requests, first part of the form, in this order)
| # | Question | Type | Required | Help text |
|---|---|---|---|---|
| 1 | Name | open text, pre-filled from login (editable) | yes | — |
| 2 | Email | pre-filled from login (read-only) | yes | — |
| 3 | Business Unit | dropdown, select one (Teams list) | yes | — |
| 4 | Request Title | open text | yes | "A short, descriptive title of your request (e.g. "Pitch Deck - GCash", "AICON Event Visual Identity", "Blog Launch: 5 Tips on How to Code")" |
| 5 | Date Needed | date picker (no past dates) | yes | "Select the date when you need the final design output delivered. For guidance on turnaround times, please refer to our SLAs." |
| 6 | Final Approver of the Design | dropdown, select one: **Myself (same as the requester)** · **Other** | yes | — |
| 6a | ↳ Approver Name + Approver Email | two open text fields, shown only when "Other" is picked; email must be a valid address | yes, if Other | — |
| 7 | Type of Design Request | dropdown, select one (10 types) — reveals that type's Request Specifications section (6.2–6.11) | yes | — |

Final Approver storage: if "Myself", save the requester's name and email into `final_approver_name` / `final_approver_email`; if "Other", save what was typed. Request Title, Date Needed and Final Approver are stored as columns on `requests` (not only as answers) because the pipeline, details page and reminders use them.

### 6.2 Presentation Deck
- Project Overview and Objective — long text — help: "Please provide a brief background of the project, its purpose, and the objective you want to achieve. This will help the Designers better understand the context and direction of your request."
- **Output Needed** ★ — select one: Deck Template - no content, design only · Deck Enhancement - already has content, need help to enhance the look — help: "Deck designs adhere to Stratpoint brand guidelines; off-brand elements will be removed"
- Link to existing deck — open text — help: "Content MUST be completed before sending. Otherwise, designers will only work on the currently existing slides."
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required logos or images. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.3 Social Media Materials (static)
- Target Audience — open text
- Platform/s — **select all that apply** — Facebook · LinkedIn · Twitter/X · Instagram · TikTok · YouTube
- **Type of social media material** ★ — select one + Other — Single artwork · Rectangle artwork (e.g. text-heavy infographic) · Multi-image tiles · Story post
- Copy — long text — help: "Place detailed text content or link to the document/slides file."
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required logos or images. If irrelevant, put N/A."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If not applicable, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.4 Social Media Materials (dynamic)
- Target Audience — open text
- Platform/s — **select all that apply** — Facebook · LinkedIn · Twitter/X · Instagram · TikTok · YouTube
- **Type of social media material** ★ — select one + Other — GIF artwork · Video with static images · Video with stock videos · Full video production VI (for new video projects) · First cut of full video production (for Design Team) · Final cut of full video production · Video assets/supers · Reel/dynamic story · Minor video update/cutting
- Copy — long text — help: "Place detailed text content or link to the document/slides file."
- Mandatory video requirements — long text — help: "Any specifications required in the video (e.g. music, length of video, animations, video dimensions, etc.) Please provide file links for any required elements."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.5 External Event Collaterals
- Target Audience — open text
- Event Type — select one — Physical · Virtual · Hybrid
- Specific event platform and/or location — open text
- **Material needed** ★ — select one + Other — Event video · Booth backdrop (physical) · Pull-up banner (physical) · Acrylic stand (physical) · Google form header · Virtual booth · Social media post · Presentation deck template — help: "For new merchandise requests, please fill out separate form/s with different Request Type."
- Detailed information about the materials — long text — help: "Place information about the requested material/s (e.g. dimensions for the platform/s, design and print specifications, length of video, background music, etc.)"
- Copy — long text — help: "Place detailed text content or link to the document/slides file."
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.6 Stratpoint Website Assets / Development
- Link to website content reference file — open text
- Link to wireframes — open text
- **Material/s needed** ★ — select one + Other — Landing page header · Icons · Images · Blog header · Wireframe · Wordpress blog page development · Wordpress landing page development
- Mandatory graphics — long text — help: "Any element required in the page (e.g. logos, specific imagery). Please provide file links for any required elements. If irrelevant, put N/A."

### 6.7 Newsletters / Emails
- Link to existing content reference file — open text
- **Material/s needed** ★ — select one + Other — Email layout · Marketing Hub page · LinkedIn newsletter article · Timesheet pop-ups · Wookie push notification · Wookie in-app notification · Email PDF · Email Header
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.8 Internal Company / Holiday Event Material
- Project Overview and Objective — long text — help: "Please provide a brief background of the project, its purpose, and the objective you want to achieve. This will help the Designers better understand the context and direction of your request."
- **Type of material** ★ — select one — Full visual identity · Event announcement card · Event slides · Event background
- Theme — long text — help: "You may also add a short description if relevant."
- Copy — long text — help: "Place detailed text content or link to the document/slides file."
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.9 Marketing Print and Digital Publications
- **Type of design material** ★ — select one + Other — HubSpot landing page · One-pager (print/PDF) · Brochures · Case study PDF · E-Book/White paper
- Copy/Content — long text — help: "Place detailed text content or link to the document/slides file."
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.10 New Merchandise Design
- **Type of merchandise material** ★ — select one + Other — Shirt · Stickers · Totebag · Cap · ID lace · Notebook · Ballpen — help: "ONE form per merchandise type. Kindly fill up a separate form for another merchandise design request."
- Detailed information about the material — long text — help: "Place information about the requested material (e.g. dimensions, design and print specifications, etc.)"
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."

### 6.11 Others / Stratpoint Initiatives
- Project Overview and Objective — long text — help: "Please provide a brief background of the project, its purpose, and the objective you want to achieve. This will help the Designers better understand the context and direction of your request."
- Detailed information about the material — long text — help: "Place information about the requested material (e.g. dimensions for the platform, design and print specifications, etc.)"
- Copy — long text — help: "Place detailed text content or link to the document/slides file."
- Mandatory graphics — long text — help: "Any element required in the template (e.g. logos). Please provide file links for any required elements. If irrelevant, put N/A."
- Design pegs/graphics — long text — help: "You may suggest a specific design or provide links to existing assets. If irrelevant, put N/A."
- Other important information — long text — help: "If irrelevant, put N/A."
- (No ★ question; "Output Needed" shows "Others".)

★ = `is_output_needed = true` (its answer shows in the pipeline's **Output Needed** column). Required: all ★ questions, every "Project Overview and Objective", and every "Copy" / "Copy/Content" / "Detailed information" question; everything else optional (owner can change this later).

**Changes vs. the Oct 1 list** (apply to the database if the form is already built; old requests keep their answers via label snapshots):
1. Type #8 renamed: "Other Marketing Materials (Print & Digital Publications)" → **"Marketing Print and Digital Publications"**.
2. New question **Project Overview and Objective** (first question) in Presentation Deck, Internal Company / Holiday Event Material, and Others / Stratpoint Initiatives. In Internal Company it **replaces "Purpose"**.
3. Presentation Deck: questions reordered (Overview → Output Needed → Link to existing deck → …); Output Needed gets the brand-guidelines help text.
4. "Audience" renamed **"Target Audience"** (Static, Dynamic, External Event).
5. Help text updated: Mandatory graphics now asks for file links; Design pegs/graphics reworded; Mandatory video requirements adds "video dimensions" and file links.
6. Spelling: "Linkedin" → "LinkedIn", "Hubspot" → "HubSpot".
7. New form intro text at the top of the form.
8. General Information now includes Request Title, Date Needed and Final Approver of the Design (Myself / Other + name and email), placed before Type of Design Request.

---

## 7. Screens

### 7.1 Requester screens (the "Marketing Design Hub" home)
Home tagline: **"One place to submit design requests, track progress, and understand our design service timelines."**
Buttons: **New Design Request** · **Track My Request** · **Share Feedback** (Phase 3) · **See Design SLAs** (Phase 5). Buttons from later phases show as disabled "Coming soon" in the MVP.

1. **New Design Request** — form from §6. Picking a Type of Request expands that type's questions. Validate the required fields. Submit → create the request with status *New request*.
2. **Request Submitted!** — copy:
   > Please note that submitting a request does not mean it has been accepted or started. All requests are subject to review and approval by the Design Team.
   > You will receive a separate notification once the assigned designer started working on your request.
   > You can track the status of your request anytime through Track My Requests.

   Buttons: **Track My Request** · **Submit Another Request**
3. **My Design Requests** — table of the signed-in user's requests only. Columns: Request ID · Request Date · Date Needed · Request Title · Type of Request · Output Needed · Status · Assigned Designer ("—" if none) · Link to Output (read-only) · Overall Feedback. Search bar + filters (status, type, date range). Clicking the Request ID opens the details.
   - Overall Feedback cell: not Completed → empty/locked · Completed + no feedback → **"Share feedback"** link (Phase 3) · feedback given → the rating, e.g. "4.5 ⭐".
4. **Request Details (requester)** — all General info + every spec answer, status, assigned designer, link to output, feedback. Read-only.
5. **Request was Returned (Phase 2)** — shows Status "Returned" and the **Reason for Return**, plus: "For any questions or clarifications, you may coordinate with (designer) that returned the request." Button: **Submit a New Design Request**.
6. **Feedback form (Phase 3)** — see §9.

### 7.2 Admin / Designer screens
Left menu bar: Dashboard (Phase 4) · Design Pipeline · Pendings (Phase 4) · Feedback (Phase 3) · Analytics (Phase 4) · Settings (Phase 5).

1. **Marketing Design Pipeline** (title: "Marketing Design Pipeline", subtitle: "Track all design requests"). Table columns: Request ID (click → details) · Request Date · Date Needed · Request Title · Type of Request · Output Needed · Status (inline dropdown) · Assigned Designer (inline dropdown, "—" if none) · Requester's Name · Requester's Team · Requester's Email · Link to Output (inline editable) · Overall Feedback. Search bar plus filters for status, designer, team, type and date range. Sort by any column; default sort is newest first.
   - Changing the **Type of Request** is not allowed; the requester must submit a new request (e.g. static → dynamic).
2. **Request Details window (admin)** — all fields from §5. Editable: Date Needed, Status, Assigned Designer, Link to Output. Shows Date Started (auto) and the activity log. Phase 2 adds the action buttons (Accept / Return / Reassign).
3. **Feedback page (Phase 3)** — "Feedback — xx Total feedback received (YTD)"; Process Average, Output Average and Overall rating as stars; % of completed requests with feedback; table of all feedback (Request ID, Title, Requester, Team, Designer, Process, Output, Overall, Comments, Date).
4. **Dashboard (Phase 4)** — "Marketing Design Pipeline 2026 YTD": request counts by status (bar), Pendings summary (each item clickable → Pendings page), Total requests per team, Top type of request, Overall Feedback (Process / Output / Overall), Average turnaround (days).
5. **Pendings page (Phase 4)** — "Pendings — xx Total Pending". Tabs with counts: New Requests · Not Started · In Progress · For Review · For Revision. Status, Assigned Designer and Link to Output editable here too.
6. **Analytics / Reports (Phase 4)** — Monthly with month-over-month comparison:
   - Brand Team Productivity: Total requests vs total accepted (bar) · Requests per team (pie) · Request type breakdown (pie) · Total vs completed vs open at month-end (open = not started + in progress) · Average turnaround (weekdays only) · Feedback overall rating
   - Designer Productivity: per designer — requests handled, completed, avg turnaround, feedback overall rating
   - Export CSV.

---

## 8. Workflow & notifications

### 8.1 Process (full version, Phase 2)
1. Requester submits → status **New request** → **N1** to all designers + Riann.
2. Reviewer (Jerome/Steve) reviews:
   - **Accept** → pick designer (Jerome / Steve / Sofia) → **N3** to the assigned designer + Riann.
   - **Return** → reason (required) → status **Rejected** (requester sees "Returned") → **N2** to requester.
3. Assigned designer acknowledges:
   - **Accept** → status **Designer assigned (not yet started)** → **N4** to requester + Riann.
   - **Reassign** — Full plate / Other concerns + text → status back to **New request**, designer cleared. *(N5 to admins is marked DISREGARD in the plan: do not build N5 and do not send an email; just show it in Pendings → New Requests with the reason.)*
4. Admin reassigns to another designer (also possible mid-work) → **N6** to requester + new designer. Status stays as it was (*Designer assigned* or *In progress*).
5. Designer starts → **In progress** (Date Started auto-fills). Same status during marketing-team internal review and revisions.
6. Output ready → **For requester's review** (Link to Output required) → **N7** to requester.
7. Requester wants changes → **For revision** → back to In progress / For requester's review.
8. Approved → **Completed** (link to final file required) → **N8** to requester.
9. 5 days after N8 with no feedback → **N9** once (not sent to requesters on the Marketing team).
10. 3 days before Date Needed and not Completed/Cancelled/Rejected → **N10** once to Jerome + assigned designer.

### 8.2 Email templates
Every email uses one shared layout: a header with "Marketing Design Hub", a purple uppercase label (e.g. NEW DESIGN REQUEST), a message, a details block, a purple button, a footer line ("You're receiving this because …"), and "Marketing Design Hub | Stratpoint Technologies · Automated notification | For internal use only". Copy below is final unless I change it. Buttons link straight into the app.

**Footer variants**
- F-TEAM: "You're receiving this because you're on the Marketing Brand team."
- F-DESIGN: "You're receiving this because you're on the Marketing Design team."
- F-REQ: "You're receiving this because you filed a Design Request with the Marketing team."
- F-REMIND: "You're receiving this as a friendly reminder about an upcoming due date."

| Key | Phase | Trigger | To | Frequency |
|---|---|---|---|---|
| N1 | **1** (immediate) / 3 (daily repeat) | Request submitted | All designers + Riann | On submit; from Phase 3, daily 8AM until a designer is assigned. If the assigned designer asks to reassign and nobody is reassigned by end of business day, restart the daily 8AM repeat the next morning |
| N2 | 2 | Request returned | Requester | Once |
| N3 | 2 / 3 (repeat) | Reviewer accepted + assigned | Assigned designer + Riann | On assign; from Phase 3, daily until the designer accepts/reassigns |
| N4 | 2 | Designer accepted | Requester + Riann | Once |
| N5 | — | **DISREGARD — do not build** | — | — |
| N6 | 2 | Task reassigned to another designer | Requester + new designer | Once (new designer then gets N3 daily until they respond) |
| N7 | 2 | Status → For requester's review | Requester | Once |
| N8 | **1** | Status → Completed | Requester | Once |
| N9 | 3 | 5 days after N8, no feedback, requester not Marketing | Requester | Once |
| N10 | 3 | 3 days before Date Needed, not Completed | Jerome + assigned designer | Once |

**N1 — New Design Request** · Subject: `New Design Request: {title}` · Label: NEW DESIGN REQUEST
> A new design request has been submitted and is ready for review.
> Request: {title} · Request ID: {code} · Requested by: {requester_name} · Team: {team} · Date Needed: {date_needed}
> Button: **View New Design Request** → admin Request Details · Footer: F-TEAM

**N2 — Design Request Returned** · Subject: `Design Request Returned: {title}` · Label: DESIGN REQUEST RETURNED
> Your design request has been returned because additional information or clarification is needed.
> Request: {title} · Request ID: {code} · Reason for return: {return_reason}
> Please review the comments and provide the requested information or updates before submitting a new request.
> For any questions or clarifications, you may reach out to {reviewer_name}.
> Button: **File a New Design Request** → New Design Request form · Footer: F-REQ

**N3 — New Design Request Assigned to You** · Subject: `New Design Request Assigned to You` · Label: NEW TASK ASSIGNED
> A new design request is now in the pipeline and has been assigned to you.
> Please review the request and respond to acknowledge the task.
> Request: {title} · Request ID: {code} · Requested by: {requester_name} · Requester's Team: {team} · Date needed: {date_needed}
> Button: **View My Pipeline** → pipeline filtered to the designer · Footer: F-DESIGN

**N4 — Design Request Accepted** · Subject: `Design Request Accepted: {title}` · Label: DESIGN REQUEST ACCEPTED
> Your design request has been accepted and assigned to {designer_name}.
> We will notify you once the designer starts working on your request.
> You can track the progress of your request through Track My Requests.
> Request: {title} · Request ID: {code}
> Button: **Track Request** → My Design Requests · Footer: F-REQ

**N6 — Design Request Reassigned** · Subject: `Design Request Reassigned: {title}` · Label: DESIGN REQUEST
> Your design request has been reassigned to a new designer.
> You can continue tracking the progress of your request through Track My Requests.
> Request: {title} · Request ID: {code} · New Designer: {designer_name}
> Button: **Track Request** → My Design Requests · Footer: F-REQ

**N7 — Initial Design Output Ready** · Subject: `Initial Design Output Ready: {title}` · Label: DESIGN OUTPUT FOR REVIEW
> The initial design output for your request is ready for review.
> Please coordinate with {designer_name} to review the output and provide any feedback or revisions needed.
> Request: {title} · Request ID: {code} · Designer: {designer_name} · Link to Output: Open Link ↗
> Thank you.
> Button: **View Request Output** → requester Request Details · Footer: F-REQ

**N8 — Final Design Output Ready** · Subject: `Final Design Output Ready: {title}` · Label: FINAL OUTPUT IS READY!
> The final design output for your request is ready!
> Request: {title} · Request ID: {code} · Designer: {designer_name} · Link to Final Output: Open Link ↗
> We would also appreciate it if you could spare a few minutes to share your feedback on your experience with the Marketing Design Team. Your feedback will help us improve our process and the outputs we deliver.
> Thank you.
> Buttons: **View Final Output** → link_to_output · **Share Feedback** → feedback page (**Phase 3**; in the MVP show only View Final Output and leave out the feedback paragraph) · Footer: F-REQ

**N9 — Design Request Feedback** · Subject: `Design Request Feedback: {title}` · Label: DESIGN REQUEST FEEDBACK
> We hope you've had a chance to review the final design output for {title}.
> If you could spare a few minutes, we would greatly appreciate your feedback on your experience with the Marketing Design Team—from the request process to the design output itself.
> Your feedback will help us identify what we're doing well and where we can improve.
> Thank you for your time and support!
> Button: **Share Feedback** → feedback page · Footer: F-REQ

**N10 — Design Request Due in 3 Days** · Subject: `Design Request Due in 3 Days` · Label: DESIGN TASK CHECK-IN
> Just a friendly reminder that a design task is due in **3 days**.
> Please check the status of the task and ensure it remains on track for completion on or before the due date.
> Request: {title} · Request ID: {code} · Requested by: {requester_name} / {team} · Date needed: {date_needed}
> Button: **View Request** → admin Request Details · Footer: F-REMIND

Email rules: log every send in `notifications_log`; never send the same once-only email twice; in development, send all emails to the owner's address only (env flag `EMAIL_TEST_MODE=true`).

---

## 9. Feedback form (Phase 3)

Title: **Marketing Design Request Feedback**. Intro: "We'd love to know how we did! Your feedback helps us improve our design process and the outputs we deliver. Please submit a separate feedback form for each design output you received."
Request ID is pre-filled from the link (only the requester's own **Completed** requests, one feedback per request).

**Design Request Process** — "How would you rate your overall experience with the design request process, from submitting the request and communicating with the team to receiving the final output?" (1–5 stars)
1 – The process was difficult or unclear, with significant issues in communication or coordination. · 2 – The process had several challenges that affected the experience. · 3 – The process was generally okay, with some areas that could be improved. · 4 – The process was smooth and easy to navigate, with only minor issues. · 5 – The process was smooth, clear, and easy from request to delivery.

**Design Output** — "How would you rate the overall quality and usefulness of the design output you received?" (1–5 stars)
1 – The output did not meet the intended purpose and required significant improvement. · 2 – The output had several areas that needed improvement. · 3 – The output was generally usable but had some areas that could be improved. · 4 – The output was effective and met most of the intended needs. · 5 – The output was effective, well-executed, and served its intended purpose well.

**Additional Comments (optional)** — "Do you have any feedback or suggestions about the design request process or the output itself? Share what worked well, what could be improved, or anything you'd like the Marketing Design team to know. You can write your comments in English or Filipino."

Thank-you page: "Thank you for your feedback! We really appreciate you taking the time to share your thoughts with us. If you have other design outputs you'd like to share feedback on, you may submit another feedback form." Button: **Submit Another Feedback**.
Feedback Date is recorded automatically on submit.

---

## 10. Build phases & acceptance criteria

> Rule: finish and test one phase before starting the next. Dates are targets (Asia/Manila).

### Phase 0 — Setup (Oct 1–2)
- Guide me through creating: GitHub repo, Supabase project, Vercel project linked to GitHub, Resend account.
- Scaffold Next.js + TypeScript + Tailwind + shadcn/ui; `.env.example`; `PROGRESS.md`; `BACKLOG.md`.
- Draft a short email I can send IT asking for a DNS record so Resend can send from a Stratpoint subdomain (used for login emails and notifications). Until it's verified, use Supabase's built-in email for testing only.
- ✅ Done when: a "Hello Marketing Design Hub" page is live on a Vercel URL.

### Phase 1 — MVP (Oct 2–7) ← **test date: Wed Oct 7**
Scope: §5 tables (except feedback), §6 seed data, login + roles, screens 7.1 #1–4 and 7.2 #1–2, emails **N1** (immediate only) and **N8** (without the feedback button). Accept/Return/Reassign is handled by admins changing the Status/Designer dropdowns.
- ✅ A @stratpoint.com user can sign in with the magic link or the 6-digit code; a non-Stratpoint email cannot.
- ✅ Requester submits each of the 10 request types, sees the right questions, gets an MDR-26-#### ID and the confirmation page.
- ✅ Requester sees only their own requests in My Design Requests; search and filters work.
- ✅ Admin/Designer sees all requests in the Pipeline; can change Status, Designer and Link to Output inline and in the details window; Date Started auto-fills; changes appear in the activity log.
- ✅ N1 arrives for a new request; N8 arrives when status → Completed.
- ✅ Deployed to Vercel production URL; seed team emails confirmed with me.

### Phase 1.5 — Pilot & fixes (Oct 8–14)
- Real use by the design team plus 2–3 requesters. Fix the issues listed in `BACKLOG.md`. No new features.

### Phase 2 — Full workflow (Oct 15–30)
- Accept/Return (with reason) buttons for reviewers; Accept/Reassign (Full plate / Other concerns + reason) for the assigned designer; admin Reassign (keeps current status).
- Returned view for the requester (7.1 #5); all statuses enforced (Link to Output required for For requester's review and Completed).
- Emails N2, N3 (once), N4, N6, N7.
- ✅ Done when one request can go from submit to Completed using only buttons, with the right email at each step.

### Phase 3 — Feedback & reminders (Nov 2–13)
- Feedback form (§9), Overall Feedback column in both tables, Feedback page, Share Feedback on home + in N8.
- Scheduled jobs (Vercel Cron, 8AM Asia/Manila, weekdays): N1 daily repeat, N3 daily repeat, N9, N10.
- ✅ Done when averages exclude Marketing-team requesters and no email is ever sent twice by mistake.

### Phase 4 — Dashboard & reports (Nov 16–Dec 4)
- Dashboard, Pendings page, Analytics (§7.2 #4–6), CSV export. Turnaround excludes weekends.
- ✅ Done when the monthly report for October can be read entirely from the Analytics page.

### Phase 5 — Admin settings & polish (Dec 7–18)
- Form builder: per request type, add/edit/reorder/hide questions and options, set required and "Output Needed"; edits never break old requests (label snapshots).
- Manage users/roles (including merging duplicate accounts), designers, teams, request types.
- Optional: add Google sign-in (restricted to stratpoint.com) once IT approves; existing accounts link by email.
- See Design SLAs page (editable rich text; content from the team).
- Mobile check, accessibility check, empty states, loading states.

---

## 11. Non-functional requirements
- **Security:** RLS on every table; requesters can read only their own requests and answers; only admins/designers write pipeline fields; server-side domain check on login.
- **Reliability:** daily Supabase backups (on a paid tier) or a weekly CSV export job; error tracking is optional (Vercel logs are enough at first).
- **Performance:** pipeline table usable with 2,000+ requests (server-side pagination/filtering).
- **Cost:** free tiers for MVP/pilot. Expect ~$20–25/month (Supabase Pro) once in daily use; Resend free tier covers ~3,000 emails/month.
- **Note:** free Supabase projects pause after 7 days without activity.

---

## 12. Open items (ask me when you reach them)
1. Real email addresses for Jerome, Steve, Sofia and Riann.
2. Whether to add Google sign-in later (decided: magic link for now).
3. Sender address for emails (e.g. `designhub@<subdomain>.stratpoint.com`).
4. ~~Final Approver fields~~ — confirmed Oct 14: kept, as a Myself / Other dropdown (see §6.1).
5. Which spec questions are required (see the note under §6).
6. Content for the See Design SLAs page (Phase 5).
