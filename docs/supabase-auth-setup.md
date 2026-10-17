# Supabase sign-in setup (one time)

People sign up with their **@stratpoint.com email and a password**, confirm their email once, and then sign in with the password (owner decision, Oct 16). These settings live in the Supabase dashboard, not in the code. Open your project at https://supabase.com/dashboard and follow each step.

## 1. Turn on the @stratpoint.com check
**Authentication → Hooks (Auth Hooks) → Add hook → "Before User Created"**
- Hook type: **Postgres**
- Schema: `public`
- Function: `hook_restrict_signup_domain`
- Click **Create hook**.

With the hook on, Supabase itself refuses any email that isn't @stratpoint.com, even if someone skips the app's own check.

## 2. Email + password settings
**Authentication → Sign In / Providers → Email**
- **Enable Email provider:** on
- **Confirm email:** on. New accounts must click the link in their email before they can sign in. Keep this on: Marketing team access follows the email address, so confirming proves the person owns that inbox.
- **Minimum password length:** `8`
- **Password requirements:** No required characters
- Click **Save**.

## 3. Site URL and redirect URLs
**Authentication → URL Configuration**
- **Site URL:** the production address, e.g. `https://marketing-design-hub.vercel.app`. Until production exists, use the staging address.
- **Redirect URLs:** add each of these lines:
  - `http://localhost:3000/**`
  - `https://*-strat-marketing.vercel.app/**` (all Vercel preview and staging links)
  - your production address followed by `/**`

## 4. Email templates
**Authentication → Emails → Templates.** The branded templates live in this repo (same design as the app's notifications, Oct 18):

| Template | Subject | Body |
|---|---|---|
| **Confirm signup** | `Confirm your Marketing Design Hub account` | `docs/emails/confirm-signup.html` |
| **Reset Password** | `Set your Marketing Design Hub password` | `docs/emails/reset-password.html` |

Before pasting, replace `LOGO_URL` with `<project URL>/storage/v1/object/public/brand/logo.png` (the logo in the project's public **brand** storage folder). Both links point back to the app's `/auth/confirm` page, which works in any browser. Staging's templates were set through the Management API; production's are pasted by hand at release.

The Magic Link template is no longer used.

## 5. Session length (~30 days)
**Authentication → Sessions** (paid plans): set **Time-box user sessions** to `720` hours.
On the free plan, sessions refresh automatically while the app is used, so people stay signed in anyway.

## 6. Email sending (Resend)
**Authentication → Emails → SMTP Settings → Enable custom SMTP** (done Oct 16)
- Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
- Sender email: `marketingdesignhub@ejoo.site`, sender name `Marketing Design Hub`. `ejoo.site` is verified in Resend for now; switch to a Stratpoint address once IT adds the DNS records (`docs/it-dns-request.md`)
- Then **Authentication → Rate Limits**: raise "Rate limit for sending emails" to about 30 per hour

## People who signed in before passwords
Accounts made with the old email code have no password yet. On the sign-in page they click **Forgot password?**, enter their email, and set a password from the link.
