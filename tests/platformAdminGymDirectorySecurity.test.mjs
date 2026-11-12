import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = [
  readFileSync(new URL('../supabase/migrations/20261109220000_require_owner_phone_for_admin_provision.sql', import.meta.url), 'utf8'),
  readFileSync(new URL('../supabase/migrations/20261109230000_pause_resume_gym_workspaces.sql', import.meta.url), 'utf8'),
].join('\n').toLowerCase()
const directoryStart = migration.indexOf('create or replace function public.list_liftdesk_platform_gym_directory_v3')
const directoryEnd = migration.indexOf('$$;', directoryStart) + 3
const directoryFunction = migration.slice(directoryStart, directoryEnd)
const ui = readFileSync(new URL('../src/PlatformAdmin.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/lib/ownerApprovals.ts', import.meta.url), 'utf8')

test('platform gym directory is aggregate-only and checks platform-admin identity', () => {
  assert.match(migration, /security\s+definer/)
  assert.match(migration, /set\s+search_path\s*=\s*''/)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /public\.is_liftdesk_platform_admin\(\)/)
  assert.match(migration, /errcode\s*=\s*'42501'/)
  assert.match(migration, /revoke all on function public\.list_liftdesk_platform_gym_directory_v4\(\) from public, anon/)
  assert.match(migration, /grant execute on function public\.list_liftdesk_platform_gym_directory_v4\(\) to authenticated/)
  for (const aggregate of ['count(*)::bigint', 'count(*) filter (where m.status = \'active\')::bigint', 'max(a.checked_in_at)']) {
    assert.ok(migration.includes(aggregate), `missing expected aggregate: ${aggregate}`)
  }
  for (const table of ['public.gyms', 'public.gym_memberships', 'public.members', 'public.gym_staff', 'public.attendance']) {
    assert.ok(migration.includes(`from ${table}`), `missing scoped aggregate source ${table}`)
  }
  assert.doesNotMatch(directoryFunction, /profiles|full_name|staff\.email|staff\.phone/)
})

test('platform admin UI calls the protected aggregate RPC and avoids per-person directory fields', () => {
  assert.match(client, /rpc\('list_liftdesk_platform_gym_directory_v4'\)/)
  assert.match(ui, /listPlatformGymDirectory/)
  assert.match(ui, /member_count/)
  assert.match(ui, /admin_count/)
  assert.match(ui, /trainer_count/)
  assert.match(ui, /search by gym name or city/i)
  assert.match(ui, /active owner access/i)
  assert.doesNotMatch(ui, /\.from\(['"](?:members|gym_staff)['"]\)/)
})
