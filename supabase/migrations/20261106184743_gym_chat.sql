-- One shared, text-only chat for all active accounts in each gym.
create table if not exists public.gym_chat_messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists gym_chat_messages_gym_created_idx
  on public.gym_chat_messages (gym_id, created_at desc, id desc);

alter table public.gym_chat_messages enable row level security;

drop policy if exists "Gym participants read chat" on public.gym_chat_messages;
create policy "Gym participants read chat"
  on public.gym_chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.gym_memberships gm
      where gm.gym_id = gym_chat_messages.gym_id
        and gm.user_id = (select auth.uid())
        and gm.active
    )
  );

drop policy if exists "Gym participants send chat" on public.gym_chat_messages;
create policy "Gym participants send chat"
  on public.gym_chat_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.gym_memberships gm
      where gm.gym_id = gym_chat_messages.gym_id
        and gm.user_id = (select auth.uid())
        and gm.active
    )
  );

-- The sender name is derived from trusted gym records, never accepted from the browser.
create or replace function public.set_gym_chat_sender_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid()) then
    raise exception 'Chat messages must be sent by the signed-in user';
  end if;

  select coalesce(
    nullif(trim(p.full_name), ''),
    nullif(trim(m.full_name), ''),
    'Gym member'
  )
  into new.sender_name
  from (select 1) as seed
  left join public.profiles p on p.id = new.user_id
  left join public.members m on m.gym_id = new.gym_id and m.member_user_id = new.user_id;

  return new;
end;
$$;

revoke all on function public.set_gym_chat_sender_name() from public, anon, authenticated;
drop trigger if exists set_gym_chat_sender_name on public.gym_chat_messages;
create trigger set_gym_chat_sender_name
  before insert on public.gym_chat_messages
  for each row execute function public.set_gym_chat_sender_name();

revoke all on public.gym_chat_messages from public, anon, authenticated;
grant select on public.gym_chat_messages to authenticated;
grant insert (gym_id, user_id, body) on public.gym_chat_messages to authenticated;

-- Postgres Changes delivers inserts only to clients allowed by the table's SELECT RLS policy.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gym_chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.gym_chat_messages';
  end if;
end;
$$;
