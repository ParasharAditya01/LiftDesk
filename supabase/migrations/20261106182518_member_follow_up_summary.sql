-- Return one gym-scoped row per member and their most recent check-in.
-- The function runs as the caller; underlying table RLS remains in force.
create or replace function public.list_member_follow_up_summary(target_gym uuid)
returns table (
  id uuid,
  full_name text,
  phone text,
  email text,
  status public.member_status,
  joined_on date,
  membership_expires_on date,
  plan_name text,
  last_visit_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.full_name,
    m.phone,
    m.email,
    m.status,
    m.joined_on,
    m.membership_expires_on,
    m.plan_name,
    latest.checked_in_at as last_visit_at
  from public.members as m
  left join lateral (
    select a.checked_in_at
    from public.attendance as a
    where a.gym_id = m.gym_id
      and a.member_id = m.id
    order by a.checked_in_at desc
    limit 1
  ) as latest on true
  where m.gym_id = target_gym
    and public.has_gym_role(
      target_gym,
      array['owner', 'admin', 'trainer']::public.gym_role[]
    )
  order by latest.checked_in_at asc nulls first, m.full_name asc;
$$;

revoke all on function public.list_member_follow_up_summary(uuid) from public, anon;
grant execute on function public.list_member_follow_up_summary(uuid) to authenticated;
