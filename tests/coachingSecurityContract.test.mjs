import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/0012_member_coaching_workspace.sql', import.meta.url), 'utf8').toLowerCase().replace(/\s+/g, ' ')

test('coaching records are tied to the member in the same gym', () => {
  for (const table of ['diet_plans', 'workout_plans', 'member_progress', 'coaching_notes']) {
    assert.match(migration, new RegExp(`constraint ${table}_member_gym_fk foreign key \\(gym_id, member_id\\) references public\\.members\\(gym_id, id\\)`))
    assert.ok(migration.includes(`alter table public.${table} enable row level security`))
  }
})

test('coaching writes require a trainer, admin, or owner in the same gym', () => {
  const staffCheck = "public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])"
  assert.ok(migration.includes(staffCheck))
  for (const table of ['diet_plans', 'workout_plans', 'member_progress', 'coaching_notes', 'coaching_plan_templates']) {
    assert.ok(migration.includes(`on public.${table} for insert to authenticated`), `${table} insert policy exists`)
  }
  assert.ok(migration.includes('created_by = (select auth.uid())'))
})

test('members can read only their own published plans and progress; notes stay private', () => {
  assert.match(migration, /status in \('active','completed'\)[^;]+m\.member_user_id = \(select auth\.uid\(\)\)/)
  assert.ok(migration.includes('member_user_id = (select auth.uid())'))
  assert.doesNotMatch(migration, /create policy [^;]+on public\.coaching_notes for select[^;]+member_user_id/)
})

test('notes are append-only and plan edits retain prior snapshots', () => {
  assert.match(migration, /grant select, insert on public\.member_progress, public\.coaching_notes to authenticated/)
  assert.ok(migration.includes('create table public.coaching_plan_revisions'))
  assert.ok(migration.includes('create trigger diet_plan_history before update'))
  assert.ok(migration.includes('create trigger workout_plan_history before update'))
  assert.doesNotMatch(migration, /create policy [^;]+on public\.coaching_notes for (update|delete)/)
})

test('staff directory role and offboarding changes update linked login access atomically', () => {
  const migration = readFileSync(new URL('../supabase/migrations/0015_sync_staff_access_changes.sql', import.meta.url), 'utf8').toLowerCase().replace(/\s+/g, ' ')
  assert.ok(migration.includes('revoke update on table public.gym_staff from authenticated'))
  assert.match(migration, /create or replace function public\.update_gym_staff_directory\([\s\S]+security definer set search_path = ''/)
  assert.ok(migration.includes("public.has_gym_role(staff_row.gym_id, array['owner']::public.gym_role[])"))
  assert.ok(migration.includes("staff_row.role = 'trainer' and new_role = 'trainer'"))
  assert.ok(migration.includes('update public.gym_memberships gm set role = result_row.role, active = result_row.employment_status = \'active\''))
  assert.ok(migration.includes("raise exception 'linked staff login has no matching gym membership"))
  assert.ok(migration.includes('insert into public.gym_staff_access_events'))
  assert.ok(migration.includes('alter table public.gym_staff_access_events enable row level security'))
  assert.ok(migration.includes('revoke all on function public.update_gym_staff_directory('))
  assert.ok(migration.includes('to authenticated'))
})

test('staff edit UI requires confirmation before changing linked-login role or active status', () => {
  const ui = readFileSync(new URL('../src/StaffWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(ui, /const accessChanged = !!editing && \(editing\.role !== form\.role \|\| editing\.employment_status !== form\.employmentStatus\)/)
  assert.match(ui, /window\.confirm\('This changes this staff member/)
  assert.match(ui, /linked login access updated/)
})
