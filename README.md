# GymPulse

GymPulse is an India-first gym operations SaaS MVP for independent gyms. The initial scope is member management, attendance, inactivity/renewal follow-ups, and basic reports.

## Stack
- React + TypeScript + Vite
- Tailwind CSS utilities plus a custom responsive design system
- Supabase Auth + PostgreSQL + Row Level Security (RLS)
- QR-code generation via `qrcode`

## Local setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
4. In Supabase SQL Editor, run `supabase/migrations/0001_initial_schema.sql`, then `supabase/migrations/0002_secure_manual_checkin.sql`.
5. Configure Supabase Auth email confirmation and redirect URLs.
6. Run `npm install`, then `npm run dev`. Run `npm run build` before deployment.

Only the publishable/anon key belongs in the browser. Never place a Supabase service-role key in `VITE_*` variables or commit secrets.

## Current implementation scope
- Email/password sign-up and sign-in.
- First-run gym workspace creation.
- Member records with plan label, fee, status, and expiry date.
- Manual check-in with server-side validation.
- Member-specific QR generation and download; QR token validation RPC is available for a future scanner flow.
- Seven-day inactivity flags and upcoming-renewal flags.
- Persisted follow-up tasks and basic reports.

## Security model
- Every tenant-owned row has a `gym_id`.
- RLS is enabled on gyms, profiles, gym memberships, members, attendance, and follow-ups.
- Membership/role checks are performed in database policies.
- Gym creation uses a restricted `SECURITY DEFINER` RPC.
- QR and manual check-ins validate gym membership, member status, expiry, and duplicate scans on the server.
- UI filters are for usability only; they are not the security boundary.

Before inviting real gyms, run the isolation checks below with two separate accounts and two gyms. Do not use production member data until these checks pass.

## Security and QA checklist
- [ ] Apply migrations in a disposable Supabase project first.
- [ ] Create Gym A and Gym B using separate owner accounts.
- [ ] Verify Gym A cannot select, insert, update, or delete Gym B records using the browser client.
- [ ] Verify staff cannot manage gym membership roles.
- [ ] Verify expired/inactive members cannot check in.
- [ ] Verify repeated check-ins are rejected server-side.
- [ ] Verify sign-up email confirmation and password reset behavior.
- [ ] Run `npm run build` and fix all TypeScript/build errors.
- [ ] Test 320px, 360px, 375px, 390px and desktop layouts.
- [ ] Configure Supabase Auth site URL and allowed redirect URLs for the deployed domain.

## Important limitations
- QR codes are generated and downloadable, and a secure QR validation RPC is provided. A live camera-scanning interface is not yet implemented.
- Inactivity and expiry flags are calculated when the workspace is loaded; scheduled notifications are not configured.
- Reports describe records stored in GymPulse. Listed monthly fees are not verified payments or revenue.
- Subscription billing, gym invitations, automated email/WhatsApp reminders, exports, audit logs, and paid-plan enforcement are not implemented yet.
- This repository has not yet been built or deployed in a live environment as part of this change. Treat it as an implementation in progress until the checklist is executed.
