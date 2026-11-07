# LiftDesk 27-point security checklist

Reviewed against the repository and live Supabase/Cloudflare configuration on 7 November 2026. A source check or a migration
file does not prove that production has that setting or migration. The statuses
below distinguish code evidence from controls that need account access.

## Findings and status

| # | Control | Status | Evidence / remaining action |
|---|---|---|---|
| 1 | Proper authentication | PASS (code) | Supabase Auth password signup/sign-in and confirmed-email invitation acceptance are used. Live provider configuration still needs dashboard verification. |
| 2 | API key protection | PASS (code) | Browser client accepts only the Supabase publishable/anon key; no service-role key is referenced. Keep real environment files out of Git. |
| 3 | Database access restrictions | PARTIAL (live metadata verified) | Live sensitive tables have RLS enabled and direct anonymous `SELECT` is not granted. Tenant isolation still needs a fixture-backed two-gym test; the current production project does not have isolated test credentials. |
| 4 | HTTPS | PASS (deployment configuration) | Cloudflare Pages serves the production host over HTTPS; HTTP redirects to HTTPS. HSTS is now configured in `_headers` and must be verified after deployment. |
| 5 | Password hashing | PASS (provider) | Supabase Auth owns password storage and hashing; LiftDesk does not store passwords. Confirm the Auth provider remains Supabase. |
| 6 | Server-side input validation | PASS (code, scoped) | Authorization-checking RPCs and database constraints validate sensitive writes. Keep equivalent validation in new RPCs and migrations. |
| 7 | XSS | PASS (source review, not penetration test) | React renders escaped text; no raw HTML injection APIs were found. CSP blocks scripts by default; inline style allowances remain for the current UI. |
| 8 | Suspicious activity monitoring | NEEDS DASHBOARD REVIEW | Supabase Auth/database logs are provider-managed. Configure alerting/retention in Supabase and Cloudflare; no external alert destination is configured by this repository. |
| 9 | Privileged access | PASS (code) | Gym role checks, RLS, invitation linking, and staff access synchronization protect privileged operations. Live role-boundary tests remain required. |
| 10 | SQL injection | PASS (source review) | App queries use Supabase's parameterized client and SQL RPCs use fixed SQL; dynamic SQL was not found. Static contract check covers sensitive RPCs. |
| 11 | Environment variables | PASS (repository) | `.env`/`.env.local` are ignored, `.env.example` contains placeholders, and privileged keys are explicitly forbidden in browser variables. Verify Cloudflare variables in its dashboard. |
| 12 | Rate limiting | PARTIAL | Production now enforces per-account limits of 20 member invitations/hour and 10 staff invitations/hour. Supabase Auth/provider limits remain external; review Auth and edge/API limits in the provider dashboards. |
| 13 | CORS | PASS (live response checked) | Production returns `Access-Control-Allow-Origin: https://liftdesk.pages.dev`. Supabase Auth/API CORS is configured separately and must include only intended app origins. |
| 14 | Security headers | PASS (live response checked) | Production returns HSTS, CSP, frame denial, MIME sniffing protection, referrer and permissions policies. |
| 15 | HttpOnly session cookies | NEEDS ARCHITECTURE DECISION | This is a browser-only SPA using Supabase JS persisted sessions; JavaScript can access its auth session. HttpOnly cookies require a server-side/BFF session architecture. Do not call current storage HttpOnly-secure. |
| 16 | CSRF | N/A for current bearer-token requests | The app does not authenticate with ambient cookies, so classic cookie CSRF is not the primary risk. Reassess if a BFF/HttpOnly cookie session is introduced. |
| 17 | Password reset | N/A (feature not present) | LiftDesk has no password-reset UI or custom reset endpoint. If added, use Supabase's expiring, single-use recovery links and a fixed allow-listed redirect. |
| 18 | File uploads | N/A (feature not present) | The app currently has no upload flow or Supabase Storage bucket for private member data. If added, use a private bucket, size/type validation, scoped policies, and signed URLs. |
| 19 | Payments/pricing | N/A | No payment processing or price calculation exists in the app. |
| 20 | Production debug mode | PASS (build configuration) | Vite production builds do not enable debug mode or source maps by default. Browser diagnostics are development-only and omit emails/tokens. |
| 21 | Vulnerable dependencies | PASS (last audit) | `npm audit` returned zero advisories during the prior review. Re-run against the current lockfile before each release. |
| 22 | Unused dependencies | PASS (repository review) | Removed the unused Tailwind package/configuration and the unused Turnstile site-key placeholder. Kept PostCSS and Autoprefixer; the production asset hashes match before and after cleanup. |
| 23 | Exposed files/backups | PASS (last live probe; recheck after deploy) | Production probes for `.env` and `.git/config` returned 404; unknown paths returned 404. Never publish source maps, backups, or environment files. |
| 24 | Git history secrets | PASS (targeted scan, limited) | A targeted scan in the previous review found no known secret patterns. This is not a complete secret-scanner guarantee; enable GitHub secret scanning/push protection and scan the full history. |
| 25 | Credential rotation | NEEDS OWNER REVIEW | No compromised key was identified. Rotate any key ever committed, shared, or exposed; this requires owner/provider dashboard action. |
| 26 | Comprehensive review | PASS (source review, scoped) | Core auth, RLS, invitation, staff, coaching, attendance, and deployment code was reviewed. This is not a professional penetration test or formal certification. |
| 27 | Security testing/report | PARTIAL | Static contract checks and live database metadata checks were run. The live RLS harness still requires two isolated test gyms and short-lived test sessions; do not use real member data for that test. |

