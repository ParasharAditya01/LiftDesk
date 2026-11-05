# LiftDesk 27-point security checklist

Reviewed against the repository on 5 November 2026. A source check or a migration
file does not prove that production has that setting or migration. The statuses
below distinguish code evidence from controls that need account access.

## Findings and status

| # | Control | Status | Evidence / remaining action |
|---|---|---|---|
| 1 | Proper authentication | PASS (code) | Supabase Auth password signup/sign-in and confirmed-email invitation acceptance are used. Live provider configuration still needs dashboard verification. |
| 2 | API key protection | PASS (code) | Browser client accepts only the Supabase publishable/anon key; no service-role key is referenced. Keep real environment files out of Git. |
| 3 | Database access restrictions | NEEDS LIVE TEST | RLS and role-scoped RPCs exist in migrations. Apply all migrations through `0017`, then run the two-gym test below with test accounts. |
| 4 | HTTPS | PASS (deployment configuration) | Cloudflare Pages serves the production host over HTTPS; HTTP redirects to HTTPS. HSTS is now configured in `_headers` and must be verified after deployment. |
| 5 | Password hashing | PASS (provider) | Supabase Auth owns password storage and hashing; LiftDesk does not store passwords. Confirm the Auth provider remains Supabase. |
| 6 | Server-side input validation | PASS (code, scoped) | Authorization-checking RPCs and database constraints validate sensitive writes. Keep equivalent validation in new RPCs and migrations. |
| 7 | XSS | PASS (source review, not penetration test) | React renders escaped text; no raw HTML injection APIs were found. CSP blocks scripts by default; inline style allowances remain for the current UI. |
| 8 | Suspicious activity monitoring | NEEDS DASHBOARD REVIEW | Supabase Auth/database logs are provider-managed. Configure alerting/retention in Supabase and Cloudflare; no external alert destination is configured by this repository. |
| 9 | Privileged access | PASS (code) | Gym role checks, RLS, invitation linking, and staff access synchronization protect privileged operations. Live role-boundary tests remain required. |
| 10 | SQL injection | PASS (source review) | App queries use Supabase's parameterized client and SQL RPCs use fixed SQL; dynamic SQL was not found. Static contract check covers sensitive RPCs. |
| 11 | Environment variables | PASS (repository) | `.env`/`.env.local` are ignored, `.env.example` contains placeholders, and privileged keys are explicitly forbidden in browser variables. Verify Cloudflare variables in its dashboard. |
| 12 | Rate limiting | PARTIAL | Supabase Auth/provider limits are external. New database-side limits cap member invitations at 20/hour and staff invitations at 10/hour per authenticated account; migration `0017` must be applied. Configure provider limits for Auth and edge/API endpoints in dashboards. |
| 13 | CORS | PASS (static-site configuration; deploy check pending) | `_headers` restricts static-site CORS to `https://liftdesk.pages.dev`. Supabase Auth/API CORS is configured separately and must include the intended app origins only. |
| 14 | Security headers | PASS (configuration; deploy check pending) | CSP, frame denial, MIME sniffing protection, referrer and permissions policies are configured. HSTS was added; verify response headers on the live site after deployment. |
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
| 27 | Security testing/report | PARTIAL | Static contract and unit tests run locally; the new live RLS harness requires two isolated test gyms and applied migrations. Production settings were not changed. |

## Repository fixes in this review

- Added HSTS and an exact production-origin CORS response header to
  `public/_headers`.
- Added migration `0017_invitation_rate_limits.sql` with concurrency-safe
  per-account limits for creating member and staff invitations.
- Added `npm run security:tenant-test`, a non-destructive test harness that
  checks own-gym visibility and cross-gym denial using HEAD requests that return
  counts only. It never reads or prints member/staff private fields or tokens.
- Extended the static security contract to assert the invitation limits and
  response-header configuration.

## Live tenant isolation test

Apply migrations through `0017` in a **non-production test project** first.
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

1. Apply and verify migrations `0011` through `0017` against the intended
   Supabase project. This review did not alter the database.
2. Run the fixture-backed isolation test above on staging before production.
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

Results are recorded in the task summary after running the available tests and
build. A successful local check proves repository behavior only; it does not
prove a production migration, dashboard setting, or live tenant-isolation test.
