-- Aggregate-only gym directory for LiftDesk platform administrators.
-- It never returns individual member, staff, or owner records.

create or replace function public.list_liftdesk_platform_gym_directory()
returns table (
  gym_id uuid,
  gym_name text,
  city text,
  created_at timestamptz,
  active_owner_count bigint,
  member_count bigint,
  active_member_count bigint,
  admin_count bigint,
  active_admin_count bigint,
  trainer_count bigint,
  active_trainer_count bigint,
  last_attendance_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform administrator access is required';
  end if;

  return query
  select
    g.id,
    g.name,
    g.city,
    g.created_at,
    owners.active_owner_count,
    members.member_count,
    members.active_member_count,
    staff.admin_count,
    staff.active_admin_count,
    staff.trainer_count,
    staff.active_trainer_count,
    attendance.last_attendance_at
  from public.gyms g
  cross join lateral (
    select count(*)::bigint as active_owner_count
    from public.gym_memberships gm
    where gm.gym_id = g.id and gm.active and gm.role = 'owner'
  ) owners
  cross join lateral (
    select
      count(*)::bigint as member_count,
      count(*) filter (where m.status = 'active')::bigint as active_member_count
    from public.members m
    where m.gym_id = g.id
  ) members
  cross join lateral (
    select
      count(*) filter (where s.role = 'admin')::bigint as admin_count,
      count(*) filter (where s.role = 'admin' and s.employment_status = 'active')::bigint as active_admin_count,
      count(*) filter (where s.role = 'trainer')::bigint as trainer_count,
      count(*) filter (where s.role = 'trainer' and s.employment_status = 'active')::bigint as active_trainer_count
    from public.gym_staff s
    where s.gym_id = g.id
  ) staff
  cross join lateral (
    select max(a.checked_in_at) as last_attendance_at
    from public.attendance a
    where a.gym_id = g.id
  ) attendance
  order by g.created_at desc, g.name;
end;
$$;

revoke all on function public.list_liftdesk_platform_gym_directory() from public, anon;
grant execute on function public.list_liftdesk_platform_gym_directory() to authenticated;

comment on function public.list_liftdesk_platform_gym_directory() is
  'Returns aggregate gym directory metrics only to explicit LiftDesk platform admins.';
