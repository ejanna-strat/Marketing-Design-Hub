# Marketing Design Hub — Build Plan: Phase 0 + Phase 1 (MVP)

## Context
Right now the Brand team tracks design requests in a Google Sheet that is fragile and hard to read. `BUSINESS_PLAN.md` describes the replacement: one web app where the **Marketing team** (Admins and Designers) runs the pipeline. **People outside Marketing** (Requesters) use the same app only to file requests, track status, and later share feedback. The repo `Marketing-Design-Hub/` (GitHub remote `ejanna-strat/Marketing-Design-Hub`) has only `README.md` and the untracked `BUSINESS_PLAN.md`.

Decisions confirmed with the owner:
- Build **Phase 0 and Phase 1**, one step at a time, with a browser check and the owner's OK after each step.
- **Keep feedback as written in the plan.** Requesters get the star-rating form after Completed in Phase 3 and nothing in the MVP. Revisions stay in Chat or email, and the requester's details page stays read-only.
- **Supabase and Vercel projects already exist. Resend does not exist yet.** Node 26 and `gh` are installed. The Supabase and Vercel CLIs are not installed, so I'll run them with `npx`.
- The Phase 1 target date (Oct 7) has passed (today is Oct 15). I'll flag this in `PROGRESS.md` so the owner can reset the dates. I won't change the dates myself.

All work happens in `/Users/erylljanna.ong/Projects/MarketingDesignHub/Marketing-Design-Hub/`.

---

## Phase 0: Setup

1. **Project memory files.** Copy `BUSINESS_PLAN.md` to `CLAUDE.md`, as the plan asks. Create `PROGRESS.md` (done / next / open questions, including the date slip and the open items in §12) and `BACKLOG.md`.
2. **Scaffold the app.** Run `create-next-app` (App Router, TypeScript, Tailwind, ESLint, `src/` directory) in a temp folder in the scratchpad, then move it into the repo so the existing files aren't touched. Then `shadcn init` and add the components we need (button, input, textarea, select, form, table, badge, dialog, dropdown-menu, calendar, popover, sonner, card, label, radio-group, checkbox). Also add `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@tanstack/react-table`, `date-fns`, `date-fns-tz`, `resend`, `@react-email/components`.
3. **Theme file.** `src/config/theme.ts` plus Tailwind CSS variables, with purple as the primary color in one place.
4. **Environment variables.** `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_MODE`, `EMAIL_TEST_RECIPIENT`, `NEXT_PUBLIC_APP_URL`. `.env.local` is gitignored. I'll tell the owner exactly where in Supabase (Project Settings → API) to copy each key from.
5. **Hello page.** "Hello Marketing Design Hub". Commit and push to GitHub, then walk the owner through linking the existing Vercel project to the repo and adding the env vars in Vercel. ✅ The page is live on a Vercel URL.
6. **Resend.** Walk the owner through creating the account and API key. Until the domain is verified, use `onboarding@resend.dev`, which only delivers to the account owner. That works for `EMAIL_TEST_MODE=true`. Draft `docs/it-dns-request.md`, a short email to IT asking for the DNS records (SPF/DKIM) on a Stratpoint subdomain.

---

## Phase 1: MVP (each numbered step = one commit + browser check)

