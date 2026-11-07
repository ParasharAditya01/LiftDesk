-- Reject plaintext messages from stale clients or direct API requests.
drop policy if exists "Gym participants send chat" on public.gym_chat_messages;
create policy "Gym participants send chat"
  on public.gym_chat_messages for insert to authenticated
  with check (
    body like 'LD-E2EE1:%'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = gym_chat_messages.gym_id
        and gm.user_id = (select auth.uid())
        and gm.active
    )
  );