## Repository fixes in this review

- Added HSTS and an exact production-origin CORS response header to
  `public/_headers`.
- Applied and verified production migration `20261107145002_invitation_rate_limits.sql`:
  concurrency-safe limits of 20 member invites/hour and 10 staff invites/hour per account.
- Applied and verified production migration `20261107145008_require_owner_city.sql`:
  the owner workspace RPC now rejects missing or invalid city values server-side.
- Applied and verified production migration `20261107145021_require_member_staff_email.sql`:
  new or changed member/staff email values are normalized and validated by database triggers;
  existing legacy blank values are not rewritten.
- Applied `20261107143754_tighten_sensitive_rpc_grants.sql`: anonymous execution is
  denied for sensitive RPCs; authenticated execute remains only where required.
- Live chat aggregate check found 3 encrypted and 10 legacy plaintext messages;
  none of the legacy messages are older than 48 hours or pinned. The retention
  cron is active every minute, and new inserts are required to be encrypted.
- Added `npm run security:tenant-test`, a non-destructive test harness that
  checks own-gym visibility and cross-gym denial using HEAD requests that return
  counts only. It never reads or prints member/staff private fields or tokens.
- Extended the static security contract to assert the invitation limits and
  response-header configuration.

## Live tenant isolation test

Use a **separate non-production test project** with the current migrations.
Create two separate gym-owner test users and gyms. Seed each gym with at least
one harmless row in every table listed by the script; otherwise that table is
reported as `NEEDS_FIXTURE_OR_REVIEW`, because an empty table cannot prove an
RLS boundary. Generate each owner's short-lived access token from their own
session. In a local shell, set these variables without committing them:

```sh
export LIFTDESK_SUPABASE_URL='https://your-project.supabase.co'
export LIFTDESK_SUPABASE_PUBLISHABLE_KEY='your-publishable-key'
export LIFTDESK_GYM_A_ACCESS_TOKEN='short-lived-test-session-token-a'
export LIFTDESK_GYM_A_ID='gym-a-uuid'
export LIFTDESK_GYM_B_ACCESS_TOKEN='short-lived-test-session-token-b'
export LIFTDESK_GYM_B_ID='gym-b-uuid'
npm run security:tenant-test
```

The script prints only table names and pass/review statuses. Every table must
report `PASS`; it requires both accounts to see their own fixtures and Gym A to
see zero rows from Gym B. Remove the test accounts and fixtures after testing.
Do not use real member records or production tokens.

## Manual dashboard actions

1. Verified in production: the current migration records through
   `20261107145021`; keep local migration files aligned with those exact versions.
2. Run the fixture-backed isolation test above on staging before claiming live
   cross-gym denial has been end-to-end proven.
3. In Supabase Auth, restrict Site URL and redirect allow-list entries to the
   production app and actively used development origins. Review Auth rate
   limits, email SMTP, log retention, and alert destinations.
4. In Cloudflare, verify `Strict-Transport-Security` and
   `Access-Control-Allow-Origin` on the deployed response. Review WAF/rate
   limiting, deploy permissions, and environment variables.
5. Enable GitHub secret scanning and push protection, require MFA for GitHub,
   protect the release branch, and review collaborator access.
6. Confirm Supabase backup retention and test a restore using the plan's
   supported process.
7. Consider a backend-for-frontend architecture if HttpOnly session cookies
   are a requirement. Current SPA tokens are accessible to JavaScript.

## Checks from this implementation

Local and live results are recorded in the task summary. A successful local
check proves repository behavior only; it does not prove a dashboard setting,
live tenant-isolation test, or email delivery.
