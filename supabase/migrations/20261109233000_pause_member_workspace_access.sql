-- Ensure member-owned RLS exceptions also respect workspace pause state.
drop policy if exists "gym members can read their gym" on public.gyms;
create policy "gym members can read their gym" on public.gyms for select to authenticated
  using (
    public.is_gym_member(id)
    or public.has_gym_role(id, array['member']::public.gym_role[])
  );

drop policy if exists "gym members read workspace memberships" on public.gym_memberships;
create policy "gym members read workspace memberships" on public.gym_memberships for select to authenticated
  using (
    public.is_gym_member(gym_id)
    or public.has_gym_role(gym_id, array['member']::public.gym_role[])
  );

drop policy if exists "gym staff read members" on public.members;
create policy "gym staff read members" on public.members for select to authenticated
  using (
    public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or (
      member_user_id = (select auth.uid())
      and public.has_gym_role(gym_id, array['member']::public.gym_role[])
    )
  );

drop policy if exists "coaching staff read diet plans" on public.diet_plans;
create policy "coaching staff read diet plans" on public.diet_plans for select to authenticated
  using (
    public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or (
      status in ('active','completed')
      and public.has_gym_role(gym_id, array['member']::public.gym_role[])
      and exists (
        select 1 from public.members m
        where m.id = diet_plans.member_id and m.gym_id = diet_plans.gym_id
          and m.member_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "coaching staff read workout plans" on public.workout_plans;
create policy "coaching staff read workout plans" on public.workout_plans for select to authenticated
  using (
    public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or (
      status in ('active','completed')
      and public.has_gym_role(gym_id, array['member']::public.gym_role[])
      and exists (
        select 1 from public.members m
        where m.id = workout_plans.member_id and m.gym_id = workout_plans.gym_id
          and m.member_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "coaching staff read progress" on public.member_progress;
create policy "coaching staff read progress" on public.member_progress for select to authenticated
  using (
    public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or (
      public.has_gym_role(gym_id, array['member']::public.gym_role[])
      and exists (
        select 1 from public.members m
        where m.id = member_progress.member_id and m.gym_id = member_progress.gym_id
          and m.member_user_id = (select auth.uid())
      )
    )
  );

-- Invitations remain usable during a pause so the workspace can resume normally.
-- Membership visibility and sign-in access are enforced by the paused-aware role checks above.
