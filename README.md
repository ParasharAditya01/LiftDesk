# LiftDesk

LiftDesk is an India-first gym operations SaaS for independent gyms. The MVP is being rebuilt incrementally in this repository with a strict pre-revenue budget of ₹0–₹1,000.

## MVP scope

- Member management and membership expiry tracking.
- One universal QR code per gym with member phone OTP check-in.
- Inactivity and renewal follow-ups.
- Basic attendance and membership reports.
- Multi-gym architecture with gym-level isolation enforced by PostgreSQL Row Level Security (RLS).

## Stack

- React + TypeScript + Vite
- Responsive custom CSS design system (Tailwind remains configured for utility styling)
- Supabase Auth + PostgreSQL + RLS
- Universal gym QR links to a phone OTP check-in page; Supabase phone auth and an SMS provider must be configured.

## Current rebuild status

The live application already has sign-in, gym workspace setup, member records, manual check-in, attendance history, saved follow-up display and basic counts. `/preview` is a separate sample-data walkthrough and is **not connected to a database**.

The universal gym QR and member phone OTP flow is implemented in the current local working tree. It needs migration `0004_universal_gym_qr_checkin.sql`, Supabase phone auth/SMS setup, optional Turnstile keys, and real-device verification before production use. Local source changes are not automatically live.

## Local setup

1. Install a supported Node.js version (Vite requires a recent supported Node.js release).
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` when the Supabase stage is ready.
4. Add the Supabase project URL and publishable/anon key to `.env.local`.
5. Run `npm run dev`; run `npm run build` to verify the production bundle.

## Security requirements

- Every tenant-owned record must be associated with a `gym_id`.
- PostgreSQL RLS, not frontend filtering, is the security boundary.
- Every write must be authorized server-side and checked against the user's active gym membership and role.
- Universal QR attendance must match a verified member phone to exactly one member in the gym, then validate membership status, expiry date and duplicate-check-in window in a database function.
- Never put a Supabase service-role key in browser code or any `VITE_*` variable.
- Before a pilot, test with two separate gym-owner accounts and verify that neither gym can read or mutate the other's records.

## Pilot readiness checklist

- [ ] Supabase migrations reviewed and tested in a disposable project.
- [ ] Gym A / Gym B cross-tenant RLS tests pass for read and write operations.
- [ ] Role permissions and onboarding are verified.
- [ ] Expired and inactive member check-ins are rejected server-side.
- [ ] Duplicate check-ins are rejected server-side.
- [ ] Sign-up, email confirmation, sign-in and sign-out are tested.
- [ ] Production build passes.
- [ ] Layout checked at 320, 360, 375, 390px and desktop widths.
- [ ] Printed universal gym QR is scanned on real phones and phone OTP check-in is verified end-to-end.
- [ ] Supabase phone authentication, SMS provider, rate limits and CAPTCHA are configured and tested before enabling public member check-in.
- [ ] No production member data is used until the checks above pass.

## Not yet implemented or verified

Automated inactivity/renewal reminder creation, richer reports, billing, exports and audit logs are not complete. The universal QR OTP flow has not yet been applied to the live database or tested with a configured SMS provider and real phone. Production deployment of the current local changes is also pending.
