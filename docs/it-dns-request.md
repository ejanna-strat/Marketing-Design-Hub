# Email to IT: DNS records for the Marketing Creative Hub

**To:** IT / Infrastructure team
**Subject:** DNS records needed so the Marketing Creative Hub can send email

Hi team,

Marketing is launching the **Marketing Creative Hub**, an internal web app for design requests. It sends sign-in emails and status notifications (for example, "your design is ready") to @stratpoint.com addresses.

To send these emails reliably and avoid spam folders, we use an email service called **Resend**. Resend needs a few DNS records on a Stratpoint subdomain so it can prove the emails are really from us.

**Request:**
1. Could we use a subdomain such as `creativehub.stratpoint.com` (or another one you prefer) for sending?
2. Once you confirm, I'll send you the exact records from Resend. These are usually:
   - 1 × TXT record (SPF)
   - 1 × TXT/CNAME record (DKIM)
   - 1 × MX record (bounce handling)
   - Optional: 1 × TXT record (DMARC)

The records only cover this subdomain. They don't change anything about our main @stratpoint.com mailboxes.

The emails would come from an address like `creativehub@creativehub.stratpoint.com`.

Thank you!
Stratpoint Marketing (marketing-ai@stratpoint.com)
