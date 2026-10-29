# LiftDesk

LiftDesk is an India-first gym operations SaaS for independent gyms. The MVP is being rebuilt incrementally in this repository with a strict pre-revenue budget of ₹0–₹1,000.

## MVP scope

- Member management and membership expiry tracking.
- Trainer-recorded attendance with gym-scoped authorization.
- Inactivity and renewal follow-ups.
- Basic attendance and membership reports.
- Multi-gym architecture with gym-level isolation enforced by PostgreSQL Row Level Security (RLS).

## Roles

- **Owner**: owns and controls their own gym workspace.
- **Admin**: existing operational administrator role; permissions remain as currently enforced.
- **Trainer**: the active role for trainer-assisted attendance and permitted gym operations. The former `staff` enum value is renamed to `trainer` by migration `0007`; existing memberships are preserved.
- **Member**: role value is reserved in the schema, but member-facing access is intentionally blocked until its permissions are explicitly defined. A member role must not inherit trainer access or expose other members' records.

Existing `staff` memberships are migrated in place to `trainer`; user accounts and gym membership rows are preserved.

## Stack

- React + TypeScript + Vite
- Responsive custom CSS design system (Tailwind remains configured for utility styling)
- Supabase Auth + PostgreSQL + RLS

## Current rebuild status

The current branch contains sign-in, gym workspace setup, member records, manual check-in, attendance history, saved follow-up display and basic counts. `/preview` is a separate sample-data walkthrough and is **not connected to a database**. The current production deployment must be checked separately; source code on this branch does not prove what is live.

Member QR/WhatsApp OTP check-in has been removed from the interface. Trainers record attendance from the Members screen with the Manual check-in action. Migration `0006_disable_phone_otp_checkin.sql` revokes and removes the old phone-OTP RPC; its production application status must be verified separately. Local source changes are not automatically live.

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
- Manual attendance must authorize a trainer role in the target gym, validate the selected member's gym, status and expiry date, and block rapid duplicate check-ins in a database function.
- Never put a Supabase service-role key in browser code or any `VITE_*` variable.
- Before a pilot, test with two separate gym-owner accounts and verify that neither gym can read or mutate the other's records.

## Pilot readiness checklist

- [ ] Supabase migrations reviewed and tested in a disposable project.
- [ ] Gym A / Gym B cross-tenant RLS tests pass for read and write operations.
- [ ] Role permissions and onboarding are verified.
- [ ] Expired and inactive member check-ins are rejected server-side.
- [ ] Duplicate check-ins are rejected server-side.
- [ ] Sign-up, email confirmation, sign-in and sign-out are tested.
- [ ] Before public owner signup, configure verified custom SMTP and the production/local Auth redirect URLs using [the Supabase email setup guide](docs/SUPABASE_AUTH_EMAIL.md).
- [ ] Production build passes.
- [ ] Layout checked at 320, 360, 375, 390px and desktop widths.
- [ ] Trainer manual check-ins are verified against the member's gym, active status, expiry date and duplicate-check-in window.
- [ ] No production member data is used until the checks above pass.

## Not yet implemented or verified

Automated inactivity/renewal reminder creation, richer live reports, billing, and audit logs are not complete. Preview CSV export contains sample data only. Do not claim that the OTP RPC is removed from production until migration `0006_disable_phone_otp_checkin.sql` has been verified there.

## Routes, indexing and static assets

- `/` is the owner sign-in and workspace setup application.
- `/preview` is a sample-data walkthrough, not a customer-facing marketing page and never writes to Supabase.
- Both application routes are marked `noindex, nofollow`; `robots.txt` disallows crawling because this repository currently has no public, indexable product pages. No sitemap is published until such pages exist.
- Cloudflare Pages serves the top-level `404.html` for unmatched file routes; the React router also renders a branded 404 view if an unknown path reaches the app shell.
- The favicon is the LiftDesk activity mark in `public/favicon.svg`.

There is not enough verified owner, contact, retention, cookie, or legal information in the repository to publish a privacy policy or terms page. Customer testimonials, social profiles, and public support contacts have not been supplied. GA4 is not configured because no Measurement ID or consent requirements were provided. Turnstile/WAF deployment is not claimed: the Cloudflare account configuration and server-side verification credentials are not part of the repository.
