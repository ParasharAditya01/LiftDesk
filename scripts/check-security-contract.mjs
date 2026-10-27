import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(resolve(root, path), 'utf8')
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\r\n]*/g, '')
const compact = source => stripComments(source).toLowerCase().replace(/\s+/g, ' ').trim()
const migrations = Object.fromEntries([1, 2, 3, 4, 5].map(version => {
  const id = String(version).padStart(4, '0')
  return [id, compact(read(`supabase/migrations/${id}_${[
    '', 'initial_schema', 'secure_manual_checkin', 'harden_membership_writes',
    'universal_gym_qr_checkin', 'gym_themes',
  ][version]}.sql`))]
}))
const allSql = Object.values(migrations).join('\n')
const failures = []
const fail = message => failures.push(message)
const requireText = (source, fragment, message) => {
  if (!source.includes(fragment.toLowerCase().replace(/\s+/g, ' ').trim())) fail(message)
}

function functionsNamed(source, name) {
  const matches = []
  const startPattern = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\(`, 'g')
  for (const match of source.matchAll(startPattern)) {
    const headerEnd = source.indexOf('as $$', match.index)
    const bodyEnd = headerEnd < 0 ? -1 : source.indexOf('$$;', headerEnd + 5)
    if (headerEnd < 0 || bodyEnd < 0) continue
    matches.push({ header: source.slice(match.index, headerEnd), body: source.slice(headerEnd + 5, bodyEnd) })
  }
  return matches
}

function requireFunction(name, source, check) {
  const found = functionsNamed(source, name)
  if (!found.length) {
    fail(`Missing function definition: ${name}`)
    return []
  }
  for (const fn of found) {
    if (!fn.header.includes('security definer')) fail(`${name} must be SECURITY DEFINER`)
    if (!fn.header.includes("set search_path = ''")) fail(`${name} must pin an empty search_path`)
  }
  if (check) check(found)
  return found
}

function quotedIdsAfter(source, marker) {
  const start = source.indexOf(marker)
  if (start < 0) return null
  const end = source.indexOf(')', start)
  if (end < 0) return null
  return [...source.slice(start, end).matchAll(/'([a-z0-9-]+)'/g)].map(match => match[1]).sort()
}

// Every tenant table is created with RLS enabled in the baseline migration.
const baseline = migrations['0001']
const requiredTables = ['gyms', 'profiles', 'gym_memberships', 'members', 'attendance', 'follow_ups']
for (const table of requiredTables) {
  requireText(baseline, `create table public.${table} (`, `Missing table declaration: ${table}`)
  requireText(baseline, `alter table public.${table} enable row level security`, `RLS is not enabled in the baseline migration: ${table}`)
}

// Parse policies without relying on policy names, whitespace, or comments.
const policies = [...stripComments(read('supabase/migrations/0001_initial_schema.sql')).matchAll(
  /create\s+policy\s+"[^"]+"\s+on\s+public\.(\w+)\s+for\s+(select|insert|update|delete|all)\s+to\s+authenticated\b([\s\S]*?);/gi,
)].map(match => ({ table: match[1].toLowerCase(), command: match[2].toLowerCase(), clauses: match[3].toLowerCase().replace(/\s+/g, ' ') }))
if (policies.length !== 14) fail(`Expected 14 authenticated RLS policies in the baseline; found ${policies.length}`)
const requirePolicy = (table, command, message, fragments) => {
  const policy = policies.find(candidate => candidate.table === table && candidate.command === command && fragments.every(fragment => candidate.clauses.includes(fragment)))
  if (!policy) fail(`Missing or weakened RLS policy: ${message}`)
}
requirePolicy('gyms', 'select', 'gym reads must be gym-scoped', ['using (public.is_gym_member(id))'])
requirePolicy('profiles', 'select', 'profile reads must be user-scoped', ['using (id = (select auth.uid()))'])
requirePolicy('profiles', 'update', 'profile updates must remain user-scoped', ['using (id = (select auth.uid()))', 'with check (id = (select auth.uid()))'])
requirePolicy('gym_memberships', 'select', 'membership discovery must be gym-scoped', ['using (public.is_gym_member(gym_id))'])
requirePolicy('gym_memberships', 'all', 'membership administration must require owner/admin role', ["array['owner','admin']::public.gym_role[]", 'using (public.has_gym_role(gym_id,', 'with check (public.has_gym_role(gym_id,'])
requirePolicy('members', 'select', 'member reads must be gym-scoped', ['using (public.is_gym_member(gym_id))'])
requirePolicy('members', 'insert', 'member creation must require a role in the target gym', ["array['owner','admin','staff']::public.gym_role[]", 'with check (public.has_gym_role(gym_id,'])
requirePolicy('members', 'update', 'member updates must require a role in the target gym', ["array['owner','admin','staff']::public.gym_role[]", 'using (public.has_gym_role(gym_id,', 'with check (public.has_gym_role(gym_id,'])
requirePolicy('members', 'delete', 'member deletion must require owner/admin role', ["array['owner','admin']::public.gym_role[]", 'using (public.has_gym_role(gym_id,'])
requirePolicy('attendance', 'select', 'attendance reads must be gym-scoped', ['using (public.is_gym_member(gym_id))'])
requirePolicy('follow_ups', 'select', 'follow-up reads must be gym-scoped', ['using (public.is_gym_member(gym_id))'])
requirePolicy('follow_ups', 'insert', 'follow-up creation must validate gym role, creator, and member tenant', ["array['owner','admin','staff']::public.gym_role[]", 'created_by = (select auth.uid())', 'm.gym_id = follow_ups.gym_id'])
requirePolicy('follow_ups', 'update', 'follow-up updates must validate gym role and member tenant', ["array['owner','admin','staff']::public.gym_role[]", 'using (public.has_gym_role(gym_id,', 'm.gym_id = follow_ups.gym_id'])
requirePolicy('follow_ups', 'delete', 'follow-up deletion must require owner/admin role', ["array['owner','admin']::public.gym_role[]", 'using (public.has_gym_role(gym_id,'])

requireFunction('is_gym_member', baseline)
const helperFunctions = functionsNamed(baseline, 'is_gym_member')
if (!helperFunctions.some(fn => fn.body.includes('gm.gym_id = target_gym') && fn.body.includes('gm.user_id = (select auth.uid())') && fn.body.includes('gm.active'))) {
  fail('is_gym_member must match the authenticated user to an active membership in the requested gym')
}
requireFunction('has_gym_role', baseline)
const roleFunctions = functionsNamed(baseline, 'has_gym_role')
if (!roleFunctions.some(fn => fn.body.includes('gm.gym_id = target_gym') && fn.body.includes('gm.user_id = (select auth.uid())') && fn.body.includes('gm.active') && fn.body.includes('gm.role = any(allowed)'))) {
  fail('has_gym_role must check the authenticated user, active gym membership, and requested role')
}

// Membership table grants are hardened after the baseline's initial grants.
requireText(migrations['0003'], 'revoke all privileges on table public.gym_memberships from anon, authenticated', 'Direct membership-table privileges must be revoked')
requireText(migrations['0003'], 'grant select on table public.gym_memberships to authenticated', 'Authenticated membership discovery must remain read-only')
if (/grant\s+(?!select\b)[^;]*\bon\s+(?:table\s+)?public\.gym_memberships\s+to\s+authenticated/i.test(stripComments(migrations['0003']))) {
  fail('Membership hardening migration must not restore direct write privileges')
}
if (/create\s+policy\s+[^;]+on\s+public\.attendance\s+for\s+(?:insert|update|delete|all)\b/i.test(stripComments(baseline))) {
  fail('Attendance writes must go through validated RPCs, not direct table policies')
}
if (/grant\s+(?:insert|update|delete|all)[^;]*\bon\s+(?:table\s+)?public\.attendance\s+to\s+authenticated/i.test(stripComments(baseline))) {
  fail('Authenticated clients must not receive direct attendance-write privileges')
}

// Validate all security-definer functions and their authorization-specific bodies.
const initialGymCreator = requireFunction('create_gym_for_current_user', baseline)[0]
if (initialGymCreator && (!initialGymCreator.body.includes('(select auth.uid()) is null') ||
    !initialGymCreator.body.includes('where user_id = (select auth.uid()) and active') ||
    !initialGymCreator.body.includes('insert into public.gyms(name, owner_id, city, phone)') ||
    !initialGymCreator.body.includes('trim(gym_name), (select auth.uid())') ||
    !initialGymCreator.body.includes("values (new_gym_id, (select auth.uid()), 'owner')"))) {
  fail('Initial gym creator must require authentication, prevent duplicate active memberships, and create the owner membership')
}

const manualCheckIn = requireFunction('record_manual_check_in', migrations['0002'])[0]
if (manualCheckIn && (!manualCheckIn.body.includes('public.has_gym_role(target_gym') ||
    !manualCheckIn.body.includes('m.id = target_member and m.gym_id = target_gym') ||
    !manualCheckIn.body.includes('found_member.status <> \'active\'') ||
    !manualCheckIn.body.includes('found_member.membership_expires_on') ||
    !manualCheckIn.body.includes("interval '60 seconds'") ||
    !manualCheckIn.body.includes('values (target_gym, found_member.id, stamp, \'manual\''))) {
  fail('Manual check-in must authorize the gym role, verify target member tenant/status/expiry, prevent rapid duplicates, and record a manual attendance row')
}

const qrCheckIn = requireFunction('check_in_with_qr', baseline)[0]
if (qrCheckIn && (!qrCheckIn.body.includes('public.has_gym_role(target_gym') ||
    !qrCheckIn.body.includes('m.gym_id = target_gym and m.qr_token = target_token') ||
    !qrCheckIn.body.includes('found_member.status <> \'active\'') ||
    !qrCheckIn.body.includes('found_member.membership_expires_on') ||
    !qrCheckIn.body.includes("interval '60 seconds'") ||
    !qrCheckIn.body.includes("values (target_gym, found_member.id, stamp, 'qr'"))) {
  fail('Staff QR check-in must authorize the gym role, bind the token to the target gym, validate membership, prevent rapid duplicates, and record QR attendance')
}

const phoneCheckIn = requireFunction('check_in_with_phone_otp', migrations['0004'])[0]
if (phoneCheckIn && (!phoneCheckIn.body.includes('(select auth.uid()) is null') ||
    !phoneCheckIn.body.includes("auth.jwt() ->> 'phone'") ||
    !phoneCheckIn.body.includes('m.gym_id = target_gym') ||
    !phoneCheckIn.body.includes('right(regexp_replace(m.phone') ||
    !phoneCheckIn.body.includes('if match_count = 0') || !phoneCheckIn.body.includes('if match_count > 1') ||
    !phoneCheckIn.body.includes('found_member.status <> \'active\'') ||
    !phoneCheckIn.body.includes('found_member.membership_expires_on') ||
    !phoneCheckIn.body.includes("interval '60 seconds'") ||
    !phoneCheckIn.body.includes("values (target_gym, found_member.id, stamp, 'qr'"))) {
  fail('Phone OTP check-in must require an authenticated verified phone, match exactly one member within the QR gym, validate membership, prevent rapid duplicates, and record QR attendance')
}

const themeMigration = migrations['0005']
const legacyThemeCreator = requireFunction('create_gym_for_current_user', themeMigration).find(fn => !fn.header.includes('gym_theme text'))
const themedCreator = functionsNamed(themeMigration, 'create_gym_for_current_user').find(fn => fn.header.includes('gym_theme text'))
if (!legacyThemeCreator || !legacyThemeCreator.body.includes("'onyx-champagne'")) {
  fail('Four-argument gym creation must remain as a compatibility wrapper using onyx-champagne')
}
if (legacyThemeCreator && (!legacyThemeCreator.header.includes('gym_city text default null') || !legacyThemeCreator.header.includes('gym_phone text default null'))) {
  fail('Four-argument compatibility wrapper must preserve its existing optional city and phone parameters')
}
if (!themedCreator || !themedCreator.body.includes('gym_theme is null') ||
    !themedCreator.body.includes('insert into public.gyms(name, owner_id, city, phone, theme)') ||
    !themedCreator.body.includes('trim(gym_name), (select auth.uid())') ||
    !themedCreator.body.includes('gym_theme)') ||
    !themedCreator.body.includes("values (new_gym_id, (select auth.uid()), 'owner')") ||
    !themedCreator.body.includes('where user_id = (select auth.uid()) and active')) {
  fail('Five-argument gym creation must validate theme/auth/membership and persist the theme plus owner membership')
}

const themeIds = [...read('src/lib/gymThemes.ts').matchAll(/\bid:\s*'([a-z0-9-]+)'/g)].map(match => match[1]).sort()
const dbConstraintIds = quotedIdsAfter(themeMigration, 'add constraint gyms_theme_check check (theme in (')
const creatorAllowedIds = quotedIdsAfter(themeMigration, 'gym_theme is null or gym_theme not in (')
if (!themeIds.length || new Set(themeIds).size !== themeIds.length) fail('Frontend theme IDs must be present and unique')
if (JSON.stringify(themeIds) !== JSON.stringify(dbConstraintIds)) fail('Frontend theme IDs must match the gyms.theme database constraint')
if (JSON.stringify(themeIds) !== JSON.stringify(creatorAllowedIds)) fail('Frontend theme IDs must match the gym-creation RPC validation list')
requireText(themeMigration, "add column if not exists theme text not null default 'onyx-champagne'", 'Existing gyms must receive the default onyx-champagne theme')
requireText(themeMigration, "where conname = 'gyms_theme_check'", 'Theme constraint migration must be safe to reapply')

// All RPCs must revoke PUBLIC execution and grant the authenticated role.
const requiredRpcGrants = [
  ['public.is_gym_member(uuid)', baseline],
  ['public.has_gym_role(uuid,public.gym_role[])', baseline],
  ['public.create_gym_for_current_user(text,text,text,text)', themeMigration],
  ['public.create_gym_for_current_user(text,text,text,text,text)', themeMigration],
  ['public.check_in_with_qr(uuid,uuid)', baseline],
  ['public.record_manual_check_in(uuid,uuid)', migrations['0002']],
  ['public.check_in_with_phone_otp(uuid)', migrations['0004']],
]
for (const [signature, source] of requiredRpcGrants) {
  const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`revoke\\s+all(?:\\s+privileges)?\\s+on\\s+function\\s+${escaped}\\s+from\\s+public`, 'i').test(stripComments(source))) {
    fail(`RPC must revoke PUBLIC execution: ${signature}`)
  }
  if (!new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${escaped}\\s+to\\s+authenticated`, 'i').test(stripComments(source))) {
    fail(`RPC must grant execution to authenticated users: ${signature}`)
  }
  if (new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${escaped}\\s+to\\s+anon`, 'i').test(stripComments(allSql))) {
    fail(`RPC must not grant execution to anon: ${signature}`)
  }
}

const browserClient = read('src/lib/supabase.ts')
if (/VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SERVICE_KEY)/i.test(browserClient) ||
    /createClient\s*\([^)]*(?:SERVICE_ROLE_KEY|service_role)/is.test(browserClient)) {
  fail('Browser Supabase client must not be configured with a service-role credential')
}
const gymData = compact(read('src/lib/gymData.ts'))
requireText(gymData, 'normalizegymtheme(joined.theme)', 'Unexpected or missing database themes must use the safe frontend fallback')

if (failures.length) {
  console.error('LiftDesk security contract check failed:')
  for (const failure of failures) console.error(' - ' + failure)
  process.exit(1)
}
console.log('LiftDesk static security contract passed: tenant RLS predicates, membership authorization, attendance RPC protections, theme persistence, and function grants are present.')
console.log('Limitation: this source check does not inspect deployed PostgreSQL grants/policies or test live RLS and cross-gym isolation.')
