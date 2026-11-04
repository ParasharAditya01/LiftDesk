# LiftDesk security review — 4 November 2026

This is a source-repository review. A migration file or RLS policy in Git does
not prove that the production database has that migration or policy applied.

## Implemented in the repository

- Gym records and the core member, attendance, follow-up, and coaching tables
  use gym-scoped RLS policies. Coaching records also use composite member/gym
  foreign keys.
- Member and staff invitations use one-time tokens stored as hashes, expire,
  and are accepted only after matching a confirmed account to the invited
  email. The staff invitation migration (0014) was confirmed applied in
  GymPulse production in the prior session.
- Attendance is written through authorization-checking database RPCs. Staff
  role and active-status edits now use migration 0015 to synchronize the
  linked `gym_memberships` row and add an access-change audit record.
- Browser configuration uses the Supabase publishable/anon key. No service-role
  key is referenced by the browser client. Real `.env` files are not tracked.
- `scripts/check-security-contract.mjs` checks important SQL and client-side
  security assumptions. It is a static source check, not a live penetration or
  tenant-isolation test.

## Requires production migration

Apply `supabase/migrations/0015_sync_staff_access_changes.sql` to GymPulse
production before relying on the updated staff edit screen. Verify that a
Trainer's linked membership becomes inactive on offboarding, becomes active
again on reactivation, changes role when the Owner changes the role, and that
each change appears in `gym_staff_access_events`. Test that an Admin cannot
promote a Trainer to Admin and cannot view another gym's records.

## Not configured or not verified from this repository

- **Application MFA:** No Supabase TOTP enrollment/challenge flow or AAL2
  database enforcement is present. Configure and test Owner/Admin enrollment
  before enforcing AAL2; enforcing it before access is verified can lock out
  the gym owner. GitHub and Supabase organization MFA are account settings.
- **Email delivery:** Custom SMTP cannot be configured safely in this frontend.
  Follow `docs/SUPABASE_AUTH_EMAIL.md` and configure provider credentials in
  Supabase Auth. Verify a real delivery in provider logs.
- **Bot protection:** Turnstile is not implemented; only an optional site-key
  type exists. There is no server-side token validator in this repository.
  Do not add a widget alone and call forms protected. This needs a server-side
  verifier (for example, a Cloudflare Worker) and dashboard secrets.
- **Live cross-gym RLS tests:** The source tests do not authenticate as two real
  gym accounts. Verify with dedicated test accounts and harmless test records
  in a non-production environment before calling tenant isolation live-tested.
- **Storage privacy:** The app currently does not use Supabase Storage for
  private progress photos. If photo uploads are added, use a private bucket,
  gym/member-scoped storage policies, and signed URLs.
- **Backups and monitoring:** Review the Supabase plan's backup retention and
  restore options, enable appropriate database/auth alerts, and test a restore.
  These are project dashboard and plan settings, not source-code guarantees.
- **Cloudflare/GitHub account protection:** Review Cloudflare WAF/rate limits,
  deploy permissions, GitHub MFA, branch protection, and collaborator access
  in their respective dashboards. No account settings were changed here.

## Validation performed

`npm test`, `npm run security:check`, and `npm run build` passed during this
review. These checks validate repository code only; they do not establish the
production migration, Supabase Auth settings, Cloudflare protections, backup
status, or live cross-gym behavior.
