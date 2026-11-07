-- Store only client-held ECDH public keys for gym chat devices.
create table if not exists public.gym_chat_devices (
  id uuid primary key,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null check (
    char_length(public_key) between 100 and 4096
    and coalesce((public_key::jsonb ->> 'kty') = 'EC', false)
    and coalesce((public_key::jsonb ->> 'crv') = 'P-256', false)
    and coalesce((public_key::jsonb ->> 'x') ~ '^[A-Za-z0-9_-]{43}$', false)
    and coalesce((public_key::jsonb ->> 'y') ~ '^[A-Za-z0-9_-]{43}$', false)
  ),
  created_at timestamptz not null default now()
);

create index if not exists gym_chat_devices_gym_idx
  on public.gym_chat_devices (gym_id, created_at);

alter table public.gym_chat_devices enable row level security;
revoke all on public.gym_chat_devices from public, anon, authenticated;
grant select, insert, delete on public.gym_chat_devices to authenticated;

drop policy if exists "Active gym participants read active chat device keys" on public.gym_chat_devices;
create policy "Active gym participants read active chat device keys"
  on public.gym_chat_devices for select to authenticated
  using (
    exists (
      select 1 from public.gym_memberships viewer
      where viewer.gym_id = gym_chat_devices.gym_id
        and viewer.user_id = (select auth.uid())
        and viewer.active
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
    and exists (
      select 1 from public.gym_memberships gm
      where gm.gym_id = gym_chat_devices.gym_id
        and gm.user_id = (select auth.uid())
        and gm.active
    )
  );

drop policy if exists "Users remove their own chat devices" on public.gym_chat_devices;
create policy "Users remove their own chat devices"
  on public.gym_chat_devices for delete to authenticated
  using (user_id = (select auth.uid()));

-- Each plaintext message is limited to 2,000 characters in the UI. Its
-- encrypted envelope also carries one short wrapped key per active device.
alter table public.gym_chat_messages
  drop constraint if exists gym_chat_messages_body_check;
alter table public.gym_chat_messages
  add constraint gym_chat_messages_body_check
  check (char_length(trim(body)) between 1 and 200000);

comment on table public.gym_chat_devices is
  'Public encryption keys for active gym chat devices. Private keys remain in the user device browser storage.';
comment on column public.gym_chat_messages.body is
  'New messages store a client-encrypted envelope. Messages created before encryption remain legacy plaintext until retention removes them.';