### Step 1: Database schema (`supabase/migrations/0001_schema.sql`)
I'll apply it with `npx supabase link` + `npx supabase db push`. If that's awkward for the owner, they can paste the SQL into the Supabase SQL Editor instead (I'll give exact clicks).
- Tables from §5 (no `feedback`): `profiles`, `user_roles`, `teams`, `designers`, `request_types`, `form_questions`, `requests`, `request_answers`, `activity_log`, `notifications_log`.
- Extra helper tables:
  - `team_members(email, full_name, roles text[], designer_display_name)`: the roster seeded from `config/team.ts`.
  - `request_counters(year, last_value)`: hands out request numbers.
- Extra column `requests.output_needed text`. It's a copy of the ★ answer (or "Others"), saved at submit time so the pipeline can filter and sort on it quickly. I'll note this exception to the "compute, don't store" rule in CLAUDE.md.
- **Triggers and functions:**
  - `handle_new_user`: after an auth user is created, insert a profile, assign roles by matching the email against `team_members` (default `requester`), and link the `designers` row.
  - `assign_request_code`: before insert, lock the `request_counters` row for the year and produce `MDR-YY-NNNN`.
  - `requests_audit`: before update:
    - set `date_started` the first time status becomes *In progress*;
    - set `date_completed` on *Completed*;
    - set `updated_at`;
    - write `activity_log` rows for changes to status, designer, link to output, or date needed, with actor = `auth.uid()`.
  - **Column guard:** a user who is a designer but not an admin can only change `status` and `link_to_output`. Nobody can change `request_type_id`.
  - Helpers `is_admin()`, `is_staff()` (admin or designer).
  - `submit_request(payload jsonb)`: one transaction that inserts the request and its answers (with `question_label_snapshot`) and returns the code.
- **RLS on every table:**
  - Requesters can read only requests (and their answers) where `requester_id = auth.uid()`.
  - Staff can read everything. Staff can update requests, limited further by the column guard.
  - Reference tables can be read by any signed-in user and written by admins only.
  - `notifications_log` is reachable only with the service role.
- **Auth domain check (server-side):** a Supabase "Before User Created" auth hook (a Postgres function) rejects any email that isn't `@stratpoint.com`. The sign-in server action also checks the domain before sending the link.

### Step 2: Seed data (`supabase/migrations/0002_seed.sql` + `config/team.ts`)
- The 10 teams (Marketing gets `is_marketing=true`), the 10 request types, and every question in §6.1–6.11 in order. That includes help text, options, `allow_other`, `required`, and ★ = `is_output_needed`.
- General Info questions that map to `requests` columns (name, email, BU, title, date needed, approver, type) are built into the form instead of stored as `form_questions`. Only the spec questions per type are rows in `form_questions`.
- `config/team.ts` holds placeholder emails for Jerome, Steve, Sofia and Riann (with a reminder to the owner). A script `npm run seed:team` upserts them into `team_members` and `designers`.

### Step 3: Login (magic link + 6-digit code)
- `src/lib/supabase/{client,server,middleware}.ts` follow the standard `@supabase/ssr` pattern. `middleware.ts` refreshes the session and sends signed-out users to `/login`.
- `/login` has an email field. `signInWithOtp` sends one email containing both the link and the code, and a second screen accepts the 6-digit code (`verifyOtp`). `/auth/confirm` handles the link.
- I'll give the owner exact steps for the Supabase dashboard: Auth → Email template (include both `{{ .ConfirmationURL }}` and `{{ .Token }}`), Site URL and redirect URLs, the session length (~30 days), and turning on the auth hook.
- ✅ A @stratpoint.com email gets in. A gmail.com email is refused with a clear message.

### Step 4: App shell and role-based navigation
- `src/lib/auth.ts` provides `getCurrentUser()`, which returns the profile and roles.
- Requester layout: a simple top bar (Home, My Requests). No staff menus, so outside users only see what they need.
- Staff layout at `/admin/*`: a left menu with Design Pipeline active. Dashboard, Pendings, Feedback, Analytics and Settings show as disabled "Coming soon". Staff can still use the requester screens to file their own requests.
- Home `/`: the tagline from §7.1, **New Design Request** and **Track My Request** buttons, and **Share Feedback** and **See Design SLAs** shown as disabled "Coming soon".
- `/admin/*` is guarded server-side with `is_staff`. Non-staff users are redirected to the home page.

### Step 5: New Design Request form (`/requests/new`)
- Show the intro text, the "separate request" note, and the SLA reminder from §6.
- General Information:
  - Name is pre-filled and editable. Email is read-only.
  - Business Unit comes from `teams`, defaulting to the user's last-used team.
  - Date Needed can't be in the past (Asia/Manila).
  - Final Approver offers Myself or Other. Other shows name and email fields.
- Picking a Type of Design Request loads that type's `form_questions` and renders them with one component, `src/components/form/DynamicQuestion.tsx`. It covers each `field_type`: single/multi select, "Other: ___", and help text in grey.
- A zod schema built from the question rows checks the form in the browser **and again on the server** in the server action, which then calls `submit_request`.
- Redirect to `/requests/submitted?code=…` (the Request Submitted! page with the copy and the two buttons from §7.1 #2).
- Profile `team_id` is updated to the BU picked on this request.

### Step 6: My Design Requests and Request Details (requester)
- `/my-requests` uses a shared data-table component (`src/components/data-table/`, TanStack Table in manual mode). Paging, sorting and filtering run on the server through URL search params.
- It shows the columns from §7.1 #3, a search box (code/title), and filters for status, type and date range. Overall Feedback stays empty or locked in the MVP.
- `/my-requests/[code]` is read-only and shows General info, every answer (labels from the snapshot), status, designer and link. "Rejected" is shown to the requester as "Returned", via one `src/lib/statuses.ts` that holds the status labels, colors and requester display names.

### Step 7: Marketing Design Pipeline (`/admin/pipeline`)
- Same data-table, with every column from §7.2 #1 and filters for status, designer, team, type and date range. Default sort is newest first.
- Inline Status dropdown, Designer dropdown (admin only) and Link to Output editor. All of them go through server actions with role checks. RLS and the column guard enforce the same rules underneath.
- Phase 2 rules are left out on purpose. The MVP doesn't enforce "link required" or the Accept/Return buttons.

### Step 8: Request Details window (admin) (`/admin/requests/[code]`)
- All fields. Admins can edit Date Needed, Status, Designer and Link. Designers can edit Status and Link.
- Date Started and Date Completed are shown. The activity log timeline lists who, what, old → new, and when, with dates formatted like `Oct 7, 2026` in Asia/Manila (`src/lib/dates.ts`).

### Step 9: Emails N1 and N8
- `src/emails/Layout.tsx` is the shared layout from §8.2. `N1NewRequest.tsx` is sent to all designers and Riann. `N8FinalOutput.tsx` has only the "View Final Output" button and no feedback paragraph.
- `src/lib/email/send.ts`:
  - It uses the Resend client.
  - When `EMAIL_TEST_MODE=true`, it sends everything to `EMAIL_TEST_RECIPIENT`.
  - Every send is written to `notifications_log`, using the service-role client.
  - A unique index on `(request_id, notification_key)` for once-only keys stops the same email going out twice.
- N1 is sent from the submit action. N8 is sent from the status-update action when the status changes to Completed. If an email fails, the save still succeeds and the failure is logged.

### Step 10: Production
- Confirm the real team emails with the owner, run the seed, set production env vars in Vercel, set Supabase redirect URLs for the production domain, and smoke-test.
- Update `PROGRESS.md`.

---

## Key files (new)
- `CLAUDE.md`, `PROGRESS.md`, `BACKLOG.md`, `.env.example`, `docs/it-dns-request.md`
- `supabase/migrations/0001_schema.sql`, `0002_seed.sql`, `config/team.ts`, `scripts/seed-team.ts`
- `src/lib/supabase/*`, `src/lib/auth.ts`, `src/lib/statuses.ts`, `src/lib/dates.ts`, `src/lib/email/send.ts`, `src/config/theme.ts`
- `src/app/(requester)/{page,requests/new,requests/submitted,my-requests,my-requests/[code]}`, `src/app/admin/{pipeline,requests/[code]}`, `src/app/login`, `src/app/auth/confirm`
- `src/components/form/DynamicQuestion.tsx`, `src/components/data-table/*`, `src/emails/*`

## Verification (matches the Phase 1 ✅ list)
- `npm run build` and `npm run lint` pass. Each step is pushed, and I give the owner a Vercel preview link to click through.
- **Login:** a stratpoint.com email works with both the link and the code. A non-Stratpoint email is refused.
- **Form:** submit one request of each of the 10 types. The right questions appear, required fields block submit, the IDs come out as `MDR-26-0001…0010`, and the confirmation page shows.
- **Isolation:** with two requester accounts, each sees only their own requests. I'll also check RLS directly in the SQL editor by querying as an `authenticated` role.
- **Pipeline:** as an admin, change status, designer and link inline and on details. Date Started fills on In progress. The activity log shows each change. A designer-only account can't change the designer (tested through both the UI and RLS).
- **Emails:** in test mode, N1 arrives on submit and N8 arrives once on Completed. Setting Completed again does not resend. `notifications_log` has the rows.
- Production URL is live and the team emails are confirmed.
