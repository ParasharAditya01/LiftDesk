-- Store opt-in browser push subscriptions per authenticated gym participant.
-- Subscription endpoints and encryption keys are private capability credentials.
alter table public.gym_chat_messages
  add column if not exists push_dispatched_at timestamptz;

create table if not exists public.gym_chat_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique
    check (char_length(endpoint) between 12 and 2048 and left(endpoint, 8) = 'https://'),
  p256dh text not null check (char_length(p256dh) between 40 and 200),
  auth text not null check (char_length(auth) between 16 and 100),
  created_at timestamptz not null default now()
);

create index if not exists gym_chat_push_subscriptions_gym_user_idx
  on public.gym_chat_push_subscriptions (gym_id, user_id);

alter table public.gym_chat_push_subscriptions enable row level security;
revoke all on public.gym_chat_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.gym_chat_push_subscriptions to authenticated;

drop policy if exists "Users manage their own gym chat push subscriptions" on public.gym_chat_push_subscriptions;
create policy "Users manage their own gym chat push subscriptions"
  on public.gym_chat_push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Active gym participants subscribe to push" on public.gym_chat_push_subscriptions;
create policy "Active gym participants subscribe to push"
  on public.gym_chat_push_subscriptions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.gym_memberships gm
      where gm.gym_id = gym_chat_push_subscriptions.gym_id
        and gm.user_id = (select auth.uid())
        and gm.active
    )
  );

drop policy if exists "Users update their own active gym chat push subscriptions" on public.gym_chat_push_subscriptions;
create policy "Users update their own active gym chat push subscriptions"
  on public.gym_chat_push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.gym_memberships gm
      where gm.gym_id = gym_chat_push_subscriptions.gym_id
        and gm.user_id = (select auth.uid())
        and gm.active
    )
  );

drop policy if exists "Users remove their own gym chat push subscriptions" on public.gym_chat_push_subscriptions;
create policy "Users remove their own gym chat push subscriptions"
  on public.gym_chat_push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

comment on table public.gym_chat_push_subscriptions is
  'Opt-in web push endpoints scoped to the authenticated owner of each browser subscription. Endpoints and keys are secret capability credentials.';
