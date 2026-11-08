-- All active gym roles may read encrypted chat. Only Owners/Admins may write
-- messages or pin announcements. Public device keys/subscriptions must be
-- available to each active participant so E2EE works for the whole gym.

drop policy if exists "Gym owners and admins read chat" on public.gym_chat_messages;
drop policy if exists "Active gym participants read encrypted chat" on public.gym_chat_messages;
create policy "Active gym participants read encrypted chat"
  on public.gym_chat_messages for select to authenticated
  using (
    body like 'LD-E2EE1:%'
    and
    public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer', 'member']::public.gym_role[]
    )
  );

-- Keep pre-encryption legacy messages visible only to Owners/Admins. They are
-- never retroactively described as encrypted, and read-only roles cannot fetch
-- their plaintext bodies through the table API or realtime feed.
create policy "Gym owners and admins read legacy chat"
  on public.gym_chat_messages for select to authenticated
  using (
    body not like 'LD-E2EE1:%'
    and public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
  );

-- Retain the existing Owner/Admin-only insert policy and pin policy.

drop policy if exists "Active gym participants read active chat device keys" on public.gym_chat_devices;
create policy "Active gym participants read active chat device keys"
  on public.gym_chat_devices for select to authenticated
  using (
    public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer', 'member']::public.gym_role[]
    )
    and exists (
      select 1 from public.gym_memberships device_owner
      where device_owner.gym_id = gym_chat_devices.gym_id
        and device_owner.user_id = gym_chat_devices.user_id
        and device_owner.active
    )
  );

drop policy if exists "Users register their own active gym chat devices" on public.gym_chat_devices;
create policy "Users register their own active gym chat devices"
  on public.gym_chat_devices for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer', 'member']::public.gym_role[]
    )
  );

drop policy if exists "Users manage their own gym chat push subscriptions" on public.gym_chat_push_subscriptions;
create policy "Users manage their own gym chat push subscriptions"
  on public.gym_chat_push_subscriptions for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer', 'member']::public.gym_role[]
    )
  );

drop policy if exists "Active gym participants subscribe to push" on public.gym_chat_push_subscriptions;
create policy "Active gym participants subscribe to push"
  on public.gym_chat_push_subscriptions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer', 'member']::public.gym_role[]
    )
  );

drop policy if exists "Users update their own active gym chat push subscriptions" on public.gym_chat_push_subscriptions;
create policy "Users update their own active gym chat push subscriptions"
  on public.gym_chat_push_subscriptions for update to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer', 'member']::public.gym_role[]
    )
  )
  with check (
    user_id = (select auth.uid())
    and public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer', 'member']::public.gym_role[]
    )
  );
