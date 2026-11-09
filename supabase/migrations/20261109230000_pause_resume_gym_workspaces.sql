-- Pause workspace access without changing memberships or deleting gym data.
alter table public.gyms
  add column if not exists workspace_paused_at timestamptz,
  add column if not exists workspace_paused_by uuid references auth.users(id) on delete set null;

create or replace function public.is_gym_member(target_gym uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gym_memberships gm
    join public.gyms g on g.id = gm.gym_id
    where gm.gym_id = target_gym and gm.user_id = (select auth.uid()) and gm.active
      and gm.role in ('owner', 'admin', 'trainer')
      and g.workspace_paused_at is null and g.removed_at is null
  );
$$;

create or replace function public.has_gym_role(target_gym uuid, allowed public.gym_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gym_memberships gm
    join public.gyms g on g.id = gm.gym_id
    where gm.gym_id = target_gym and gm.user_id = (select auth.uid()) and gm.active
      and gm.role = any(allowed)
      and g.workspace_paused_at is null and g.removed_at is null
  );
$$;
revoke all on function public.is_gym_member(uuid) from public, anon;
grant execute on function public.is_gym_member(uuid) to authenticated;
revoke all on function public.has_gym_role(uuid, public.gym_role[]) from public, anon;
grant execute on function public.has_gym_role(uuid, public.gym_role[]) to authenticated;

-- Let a signed-in user see why their workspace did not open, without exposing its data.
create or replace function public.get_my_paused_workspace_access()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('gym_name', g.name, 'paused_at', g.workspace_paused_at)
  from public.gym_memberships gm join public.gyms g on g.id = gm.gym_id
  where gm.user_id = (select auth.uid()) and gm.active
    and g.workspace_paused_at is not null and g.removed_at is null
  order by case gm.role when 'owner' then 0 else 1 end limit 1;
$$;
revoke all on function public.get_my_paused_workspace_access() from public, anon;
grant execute on function public.get_my_paused_workspace_access() to authenticated;

create or replace function public.set_liftdesk_gym_workspace_paused(target_gym uuid, requested_paused boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare current_admin uuid := (select auth.uid());
begin
  if current_admin is null or not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform administrator access is required';
  end if;
  if requested_paused is null then
    raise exception using errcode = '22023', message = 'Choose whether to pause or resume the workspace';
  end if;
  update public.gyms
  set workspace_paused_at = case when requested_paused then coalesce(workspace_paused_at, now()) else null end,
      workspace_paused_by = case when requested_paused then current_admin else null end
  where id = target_gym and removed_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active gym workspace was not found';
  end if;
  return true;
end;
$$;
revoke all on function public.set_liftdesk_gym_workspace_paused(uuid, boolean) from public, anon;
grant execute on function public.set_liftdesk_gym_workspace_paused(uuid, boolean) to authenticated;

-- Version this function because Postgres cannot change a table-return shape in place.
create or replace function public.list_liftdesk_platform_gym_directory_v4()
returns table (
  gym_id uuid, gym_name text, city text, owner_phone text, owner_email text,
  created_at timestamptz, active_owner_count bigint, member_count bigint,
  active_member_count bigint, admin_count bigint, active_admin_count bigint,
  trainer_count bigint, active_trainer_count bigint, last_attendance_at timestamptz,
  workspace_paused_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select d.gym_id, d.gym_name, d.city, d.owner_phone, d.owner_email, d.created_at,
    d.active_owner_count, d.member_count, d.active_member_count, d.admin_count,
    d.active_admin_count, d.trainer_count, d.active_trainer_count, d.last_attendance_at,
    g.workspace_paused_at
  from public.list_liftdesk_platform_gym_directory_v3() d
  join public.gyms g on g.id = d.gym_id
  order by d.created_at desc, d.gym_name;
$$;
revoke all on function public.list_liftdesk_platform_gym_directory_v4() from public, anon;
grant execute on function public.list_liftdesk_platform_gym_directory_v4() to authenticated;
