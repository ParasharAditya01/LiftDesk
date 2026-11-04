# Trainer coaching workspace

## What is included

The authenticated workspace adds a Coaching section for gym staff. It reuses `members` and `attendance`; it does not create a second member directory. Staff can search/filter members, review membership and recent attendance, make member-specific diet and workout plans, log progress and add dated coaching notes. Diet schedules support different meals per day. Workout schedules support rest days, exercise details, day duplication, and exercise reordering. A trainer can save a plan as a gym-scoped reusable template, then load it into another member's plan.

Linked member accounts can read only active/completed plans assigned to their linked member record and their own progress entries. They cannot edit plans. Coaching notes remain private to staff. The UI does not offer trainer assignment because the current membership schema has no member-to-trainer assignment field. Progress photos are not included; there is no consent flow or private storage bucket configured.

Diet targets are trainer-entered estimates, not clinical calculations. Members with medical conditions, pregnancy, eating-disorder concerns, or significant dietary restrictions are told to consult a qualified healthcare professional or registered dietitian.

## Migration

Apply `supabase/migrations/0012_member_coaching_workspace.sql` to the target Supabase project before using the Coaching section. It adds diet/workout plans, member progress, append-only coaching notes, gym-scoped templates, plan revision snapshots, indexes, constraints, and RLS policies. It does not change authentication roles or modify existing member/attendance records.

This repository does not currently contain a Supabase CLI project configuration. Review the migration and apply it through the established project migration workflow or Supabase SQL Editor. Do not paste secrets into frontend environment variables. The migration has not been applied to the production database by this code change.

## Security model

- Plan/progress/note records include both `gym_id` and `member_id`.
- Composite foreign keys require the referenced member to belong to that same gym.
- Staff policies use `has_gym_role` for the target gym and allow only active Owner, Admin, or Trainer memberships.
- Plan creation and progress/note writes bind `created_by` to `auth.uid()`.
- Members can select only active/completed plans whose `member_user_id` is their authenticated user, and their own progress. They cannot read coaching notes.
- Plan revisions are written by a trigger and are staff-readable only. Plans are archived rather than hard-deleted; notes are append-only.
- Coaching operations do not grant or alter gym membership roles, subscription access, or security settings.

## Verification checklist after applying to a test project

1. Use two isolated test gyms with separate Trainer accounts and at least one member in each.
2. In Gym A, create a diet plan, workout plan, progress entry, and note for its member. Confirm the trainer can read and edit those records.
3. Attempt direct selects and writes with Gym B's member ID and Gym B's `gym_id` while authenticated as Gym A's trainer. Confirm reads return no rows and writes fail. Also try mixing Gym A's `gym_id` with Gym B's `member_id`; the composite foreign key must reject it.
4. Confirm an unaffiliated user cannot read Gym A's records and cannot create a record by supplying Gym A's IDs.
5. Confirm the member login for A sees only A's active/completed plans and own progress, cannot see drafts/archived plans or coaching notes, and cannot write or edit a plan.
6. Update and archive a plan; confirm the old plan state appears in `coaching_plan_revisions` and the plan remains in the archived state.
7. Confirm the other gym's Trainer sees none of Gym A's coaching records and templates.

The repository tests and security-contract script are static source checks. They do not substitute for these live PostgreSQL/RLS allow-and-deny tests.
