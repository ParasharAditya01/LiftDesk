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
