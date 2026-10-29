# LiftDesk Auth confirmation email setup

## Scope and current behavior

The application uses Supabase Auth email confirmation for gym-owner accounts and for gym members who register from a staff-created invitation link. The **Resend confirmation email** button calls Supabase's signup-resend endpoint using the email currently in the form. LiftDesk prevents duplicate requests while one is active and applies a short wait after successful requests or rate-limit responses.

An error-free Supabase response means the request was accepted by Auth; it does **not** prove that an email reached the recipient. The UI therefore says “Confirmation request submitted” and explicitly says LiftDesk cannot confirm inbox delivery. Check Supabase Auth logs and the email provider's delivery log to verify handoff and delivery.

The **Members** screen can create a gym-scoped, single-use invitation link (valid for 48 hours) that the owner shares privately. A member signs up through Supabase Auth from that link. The invitation token is included in the confirmation redirect and is preserved when a confirmation email is resent. Acceptance still uses the existing authenticated RPC and tenant authorization; SMTP changes do not change invitation permissions.

## Required dashboard setup

The Supabase built-in email service is for development and testing: it currently allows two Auth emails per hour per project, only sends to pre-authorized team addresses, and does not guarantee delivery. Configure a custom SMTP provider before relying on owner signup for general users. Limits can change; check the current [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) and [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

### Example: Resend

1. Create a [Resend](https://resend.com/) account and add a sending domain you control in its Domains dashboard. Follow the DNS records Resend shows for that domain. Wait until the domain is verified for sending. Use a From address on that verified domain (for example, `no-reply@your-domain.example`); do not assume a free/test account can send to arbitrary recipients or from an unverified address. Check Resend's current plan and sending limits in its dashboard.
2. Create a Resend API key intended for SMTP use. Treat it like a password. Resend's current SMTP settings are host `smtp.resend.com`, username `resend`, password your Resend API key, port `465` for SMTPS (or `587` for STARTTLS). Use the port and encryption mode supported by the Supabase SMTP form and provider docs. See [Resend SMTP settings](https://resend.com/features/smtp-service).
3. In Supabase Dashboard, open **Authentication → Emails → SMTP Settings**. Enable custom SMTP.
4. Enter the verified sender email, sender name `LiftDesk`, SMTP host, port, username, and password. For Resend, that means the settings above and your own verified From address. Save the settings.
5. In Supabase **Authentication → URL Configuration**, set the production Site URL to `https://liftdesk.pages.dev/` and allow `https://liftdesk.pages.dev/**` so the root callback can retain its `invite` query parameter. For local development, allow only the origins used locally, such as `http://localhost:5173/**` and `http://127.0.0.1:5173/**`.
6. Keep **Confirm email** enabled. Do not put the SMTP password or Resend API key in `.env`, any `VITE_*` variable, frontend source, or Git. SMTP credentials belong only in Supabase's dashboard configuration.
7. Submit one fresh test signup. Check **Supabase Auth logs** for provider handoff/errors and Resend's **Emails** activity for accepted, delivered, bounced, or failed status. Check the recipient inbox and spam folder. A provider's delivered status still does not prove the user read or saw the message.

Resend's host/username/password values are provider-specific and can change. Recheck its current [SMTP documentation](https://resend.com/docs/send-with-smtp) and the account's domain/plan restrictions before configuring. Supabase also applies its own Auth email rate limits after custom SMTP is enabled; a provider can apply additional limits.

## Redirect and session behavior

Production signups and resends use `https://liftdesk.pages.dev/`. Local development uses the current origin only when Vite is in development and the host is localhost/loopback. Other hosts (including Pages preview deployments) fall back to production. For member signup/resend, LiftDesk retains the `invite` query parameter while pinning the callback host to the production or local LiftDesk origin. Supabase must allow the matching redirect URL and the email template should use `{{ .RedirectTo }}` where applicable. The Supabase browser client persists sessions and detects confirmation callbacks in the URL; after confirmation, the existing auth listener accepts the invitation and loads the member portal. Owner gym creation and member invitation acceptance continue to use the existing authenticated RPC/RLS authorization.

## Real confirmation verification checklist

1. Complete the SMTP and redirect dashboard setup above and wait for any existing rate limit to reset.
2. Use a fresh test address that has not already been registered in the Supabase project. Test both (a) a gym-owner account and (b) a member signup opened from a fresh invitation link created by staff.
3. Confirm the app says the request was submitted, without claiming delivery. Check inbox and spam; if it is missing, inspect the Supabase Auth log and provider delivery event before retrying.
4. Open the actual confirmation email. Verify the From address/domain and that the confirmation link returns to `https://liftdesk.pages.dev/`.
5. For the owner account, verify the confirmed session reaches first-time gym setup, create a test gym, and sign out/in to check the returning-owner path.
6. For the member account, verify the confirmation link returns to LiftDesk with the same `invite` parameter, the session accepts that still-valid invitation, and the member portal opens. The invitation remains single-use and expires after 48 hours.
7. For resend verification, use a still-unconfirmed test account, wait until the button is enabled, click once, and confirm the UI reports only request acceptance. On a member invite, confirm the `invite` token remains in the redirect. Check provider logs for actual status and the rate-limit error if the provider rejects the request.

Unit tests do not send real email or prove callback delivery. The Supabase SMTP credentials, sender-domain verification, redirect allow-list, provider quota, and delivery logs are external settings and still require owner verification.
