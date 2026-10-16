# Supabase sign-in setup (one time)

These settings live in the Supabase dashboard, not in the code. Open your project at https://supabase.com/dashboard and follow each step.

## 1. Turn on the @stratpoint.com check
**Authentication → Hooks (Auth Hooks) → Add hook → "Before User Created"**
- Hook type: **Postgres**
- Schema: `public`
- Function: `hook_restrict_signup_domain`
- Click **Create hook**.

With the hook on, Supabase itself refuses any email that isn't @stratpoint.com, even if someone skips the app's own check.

## 2. Site URL and redirect URLs
**Authentication → URL Configuration**
- **Site URL:** the production address, e.g. `https://marketing-design-hub.vercel.app`. Until production exists, use the staging address.
- **Redirect URLs:** add each of these lines:
  - `http://localhost:3000/**`
  - `https://*-strat-marketing.vercel.app/**` (all Vercel preview and staging links)
  - your production address followed by `/**`

## 3. Email template (link + 6-digit code in one email)
**Authentication → Emails → Templates → Magic Link**

Subject: `Your Marketing Design Hub sign-in`

Body (paste all of it):

```html
<h2>Sign in to Marketing Design Hub</h2>
<p>Click the button to sign in:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email"
      style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in</a></p>
<p>Or type this code on the sign-in page:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p style="color:#666;font-size:12px">If you didn't ask to sign in, you can ignore this email.</p>
```

Copy the same body into the **Confirm signup** template too. A person's very first sign-in uses that template.

## 4. Session length (~30 days)
**Authentication → Sessions** (paid plans): set **Time-box user sessions** to `720` hours.
On the free plan, sessions refresh automatically while the app is used, so people stay signed in anyway.

## 5. Email sending limits
Supabase's built-in email only delivers to **members of the Supabase project team** and sends just a few emails per hour. That's enough for testing.
Before real users sign in, set Resend as the sender:
**Authentication → Emails → SMTP Settings → Enable custom SMTP**
- Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
- Sender email: `designhub@ejoo.site`, sender name `Marketing Design Hub`. `ejoo.site` is verified in Resend for now; switch to a Stratpoint address once IT adds the DNS records (`docs/it-dns-request.md`)
- Then **Authentication → Rate Limits**: raise "Rate limit for sending emails" to about 30 per hour
