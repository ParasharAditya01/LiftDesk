import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20261106175757_owner_approval_gate.sql', import.meta.url), 'utf8').toLowerCase()
const authGate = readFileSync(new URL('../src/AuthGate.tsx', import.meta.url), 'utf8')
const adminUi = readFileSync(new URL('../src/PlatformAdmin.tsx', import.meta.url), 'utf8')

function functionBody(name) {
  const start = migration.indexOf(`function public.${name}`)
  assert.notEqual(start, -1, `missing function ${name}`)
  const asIndex = migration.indexOf('as $$', start)
  const end = migration.indexOf('$$;', asIndex)
  assert.notEqual(asIndex, -1)
  assert.notEqual(end, -1)
  return migration.slice(asIndex, end)
}

test('owner approval tables use RLS and deny direct browser writes', () => {
  for (const table of ['liftdesk_platform_admins', 'owner_access_requests']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon, authenticated`))
  }
  assert.match(migration, /grant select on public\.owner_access_requests to authenticated/)
  assert.match(migration, /user_id = \(select auth\.uid\(\)\) or public\.is_liftdesk_platform_admin\(\)/)
})

test('only a platform admin can approve or reject and approval creates owner membership atomically', () => {
  const approve = functionBody('approve_owner_workspace_request')
  const reject = functionBody('reject_owner_workspace_request')
  assert.match(approve, /if not public\.is_liftdesk_platform_admin\(\) then/)
  assert.match(approve, /r\.status = 'pending'/)
  assert.match(approve, /for update/)
  assert.match(approve, /insert into public\.gyms\(name, owner_id, city, phone, theme\)/)
  assert.match(approve, /insert into public\.gym_memberships\(gym_id, user_id, role, active\)/)
  assert.match(approve, /'owner', true/)
  assert.match(approve, /set status = 'approved'/)
  assert.match(reject, /if not public\.is_liftdesk_platform_admin\(\) then/)
  assert.match(reject, /set status = 'rejected'/)
})

test('request RPC binds requests to the authenticated user and preserves one request per account', () => {
  const request = functionBody('request_owner_workspace')
  assert.match(request, /current_user_id uuid := \(select auth\.uid\(\)\)/)
  assert.match(request, /select u\.email into current_email from auth\.users u where u\.id = current_user_id/)
  assert.match(request, /on conflict \(user_id\) do update/)
  assert.match(request, /where public\.owner_access_requests\.status = 'rejected'/)
  assert.match(request, /from public\.gym_memberships gm/)
  assert.match(request, /gm\.user_id = current_user_id and gm\.active/)
})

test('legacy direct gym-creation RPCs are closed and the frontend requests approval', () => {
  assert.equal((migration.match(/message = 'owner workspace access requires liftdesk approval'/g) ?? []).length, 2)
  assert.match(authGate, /requestOwnerWorkspace\(/)
  assert.match(authGate, /Request LiftDesk approval/)
  assert.match(authGate, /ownerRequest\?\.status === 'pending'/)
  assert.match(adminUi, /approve_owner_workspace_request/)
  assert.match(adminUi, /reject_owner_workspace_request/)
})
