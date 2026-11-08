-- Restrict gym chat, encryption-device access and push subscriptions to active
-- Owners/Admins. Existing messages and subscriptions are retained.

drop policy if exists "Gym participants read chat" on public.gym_chat_messages;
drop policy if exists "Gym owners and admins read chat" on public.gym_chat_messages;
create policy "Gym owners and admins read chat"
  on public.gym_chat_messages for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[]));

drop policy if exists "Gym participants send chat" on public.gym_chat_messages;
drop policy if exists "Gym owners and admins send chat" on public.gym_chat_messages;
create policy "Gym owners and admins send chat"
  on public.gym_chat_messages for insert to authenticated
  with check (
    body like 'LD-E2EE1:%'
    and user_id = (select auth.uid())
    and public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
  );

drop policy if exists "Gym managers pin chat announcements" on public.gym_chat_messages;
create policy "Gym managers pin chat announcements"
  on public.gym_chat_messages for update to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[]));

drop policy if exists "Active gym participants read active chat device keys" on public.gym_chat_devices;
create policy "Active gym participants read active chat device keys"
  on public.gym_chat_devices for select to authenticated
  using (
    public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
    and exists (
      select 1 from public.gym_memberships device_owner
      where device_owner.gym_id = gym_chat_devices.gym_id
        and device_owner.user_id = gym_chat_devices.user_id
        and device_owner.active
        and device_owner.role in ('owner', 'admin')
    )
  );

drop policy if exists "Users register their own active gym chat devices" on public.gym_chat_devices;
create policy "Users register their own active gym chat devices"
  on public.gym_chat_devices for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
  );

drop policy if exists "Users manage their own gym chat push subscriptions" on public.gym_chat_push_subscriptions;
create policy "Users manage their own gym chat push subscriptions"
  on public.gym_chat_push_subscriptions for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
  );

drop policy if exists "Active gym participants subscribe to push" on public.gym_chat_push_subscriptions;
create policy "Active gym participants subscribe to push"
  on public.gym_chat_push_subscriptions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
  );

drop policy if exists "Users update their own active gym chat push subscriptions" on public.gym_chat_push_subscriptions;
create policy "Users update their own active gym chat push subscriptions"
  on public.gym_chat_push_subscriptions for update to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
  )
  with check (
    user_id = (select auth.uid())
    and public.has_gym_role(gym_id, array['owner', 'admin']::public.gym_role[])
  );
