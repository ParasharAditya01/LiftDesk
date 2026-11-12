create table public.platform_owner_notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  sent_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index platform_owner_notifications_gym_created_idx
  on public.platform_owner_notifications(gym_id, created_at desc);
alter table public.platform_owner_notifications enable row level security;
revoke all on public.platform_owner_notifications from anon, authenticated;
grant select on public.platform_owner_notifications to authenticated;
grant update (read_at) on public.platform_owner_notifications to authenticated;
create policy "Gym owners read platform notifications"
  on public.platform_owner_notifications for select to authenticated
  using (public.has_gym_role(gym_id, array['owner']::public.gym_role[]));
create policy "Gym owners mark platform notifications read"
  on public.platform_owner_notifications for update to authenticated
  using (public.has_gym_role(gym_id, array['owner']::public.gym_role[]))
  with check (read_at is not null and public.has_gym_role(gym_id, array['owner']::public.gym_role[]));

create or replace function public.send_platform_owner_notification(
  target_gym_ids uuid[], notification_title text, notification_body text
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare recipient_count integer;
begin
  if (select auth.uid()) is null or not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Only a LiftDesk platform administrator can send owner notifications';
  end if;
  if char_length(trim(coalesce(notification_title, ''))) not between 1 and 120 then
    raise exception 'Notification title must be between 1 and 120 characters';
  end if;
  if char_length(trim(coalesce(notification_body, ''))) not between 1 and 2000 then
    raise exception 'Notification message must be between 1 and 2000 characters';
  end if;
  if coalesce(cardinality(target_gym_ids), 0) = 0 then
    raise exception 'Select at least one gym owner';
  end if;

  insert into public.platform_owner_notifications(gym_id, sent_by, title, body)
  select distinct gm.gym_id, (select auth.uid()), trim(notification_title), trim(notification_body)
  from public.gym_memberships gm
  join public.gyms g on g.id = gm.gym_id and g.removed_at is null
  where gm.gym_id = any(target_gym_ids) and gm.role = 'owner' and gm.active;
  get diagnostics recipient_count = row_count;
  if recipient_count <> (select count(distinct selected.gym_id) from unnest(target_gym_ids) as selected(gym_id)) then
    raise exception 'One or more selected gyms do not have an active owner';
  end if;
  return recipient_count;
end;
$$;
revoke all on function public.send_platform_owner_notification(uuid[], text, text) from public, anon;
grant execute on function public.send_platform_owner_notification(uuid[], text, text) to authenticated;
