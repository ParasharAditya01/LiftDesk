# LiftDesk

LiftDesk is an India-first gym operations SaaS for independent gyms. The MVP is being rebuilt incrementally in this repository with a strict pre-revenue budget of ₹0–₹1,000.

## MVP scope

- Member management and membership expiry tracking.
- Trainer-recorded attendance with gym-scoped authorization.
- Attendance-based follow-up tracking, including time since each member's last visit and saved follow-up records.
- Basic attendance and membership reports.
- Trainer coaching workspace for member-specific plans, progress and notes.
- A restricted member portal for a member's own profile, published plans and permitted progress records.
- Gym-scoped staff workspace and invitations, plus gym chat with optional web push notifications.
- Multi-gym architecture with gym-level isolation enforced by PostgreSQL Row Level Security (RLS).

## Roles

- **Owner**: owns and controls their own gym workspace.
- **Admin**: existing operational administrator role; permissions remain as currently enforced.
- **Trainer**: the active role for trainer-assisted attendance and permitted gym operations. The former `staff` enum value is renamed to `trainer` by migration `0007`; existing memberships are preserved.
- **Member**: has a restricted member portal for their own profile, published coaching plans and permitted progress records. Members do not receive staff workspace permissions or access to other members' records.

Existing `staff` memberships are migrated in place to `trainer`; user accounts and gym membership rows are preserved.

## Stack

- React + TypeScript + Vite
- Responsive custom CSS design system with PostCSS Autoprefixer processing
- Supabase Auth + PostgreSQL + RLS

## Current rebuild status

The current branch includes sign-in and owner access requests, gym workspaces, member and staff management, member invitations and the member portal, trainer coaching tools, manual check-in and attendance history, attendance-based follow-up tracking, basic live workspace reports, and gym chat. `/preview` is a separate sample-data walkthrough and is **not connected to a database**. The current production deployment must be checked separately; source code on this branch does not prove what is live.

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
- [ ] Before chat push notifications, complete the VAPID key, Supabase migration/Edge Function, and Cloudflare Pages setup in [the web push setup guide](docs/WEB_PUSH_NOTIFICATIONS.md).
- [ ] Production build passes.
- [ ] Layout checked at 320, 360, 375, 390px and desktop widths.
- [ ] Trainer manual check-ins are verified against the member's gym, active status, expiry date and duplicate-check-in window.
- [ ] No production member data is used until the checks above pass.

## Not yet implemented or verified

- **Automated reminders:** Follow-ups reports each member's most recent attendance and days away, and the app can store follow-up records. It does not automatically send inactivity or renewal reminders to members.
- **Advanced reports:** Live reports currently show basic workspace counts. Trend analysis, configurable reporting periods and live-data CSV export are not implemented. The `/preview` CSV export uses sample records only.
- **Billing:** Gym subscription and payment processing are not implemented.
- **Audit history:** Staff role and active-status changes have an append-only access audit. Staff attendance corrections retain updater and timestamp fields. A comprehensive audit trail for all important changes across the app is not implemented.
- **Production database verification:** The repository includes migration `0006_disable_phone_otp_checkin.sql`, which revokes the old phone-OTP check-in RPC when applied. Its presence in this branch does not prove it has been applied to the production Supabase database. Verify the production database before saying that RPC is removed there.

These limitations describe the current `liftdesk-rebuild` source. They do not by themselves establish which features or migrations are present in the live production deployment.

## Routes, indexing and static assets

- `/` is the sign-in and workspace entry point. Gym owners submit an access request before receiving an owner workspace; approved members and staff enter their role-specific workspace after sign-in.
- `/preview` is a sample-data walkthrough, not a customer-facing marketing page and never writes to Supabase.
- Both application routes are marked `noindex, nofollow`; `robots.txt` disallows crawling because this repository currently has no public, indexable product pages. No sitemap is published until such pages exist.
- Cloudflare Pages serves the top-level `404.html` for unmatched file routes; the React router also renders a branded 404 view if an unknown path reaches the app shell.
- The favicon is the LiftDesk activity mark in `public/favicon.svg`.

There is not enough verified owner, contact, retention, cookie, or legal information in the repository to publish a privacy policy or terms page. Customer testimonials, social profiles, and public support contacts have not been supplied. GA4 is not configured because no Measurement ID or consent requirements were provided. Turnstile/WAF deployment is not claimed: the Cloudflare account configuration and server-side verification credentials are not part of the repository.
