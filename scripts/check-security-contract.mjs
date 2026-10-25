import { readFileSync } from 'node:fs'

const initial = readFileSync('supabase/migrations/0001_initial_schema.sql', 'utf8')
const manual = readFileSync('supabase/migrations/0002_secure_manual_checkin.sql', 'utf8')
const membershipHardening = readFileSync('supabase/migrations/0003_harden_membership_writes.sql', 'utf8')
const app = readFileSync('src/lib/supabase.ts', 'utf8')
const failures = []
const requiredTables = ['gyms', 'profiles', 'gym_memberships', 'members', 'attendance', 'follow_ups']

for (const table of requiredTables) {
  if (!new RegExp('create\\s+table\\s+public\\.' + table + '\\b', 'i').test(initial)) failures.push('Missing table declaration: ' + table)
  if (!new RegExp('alter\\s+table\\s+public\\.' + table + '\\s+enable\\s+row\\s+level\\s+security', 'i').test(initial)) failures.push('RLS not enabled in initial migration: ' + table)
}

const requiredPolicies = [
  'gym members can read their gym',
  'users read own profile',
  'users update own profile',
  'gym members read workspace memberships',
  'owners manage workspace memberships',
  'gym staff read members',
  'gym staff add members',
  'gym staff update members',
  'owners remove members',
  'gym staff read attendance',
  'gym staff read follow ups',
  'gym staff create follow ups',
  'gym staff update follow ups',
  'owners delete follow ups',
]
for (const policy of requiredPolicies) {
  if (!initial.includes('create policy "' + policy + '"')) failures.push('Missing expected RLS policy: ' + policy)
}

for (const [name, source] of [
  ['create_gym_for_current_user', initial],
  ['check_in_with_qr', initial],
  ['record_manual_check_in', manual],
]) {
  const start = source.toLowerCase().indexOf('function public.' + name)
  const end = start < 0 ? -1 : source.indexOf('as $$', start)
  const header = start < 0 ? '' : source.slice(start, end < 0 ? start + 500 : end).toLowerCase()
  if (start < 0) failures.push('Missing security function: ' + name)
  else {
    if (!header.includes('security definer')) failures.push(name + ' must be SECURITY DEFINER')
    if (!header.includes("set search_path = ''")) failures.push(name + ' must pin an empty search_path')
  }
}
if (!/revoke all on function public\.record_manual_check_in\(uuid,uuid\) from public/i.test(manual)) failures.push('Manual check-in RPC must revoke PUBLIC execution')
if (!/grant execute on function public\.record_manual_check_in\(uuid,uuid\) to authenticated/i.test(manual)) failures.push('Manual check-in RPC must grant execution only to authenticated users')
if (!/revoke all privileges on table public\.gym_memberships from anon, authenticated/i.test(membershipHardening)) failures.push('Anon and authenticated clients must have direct membership-table privileges revoked')
if (!/grant select on table public\.gym_memberships to authenticated/i.test(membershipHardening)) failures.push('Authenticated clients must retain read-only membership access')

// Inspect executable configuration, not comments explaining what must never be done.
if (/VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SERVICE_KEY)/i.test(app) ||
    /createClient\s*\([^)]*(?:SERVICE_ROLE_KEY|service_role)/is.test(app)) {
  failures.push('Browser Supabase client must not be configured with a service-role credential')
}

if (failures.length) {
  console.error('LiftDesk security contract check failed:')
  for (const failure of failures) console.error(' - ' + failure)
  process.exit(1)
}
console.log('LiftDesk security contract check passed: expected tables, RLS declarations, policies, and RPC hardening are present.')
console.log('Note: this is a static source check, not a live database penetration test.')
