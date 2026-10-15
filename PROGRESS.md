# Progress

_Last updated: Oct 15, 2026_

## Done
- Phase 0: Next.js + TypeScript + Tailwind + shadcn/ui starter app with a "Hello Marketing Design Hub" page.
- Phase 0: `dev` and `staging` branches created (branch flow in CLAUDE.md §14).
- Phase 0: `.env.local` has the Supabase URL, anon key and service role key. Supabase MCP connected (user-wide, limited to this project).
- Phase 1 Step 1: database schema applied to Supabase (`0001_schema.sql`, `0002_advisor_fixes.sql`): 12 tables with RLS, request IDs, auto dates, activity log, column guard, submit function, sign-up domain hook function. Branch `feature/db-schema` (merged into `dev`).
- Phase 1 Step 2: seed data applied (`0003_seed.sql`): 10 teams, 10 request types, 60 form questions. Team roster in `config/team.ts`, loaded with `npm run seed:team` (Jerome, Steve, Sofia, Riann + the owner's account as admin). Branch `feature/seed-data`.

## Next
- Owner: check the seed data in Supabase → Table Editor, then OK Step 2.
- Phase 1 Step 3: login (magic link + 6-digit code).
- Phase 0 (still open): connect Vercel to GitHub so the hello page is live; create the Resend account and API key; send the DNS request to IT (`docs/it-dns-request.md`).
- Turn on the sign-up hook in Supabase (Authentication → Hooks) during Step 3 (login).

## Open questions for the owner
1. **Dates:** the plan's Phase 1 test date (Wed Oct 7) has passed. Please pick new target dates for Phase 1 and later phases.
2. Real email addresses for Steve, Sofia and Riann (placeholders in `config/team.ts`; Jerome's is taken from the form intro). Should `marketing-ai@stratpoint.com` stay an admin?
3. Sender address for emails (e.g. `designhub@<subdomain>.stratpoint.com`); needs IT's DNS record.
4. Which specification questions are required (current default is in CLAUDE.md §6).
5. **Before go-live:** rotate the Supabase service role key and the personal access token (both were pasted in chat).
