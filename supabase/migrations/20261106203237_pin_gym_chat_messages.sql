-- Let gym managers pin useful chat announcements for every participant.
alter table public.gym_chat_messages
  add column if not exists is_pinned boolean not null default false;

create index if not exists gym_chat_messages_pinned_idx
  on public.gym_chat_messages (gym_id, created_at desc)
  where is_pinned;

-- Only the pin state is updateable from the browser. Message content, sender,
-- timestamp, and gym association remain immutable to authenticated clients.
grant update (is_pinned) on public.gym_chat_messages to authenticated;

drop policy if exists "Gym managers pin chat announcements" on public.gym_chat_messages;
create policy "Gym managers pin chat announcements"
  on public.gym_chat_messages for update to authenticated
  using (
    public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer']::public.gym_role[]
    )
  )
  with check (
    public.has_gym_role(
      gym_id,
      array['owner', 'admin', 'trainer']::public.gym_role[]
    )
  );

comment on column public.gym_chat_messages.is_pinned is
  'Whether gym managers have pinned this message as an announcement.';
