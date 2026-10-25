# LiftDesk

LiftDesk is an India-first gym operations SaaS for independent gyms. The MVP is being rebuilt incrementally in this repository with a strict pre-revenue budget of ₹0–₹1,000.

## MVP scope

- Member management and membership expiry tracking.
- Member-specific QR codes and QR attendance.
- Inactivity and renewal follow-ups.
- Basic attendance and membership reports.
- Multi-gym architecture with gym-level isolation enforced by PostgreSQL Row Level Security (RLS).

## Stack

- React + TypeScript + Vite
- Responsive custom CSS design system (Tailwind remains configured for utility styling)
- Supabase Auth + PostgreSQL + RLS
- QR generation and browser camera scanning planned for the attendance stage

## Current rebuild status

The first rebuild commit introduces the LiftDesk interface foundation and responsive navigation. It currently uses clearly labelled sample preview records; the preview is **not connected to a database** and is not ready for real gym data. Actions in the preview must not be interpreted as persisted operations.

Planned implementation order:
1. Interface and responsive states.
2. Supabase authentication and first-run gym setup.
3. Tenant-isolated member management.
4. Server-validated manual and QR attendance.
5. Renewal/inactivity follow-ups and basic reports.
6. Security, build and responsive QA before the pilot.

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
- QR attendance must validate the random token, gym, membership status, expiry date and duplicate-scan window in a database function.
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
- [ ] Camera QR scanning is tested on a real browser/device.
- [ ] No production member data is used until the checks above pass.

## Not yet implemented or verified

This is an active rebuild, not a production-ready service. Authentication, database integration, QR scan processing, real reports, automated reminders, billing, exports, audit logs and production deployment require subsequent implementation and testing. No build or deployment success is claimed until a run confirms it.
