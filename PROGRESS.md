# Progress

_Last updated: Oct 15, 2026_

## Done
- Phase 0: Next.js + TypeScript + Tailwind + shadcn/ui starter app with a "Hello Marketing Design Hub" page.
- Phase 0: `dev` and `staging` branches created (branch flow in CLAUDE.md §14).
- Phase 0: `.env.local` has the Supabase URL, anon key and service role key. Supabase MCP connected (user-wide, limited to this project).
- Phase 1 Step 1: database schema applied to Supabase (`0001_schema.sql`, `0002_advisor_fixes.sql`): 12 tables with RLS, request IDs, auto dates, activity log, column guard, submit function, sign-up domain hook function. Branch `feature/db-schema`.

## Next
- Owner: check the tables in Supabase → Table Editor, then OK Step 1.
- Phase 1 Step 2: seed teams, request types and form questions; `config/team.ts` roster.
- Phase 0 (still open): connect Vercel to GitHub so the hello page is live; create the Resend account and API key; send the DNS request to IT (`docs/it-dns-request.md`).
- Turn on the sign-up hook in Supabase (Authentication → Hooks) during Step 3 (login).

## Open questions for the owner
1. **Dates:** the plan's Phase 1 test date (Wed Oct 7) has passed. Please pick new target dates for Phase 1 and later phases.
2. Real email addresses for Jerome, Steve, Sofia and Riann (placeholders go in `config/team.ts`).
3. Sender address for emails (e.g. `designhub@<subdomain>.stratpoint.com`); needs IT's DNS record.
4. Which specification questions are required (current default is in CLAUDE.md §6).
5. **Before go-live:** rotate the Supabase service role key and the personal access token (both were pasted in chat).
