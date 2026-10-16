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
**Authentication → Emails → Templates.** Both links point back to the app's `/auth/confirm` page, which works in any browser.

**Confirm signup**

Subject: `Confirm your Marketing Design Hub account`

```html
<h2>Welcome to Marketing Design Hub</h2>
<p>Click the button to confirm your email and activate your account:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup"
      style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm my email</a></p>
<p style="color:#666;font-size:12px">If you didn't create an account, you can ignore this email.</p>
```

**Reset Password**

Subject: `Set your Marketing Design Hub password`

```html
<h2>Set a new password</h2>
<p>Click the button to choose a new password for Marketing Design Hub:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery"
      style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Set my password</a></p>
<p style="color:#666;font-size:12px">The link works once. If you didn't ask for this, you can ignore this email.</p>
```

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
