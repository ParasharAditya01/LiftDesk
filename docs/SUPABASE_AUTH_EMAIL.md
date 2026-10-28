# LiftDesk owner signup and Supabase email delivery

## What the application error means

LiftDesk maps Supabase Auth code `over_email_send_rate_limit` to the email-limit message. The signup and resend functions preserve the returned provider code for development diagnostics (without logging email addresses, message bodies, or tokens). The app cannot inspect the live Supabase Auth logs from this repository, so the code proves which response produces the message, not which project setting caused a particular live attempt.

Supabase documents a built-in email provider limit of two emails per hour per project, and it only sends to addresses on the Supabase organization team. Those provider-side restrictions cannot be removed in browser code. A local 60-second wait in LiftDesk prevents rapid repeat clicks; it does not reset or bypass Supabase's limit. The same action may also be limited by the recipient-specific confirmation interval.

## Dashboard setup the project owner must perform

1. In Supabase, open **Authentication → URL Configuration**. Set the **Site URL** to `https://liftdesk.pages.dev/` for production.
2. Add the production redirect `https://liftdesk.pages.dev/` to **Redirect URLs**.
3. Add only the development origins actually used, for example `http://localhost:5173/` and/or `http://127.0.0.1:5173/`.
4. In **Authentication → Emails → SMTP Settings**, enable custom SMTP for general owner registration. Create/verify a sender identity with the chosen email provider and enter its host, port, username, password, sender email, and sender name in the Supabase dashboard. Keep these credentials in Supabase's secret settings; never add them to `.env`, browser code, or Git.
5. Configure SPF, DKIM, and DMARC for the sending domain with the chosen provider. Check that the confirmation template uses Supabase's confirmation URL flow and does not hardcode the production site URL in place of the redirect target.
6. Check the Supabase Auth logs and provider delivery logs after a test. A successful signup API response means Supabase accepted the request; it does not prove inbox delivery.
7. Keep **Confirm email** enabled. Do not disable confirmation to work around a send limit.

The Site URL and allow-list must match the app's `emailRedirectTo`. LiftDesk builds that URL from the current origin, so production returns to `https://liftdesk.pages.dev/` and local development returns to its current localhost origin. Supabase's JS client has session persistence and `detectSessionInUrl` enabled; it consumes the confirmation callback and the auth-state listener loads the authenticated user's workspace. Gym creation remains behind that authenticated session and the existing database RPC/RLS rules.

## First-owner verification steps

1. Confirm custom SMTP and redirect URLs are saved, then wait out any existing provider limit.
2. Use an email address that has not been registered in this Supabase project.
3. Open the production LiftDesk root and create an owner account once. If the screen reports a limit, do not repeatedly resubmit; check Supabase Auth logs and the SMTP provider logs.
4. If Supabase accepts the request, check inbox and spam. Delivery is not guaranteed by the client response.
5. Open the newest confirmation link. It should return to `https://liftdesk.pages.dev/`; the client should establish a session and show first-time gym setup. Create a gym and verify that the owner workspace loads.
6. Sign out and sign in with the confirmed account. A confirmed account should enter its existing workspace rather than return to signup.
7. To test locally, use a Supabase test project or local Supabase Auth with Mailpit. Do not repeatedly test against the production email quota.

## Known constraints

- The actual rate-limit state, SMTP credentials, sender verification, live redirect allow-list, and email delivery logs are dashboard/provider state and were not available to this code change.
- Supabase may intentionally avoid revealing whether an email belongs to an existing account. LiftDesk offers sign-in and a confirmation resend without asserting that a hidden account is confirmed.
- Build/unit tests do not send real email or prove a live confirmation callback. Complete the fresh-account test above after dashboard configuration.
