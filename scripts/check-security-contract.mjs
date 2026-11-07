import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(resolve(root, path), 'utf8')
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\r\n]*/g, '')
const compact = source => stripComments(source).toLowerCase().replace(/\s+/g, ' ').trim()
const migrations = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(version => {
  const id = String(version).padStart(4, '0')
  return [id, compact(read(`supabase/migrations/${id}_${[
    '', 'initial_schema', 'secure_manual_checkin', 'harden_membership_writes',
    'universal_gym_qr_checkin', 'gym_themes', 'disable_phone_otp_checkin', 'gym_roles_trainer_member',
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

// Role evolution must preserve existing memberships and keep the future member role least-privileged.
const roleMigration = migrations['0007']
requireText(roleMigration, "alter type public.gym_role rename value 'staff' to 'trainer'", 'Existing staff role must be renamed to trainer')
requireText(roleMigration, "alter type public.gym_role add value if not exists 'member'", 'Member role must be present in the database enum')
requireText(roleMigration, "gm.role in ('owner', 'admin', 'trainer')", 'Member role must not inherit general workspace read access')
requireText(roleMigration, "array['owner','admin','trainer']::public.gym_role[]", 'Attendance and operational writes must authorize trainer instead of staff')
const restrictedMembershipHelper = functionsNamed(roleMigration, 'is_gym_member')
if (!restrictedMembershipHelper.some(fn => fn.body.includes("gm.role in ('owner', 'admin', 'trainer')") && !fn.body.includes("'member'"))) {
  fail('The future member role must remain blocked from general workspace access until its permissions are defined')
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

const disabledPhoneCheckIn = migrations['0006']
requireText(disabledPhoneCheckIn,
  "execute 'revoke all on function public.check_in_with_phone_otp(uuid) from public, anon, authenticated'",
  'Removed phone OTP check-in must revoke execution from all roles')
requireText(disabledPhoneCheckIn,
  'drop function if exists public.check_in_with_phone_otp(uuid)',
  'Removed phone OTP check-in function must be dropped from the database')

const appEntryPoints = compact([
  read('src/main.tsx'), read('src/App.tsx'), read('src/LiveApp.tsx'), read('src/lib/supabase.ts'),
].join('\n'))
if (/membercheckin|createmembercheckinclient|signinwithotp|check_in_with_phone_otp|checkin=/.test(appEntryPoints)) {
  fail('Member-facing QR/phone OTP check-in must not remain reachable from the application')
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

// Member invitations must be single-use, time-limited, gym-scoped, and least-privileged.
const memberMigration = compact(read('supabase/migrations/0008_member_invitations_and_private_profiles.sql'))
requireText(memberMigration, 'create table if not exists public.member_invitations', 'Member invitation storage must exist')
requireText(memberMigration, 'token_hash bytea not null unique', 'Invitation tokens must be stored as unique hashes, not plaintext')
requireText(memberMigration, "default (now() + interval '48 hours')", 'Member invitations must expire after 48 hours')
requireText(memberMigration, 'mi.used_at is null and mi.expires_at > now()', 'Invitation acceptance must reject used or expired tokens')
requireText(memberMigration, "values (invite.gym_id, (select auth.uid()), 'member', true)", 'Invitation acceptance must assign only the member role in the invited gym')
requireText(memberMigration, 'member_user_id = (select auth.uid())', 'Member profile reads must be restricted to the linked authenticated user')
requireText(memberMigration, 'user_id = (select auth.uid())', 'A member must be able to discover only their own membership')
requireText(memberMigration, 'revoke update on public.profiles from authenticated', 'Member accounts must not self-edit profile metadata')
requireFunction('create_member_invitation', memberMigration, found => {
  if (!found.some(fn => fn.body.includes("array['owner','admin','trainer']::public.gym_role[]") && fn.body.includes('extensions.digest(raw_token, \'sha256\')'))) {
    fail('Invitation creation must authorize gym staff and store only a token hash')
  }
})
requireFunction('accept_member_invitation', memberMigration, found => {
  if (!found.some(fn => fn.body.includes('(select auth.uid()) is null') && fn.body.includes('mi.used_at is null') &&
      fn.body.includes('mi.expires_at > now()') && fn.body.includes('insert into public.members') &&
      fn.body.includes('insert into public.gym_memberships') && fn.body.includes('update public.member_invitations set used_at = now()'))) {
    fail('Invitation acceptance must authenticate, validate expiry/use, create a linked profile, assign the member role, and consume the token atomically')
  }
})
requireText(memberMigration, 'revoke all on function public.create_member_invitation(uuid) from public, anon', 'Invitation creation RPC must not be public or anonymous')
requireText(memberMigration, 'revoke all on function public.accept_member_invitation(text,text,text,text,integer,numeric,numeric) from public, anon', 'Invitation acceptance RPC must not be public or anonymous')

// Coaching feature policy contract. These are static source assertions; live RLS still needs a database test.
const coachingMigration = compact(read('supabase/migrations/0012_member_coaching_workspace.sql'))
for (const table of ['diet_plans', 'workout_plans', 'member_progress', 'coaching_notes']) {
  requireText(coachingMigration, `alter table public.${table} enable row level security`, `RLS must be enabled for ${table}`)
  requireText(coachingMigration, `foreign key (gym_id, member_id) references public.members(gym_id, id)`, `${table} must use member+gym composite tenant binding`)
}
const coachingRoles = "public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])"
for (const table of ['diet_plans', 'workout_plans']) {
  for (const command of ['select', 'insert', 'update']) {
    const expression = new RegExp(`create policy "[^"]+" on public\\.${table} for ${command} to authenticated([\\s\\S]*?);`)
    const match = coachingMigration.match(expression)
    if (!match || !match[1].includes(coachingRoles)) fail(`${table} ${command} must authorize only active staff roles in its own gym`)
  }
  const createPolicy = coachingMigration.match(new RegExp(`create policy "[^"]+" on public\\.${table} for insert to authenticated([\\s\\S]*?);`))
  if (!createPolicy?.[1].includes('created_by = (select auth.uid())')) fail(`${table} creation must bind the creator to the authenticated user`)
}
requireText(coachingMigration, "status in ('active','completed') and exists ( select 1 from public.members m where m.id = diet_plans.member_id and m.gym_id = diet_plans.gym_id and m.member_user_id = (select auth.uid())", 'Members must read only their linked active/completed diet plans')
requireText(coachingMigration, "status in ('active','completed') and exists ( select 1 from public.members m where m.id = workout_plans.member_id and m.gym_id = workout_plans.gym_id and m.member_user_id = (select auth.uid())", 'Members must read only their linked active/completed workout plans')
requireText(coachingMigration, 'member_user_id = (select auth.uid())', 'Member progress reads must match the linked member user')
if (/create\s+policy\s+[^;]+on\s+public\.coaching_notes\s+for\s+(?:update|delete|all)\b/i.test(stripComments(coachingMigration))) fail('Coaching notes must remain append-only')
if (/grant\s+(?:all|select\s*,\s*insert\s*,\s*update)[^;]*on\s+public\.member_progress\s+to\s+authenticated/i.test(stripComments(coachingMigration))) fail('Members and staff must not receive direct progress update/delete privileges')
requireText(coachingMigration, 'new.created_by is distinct from old.created_by', 'Plan creator attribution must be immutable')
requireText(coachingMigration, 'alter table public.coaching_plan_templates enable row level security', 'Reusable templates must have RLS enabled')
requireText(coachingMigration, 'create policy "coaching staff manage templates" on public.coaching_plan_templates for select to authenticated using (public.has_gym_role(gym_id, array[\'owner\',\'admin\',\'trainer\']::public.gym_role[]))', 'Reusable templates must be private to gym staff')
requireText(coachingMigration, 'create trigger coaching_template_creator_immutable', 'Template creator attribution must be immutable')
requireText(coachingMigration, 'create table public.coaching_plan_revisions', 'Plan history snapshots must be persisted')
requireText(coachingMigration, 'create trigger diet_plan_history before update', 'Diet plan changes must retain a prior version')
requireText(coachingMigration, 'create trigger workout_plan_history before update', 'Workout plan changes must retain a prior version')
requireText(coachingMigration, 'grant select on public.coaching_plan_revisions to authenticated', 'Plan revisions must be read-only to authenticated clients')
if (/create\s+policy\s+[^;]+on\s+public\.(?:diet_plans|workout_plans|coaching_plan_templates|coaching_plan_revisions)\s+for\s+delete\b/i.test(stripComments(coachingMigration))) fail('Coaching history and templates must not expose hard-delete policies')

const browserClient = read('src/lib/supabase.ts')
if (/VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SERVICE_KEY)/i.test(browserClient) ||
    /createClient\s*\([^)]*(?:SERVICE_ROLE_KEY|service_role)/is.test(browserClient)) {
  fail('Browser Supabase client must not be configured with a service-role credential')
}
const gymData = compact(read('src/lib/gymData.ts'))
requireText(gymData, 'normalizegymtheme(joined.theme)', 'Unexpected or missing database themes must use the safe frontend fallback')

const staffMigration = compact(read('supabase/migrations/0011_staff_workspace.sql'))
for (const table of ['gym_staff', 'gym_staff_attendance']) {
  requireText(staffMigration, `create table if not exists public.${table} (`, `Staff migration must create ${table}`)
  requireText(staffMigration, `alter table public.${table} enable row level security`, `Staff migration must enable RLS on ${table}`)
}
requireText(staffMigration, "role public.gym_role not null check (role in ('admin', 'trainer'))", 'Staff directory must reuse the existing gym_role enum and exclude owner/member directory roles')
requireText(staffMigration, 'unique (gym_id, staff_code)', 'Staff IDs must be unique within each gym')
requireText(staffMigration, 'constraint gym_staff_attendance_one_per_day unique (gym_id, staff_id, attendance_date)', 'Staff attendance must prevent duplicate daily rows at database level')
requireText(staffMigration, 'foreign key (staff_id, gym_id) references public.gym_staff(id, gym_id)', 'Staff attendance must validate the staff/gym relationship')
requireText(staffMigration, "role = 'trainer' and public.has_gym_role(gym_id, array['admin']::public.gym_role[])", 'Admin staff-directory access must be limited to trainer records')
requireText(staffMigration, "s.role = 'trainer' and public.has_gym_role(s.gym_id, array['admin']::public.gym_role[])", 'Admin staff-attendance access must be limited to trainer records')
requireText(staffMigration, 'new.marked_by := (select auth.uid())', 'Attendance marker identity must be assigned by the database')
requireText(staffMigration, 'new.updated_by := (select auth.uid())', 'Attendance correction actor must be assigned by the database')
requireText(staffMigration, 'new.updated_at := now()', 'Staff and attendance updates must record a database timestamp')
const staffUi = compact(read('src/StaffWorkspace.tsx'))
requireText(staffUi, "role === 'owner' || role === 'admin'", 'Staff workspace must deny frontend access to trainers and members')
requireText(staffUi, "owner || person.role === 'trainer'", 'Admin-facing directory results must not include owner/admin records')
const liveApp = compact(read('src/LiveApp.tsx'))
requireText(liveApp, "name !== 'staff' || role === 'owner' || role === 'admin'", 'Staff navigation must be hidden from trainers and members')

// Staff sign-in and offboarding must keep the employee directory bound to the
// actual authorization membership, not merely to frontend role labels.
const staffInviteMigration = compact(read('supabase/migrations/0014_staff_login_invitations.sql'))
requireText(staffInviteMigration, 'auth_user_id uuid unique references auth.users(id)', 'Staff login linkage must reference a unique Supabase Auth user')
requireText(staffInviteMigration, 'token_hash bytea not null unique', 'Staff invitation tokens must be stored as unique hashes')
requireText(staffInviteMigration, "default (now() + interval '48 hours')", 'Staff invitations must expire')
requireText(staffInviteMigration, 'confirmed_at is null', 'Staff invitation acceptance must require confirmed email')
requireText(staffInviteMigration, 'staff_row.role <> invite.role', 'Staff invitation acceptance must recheck the current role')
requireText(staffInviteMigration, 'revoke all on function public.accept_gym_staff_invitation(text) from public, anon', 'Staff invitation acceptance must not be publicly or anonymously executable')
requireFunction('create_gym_staff_invitation', staffInviteMigration)
requireFunction('accept_gym_staff_invitation', staffInviteMigration)

const staffAccessMigration = compact(read('supabase/migrations/0015_sync_staff_access_changes.sql'))
requireText(staffAccessMigration, 'revoke update on table public.gym_staff from authenticated', 'Staff directory edits must not bypass access synchronization')
requireText(staffAccessMigration, 'revoke update (gym_id, staff_code, full_name, role, phone, email, joining_date, employment_status, profile_photo_url, notes) on table public.gym_staff from authenticated', 'Previously granted column-level updates must also be revoked')
requireText(staffAccessMigration, 'alter table public.gym_staff_access_events enable row level security', 'Staff access audit must have RLS enabled')
requireText(staffAccessMigration, 'update public.gym_memberships gm set role = result_row.role, active = result_row.employment_status =', 'Role and active status changes must update the linked authorization membership')
requireText(staffAccessMigration, 'raise exception', 'A linked staff record with no authorization membership must not silently save an access change')
requireText(staffAccessMigration, 'insert into public.gym_staff_access_events', 'Staff role and status access changes must be audited')
requireText(staffAccessMigration, 'update public.gym_staff_invitations set revoked_at = now()', 'Pending invitations must be revoked when role or employment access changes')
requireText(staffAccessMigration, 'revoke all on function public.update_gym_staff_directory(', 'Staff access update RPC must not be public')
requireText(staffAccessMigration, 'grant execute on function public.update_gym_staff_directory(', 'Authenticated staff editors must use the access-sync RPC')
requireFunction('update_gym_staff_directory', staffAccessMigration, found => {
  if (!found.some(fn => fn.body.includes('public.has_gym_role(staff_row.gym_id') &&
      fn.body.includes("staff_row.role = 'trainer' and new_role = 'trainer'") &&
      fn.body.includes('staff_row.auth_user_id'))) {
    fail('Staff access update must verify gym role, keep Admin changes limited to Trainers, and bind synchronization to the linked account')
  }
})
const staffDataClient = compact(read('src/lib/staffData.ts'))
requireText(staffDataClient, "rpc('update_gym_staff_directory'", 'The frontend must update staff through the authorized synchronization RPC')

// Invitation RPCs receive simple per-user bounds with transaction locks so
// concurrent requests cannot bypass the limits.
const invitationRateLimit = compact(read('supabase/migrations/0017_invitation_rate_limits.sql'))
for (const name of ['create_member_invitation', 'create_gym_staff_invitation']) {
  const fn = requireFunction(name, invitationRateLimit)[0]
  if (!fn?.body.includes('pg_advisory_xact_lock') || !fn.body.includes('created_by = requesting_user') ||
      !fn.body.includes("created_at > now() - interval '1 hour'") || !fn.body.includes('recent_count >=')) {
    fail(`${name} must enforce an account-scoped, concurrency-safe hourly request limit`)
  }
}
requireText(invitationRateLimit, 'if recent_count >= 20 then', 'Member invitation RPC must cap creations at 20 per hour')
requireText(invitationRateLimit, 'if recent_count >= 10 then', 'Staff invitation RPC must cap creations at 10 per hour')
requireText(invitationRateLimit, 'revoke all on function public.create_member_invitation(uuid) from public, anon', 'Rate-limited member invitation RPC must stay private')
requireText(invitationRateLimit, 'revoke all on function public.create_gym_staff_invitation(uuid) from public, anon', 'Rate-limited staff invitation RPC must stay private')

// LiftDesk platform administrators can see aggregate gym health/counts only.
const platformDirectory = compact(read('supabase/migrations/20261107122256_platform_admin_gym_directory.sql'))
const directoryFunction = requireFunction('list_liftdesk_platform_gym_directory', platformDirectory)[0]
if (directoryFunction && (!directoryFunction.body.includes('(select auth.uid()) is null') ||
    !directoryFunction.body.includes('not public.is_liftdesk_platform_admin()') ||
    !directoryFunction.body.includes('raise exception using errcode = \'42501\'') ||
    !directoryFunction.body.includes('from public.gym_staff') ||
    !directoryFunction.body.includes('from public.members') ||
    !directoryFunction.body.includes('from public.attendance') ||
    /auth\.users|public\.profiles|full_name|owner_email|staff\.email|staff\.phone/.test(directoryFunction.body))) {
  fail('Platform gym directory must authorize explicit platform admins and return only gym-level aggregates')
}
requireText(platformDirectory, 'revoke all on function public.list_liftdesk_platform_gym_directory() from public, anon', 'Platform gym directory RPC must not be public or anonymous')
requireText(platformDirectory, 'grant execute on function public.list_liftdesk_platform_gym_directory() to authenticated', 'Platform gym directory RPC must be callable only by authenticated users and enforce its own role check')

// Do not expose SECURITY DEFINER helpers to anonymous API callers. Keep only
// the authenticated execute grants needed by the app and RLS policy helpers.
const rpcGrantHardening = compact(read('supabase/migrations/20261107143655_tighten_sensitive_rpc_grants.sql'))
for (const [signature, label] of [
  ['public.check_in_with_qr(uuid, uuid)', 'QR check-in'],
  ['public.record_manual_check_in(uuid, uuid)', 'manual check-in'],
  ['public.has_gym_role(uuid, public.gym_role[])', 'gym role helper'],
  ['public.is_gym_member(uuid)', 'gym membership helper'],
]) {
  requireText(rpcGrantHardening, `revoke execute on function ${signature} from public, anon`, `${label} must not be executable by PUBLIC or anon`)
  requireText(rpcGrantHardening, `grant execute on function ${signature} to authenticated`, `${label} must remain available to authenticated callers`)
}
for (const name of ['rls_auto_enable', 'snapshot_coaching_plan_revision']) {
  requireText(rpcGrantHardening, `revoke execute on function public.${name}() from public, anon, authenticated`, `${name} must be trigger-only, not callable through client roles`)
}

// Cloudflare Pages response headers provide defense in depth for browser data.
const pagesHeaders = compact(read('public/_headers'))
for (const [fragment, message] of [
  ["content-security-policy: default-src 'self'", 'Cloudflare Pages must restrict script execution with a same-origin CSP'],
  ["object-src 'none'", 'Cloudflare Pages must block plugin content'],
  ["frame-ancestors 'none'", 'Cloudflare Pages must prevent embedding'],
  ['x-content-type-options: nosniff', 'Cloudflare Pages must disable MIME sniffing'],
  ['referrer-policy: strict-origin-when-cross-origin', 'Cross-origin requests must not receive invitation URL paths'],
  ['strict-transport-security: max-age=31536000', 'Cloudflare Pages must tell browsers to use HTTPS for one year'],
  ['access-control-allow-origin: https://liftdesk.pages.dev', 'Static website CORS must be limited to the production origin'],
  ['permissions-policy:', 'Browser permissions must be explicitly restricted'],
]) requireText(pagesHeaders, fragment, message)

if (failures.length) {
  console.error('LiftDesk security contract check failed:')
  for (const failure of failures) console.error(' - ' + failure)
  process.exit(1)
}
console.log('LiftDesk static security contract passed: tenant RLS, attendance authorization, theme persistence, member/staff invitations and rate limits, coaching/template scope, staff access synchronization, aggregate platform-admin directory, sensitive RPC grants, and browser headers are present.')
console.log('Limitation: this source check does not inspect deployed PostgreSQL grants/policies or test live RLS and cross-gym isolation.')
