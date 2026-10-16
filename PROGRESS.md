# Progress

_Last updated: Oct 16, 2026 · version 0.4.0_

## Done
- Phase 0: Next.js + TypeScript + Tailwind + shadcn/ui starter app; `dev` and `staging` branches (branch flow in CLAUDE.md §14).
- Phase 0: `.env.local` has the Supabase URL, anon key and service role key. Supabase MCP connected.
- Phase 1 Step 1: database schema, triggers and Row Level Security (`0001_schema.sql`, `0002_advisor_fixes.sql`).
- Phase 1 Step 2: seed data (`0003_seed.sql`) and team roster (`config/team.ts`, `npm run seed:team`).
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

## Next (owner)
1. **Vercel:** connect the GitHub repo and set the environment variables for Preview (staging) and Production. See "Owner setup" below.
2. **Supabase dashboard:** follow `docs/supabase-auth-setup.md` (sign-up hook, redirect URLs, email template, session length).
3. **Resend:** create the account and API key, then put the key in `.env.local` and Vercel. Until then, emails are logged as "failed: RESEND_API_KEY is not set" and nothing else breaks.
4. Click through staging and OK Phase 1 Steps 3–9 (checklist below).
5. Then Phase 1 Step 10: production (real team emails, production env vars, smoke test).

## Owner setup: Vercel
Vercel → project **marketing-design-hub** → Settings:
- **Git:** connect `ejanna-strat/Marketing-Design-Hub`. Production branch = `main`. Pushes to `staging` then get their own preview link.
- **Environment Variables** (tick Preview and Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_MODE=true`, `EMAIL_TEST_RECIPIENT=marketing-ai@stratpoint.com`, `NEXT_PUBLIC_APP_URL` (the production address). Copy the values from `.env.local`.
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
2. Real email addresses for Steve, Sofia and Riann (placeholders in `config/team.ts`; Jerome's is taken from the form intro). Should `marketing-ai@stratpoint.com` stay an admin?
3. Sender address for emails (e.g. `designhub@<subdomain>.stratpoint.com`); needs IT's DNS record.
4. Which specification questions are required (current default is in CLAUDE.md §6).
5. **Before go-live:** rotate the Supabase service role key and the personal access token (both were pasted in chat).
6. Supabase's built-in email only delivers to members of the Supabase project team, a few per hour. Other colleagues can sign in only after Resend is set as the custom SMTP (step 5 of `docs/supabase-auth-setup.md`).
