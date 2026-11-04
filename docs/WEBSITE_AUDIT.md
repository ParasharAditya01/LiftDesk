# LiftDesk Website Audit & Remediation Checklist

Scope: the existing LiftDesk application on `liftdesk-rebuild`. Preserve the existing brand, React/Supabase architecture, live workspace, sample preview separation, and tenant security. Do not merge or deploy from this checklist.

Status vocabulary:
- **Open**: not yet verified or implemented.
- **Code risk**: issue identified from source inspection; production impact not established.
- **Verified**: only use after a reproducible test and record the test evidence.

## P0 — Security and data integrity
- [ ] Verify the deployed commit and Cloudflare Pages build configuration.
- [ ] Verify the live Supabase migration state, RLS policies, table grants, and attendance RPC grants.
- [ ] Run two-tenant read/write isolation tests with separate gym-owner accounts.
- [ ] Verify owner/admin/staff permissions against the live database.
- [ ] Verify the removed phone-OTP RPC is absent in production; migration source alone is not proof.
- [ ] Verify browser bundles and deployed environment contain no service-role secret.
- [ ] Test member status, expiry, gym ownership, and duplicate check-in enforcement server-side.

## P1 — Core workflows
- [ ] Exercise sign-up, confirmation email, resend, sign-in, invalid credentials, session refresh, sign-out, and first gym setup.
- [ ] Exercise member creation with valid and invalid values; confirm persisted values after reload.
- [ ] Exercise manual check-in success, expired/inactive member rejection, wrong-gym rejection, duplicate rejection, and failure recovery.
- [ ] Make dashboard date/count logic consistent with the Asia/Kolkata business timezone.
- [ ] Clarify and complete the follow-up workflow: create, update/contact, resolve, and persist status.
- [ ] Verify reports against real database records and clearly label any unavailable functionality.
- [ ] Test empty, loading, success, and error states for every data-backed view.
- [ ] Test large attendance histories and decide whether pagination or a bounded query is required.

## P2 — UI, navigation, accessibility and integration
- [ ] Test Overview, Members, Attendance, Follow-ups and Reports navigation.
- [ ] Test direct URLs, unknown paths, refresh, and browser back/forward behaviour.
- [ ] Inventory and test every button, menu item, form, dismiss action, external link and footer destination.
- [ ] Test mobile navigation, tables, dialogs, forms and notices at 320, 360, 375, 390, 720, 980, 1200 and desktop widths.
- [ ] Keyboard-test navigation, forms, dialogs, focus return, focus visibility, and Escape-to-close where appropriate.
- [ ] Check accessible names, heading hierarchy, table headers, status announcements, contrast and reduced-motion behaviour.
- [ ] Verify favicon, page title, meta description, canonical URL and social-sharing metadata.
- [ ] Check image assets, broken image requests, decorative-image handling and alternative text.
- [ ] Verify Supabase redirect URLs, email delivery configuration and Cloudflare environment settings.
- [ ] Verify privacy/terms/contact links before any real customer data is collected.

## P3 — Performance and polish
- [ ] Run a clean production build and record bundle-size warnings.
- [ ] Measure page load and interaction performance before introducing code splitting.
- [ ] Confirm the LiftDesk name, typography, theme selector and existing visual identity remain consistent.
- [ ] Review contrast for all nine supported gym themes.
- [ ] Re-run regression checks after every change.

## Current implementation notes
- `/` renders the authentication/live-workspace flow; `/preview` is a sample-data walkthrough.
- Sidebar sections are client-side state views, not separate URL routes.
- The static security-contract script is not a substitute for live PostgreSQL/RLS tests.
- Follow-up rows are currently displayed from the database; the inspected live UI does not expose create/resolve controls.
- This checklist is a work plan, not a claim that any item is complete.
