-- Require a personal mobile number for new owner workspace requests.
-- Keep this separate from gyms.phone, which is the gym's public contact number.

alter table public.owner_access_requests
  add column owner_mobile_phone text
  check (owner_mobile_phone is null or owner_mobile_phone ~ '^[6-9][0-9]{9}$');

create table public.owner_contact_numbers (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  updated_at timestamptz not null default now()
);

alter table public.owner_contact_numbers enable row level security;
revoke all on public.owner_contact_numbers from public, anon, authenticated;

create or replace function public.request_owner_workspace_with_contact(
  gym_name text,
  owner_name text,
  owner_mobile_phone text,
  gym_city text,
  gym_phone text,
  gym_theme text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  request_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in before requesting a workspace';
  end if;
  if char_length(trim(coalesce(gym_name, ''))) not between 2 and 120 then
    raise exception 'Enter a gym name between 2 and 120 characters';
  end if;
  if char_length(trim(coalesce(owner_name, ''))) not between 2 and 120 then
    raise exception 'Enter an owner name between 2 and 120 characters';
  end if;
  if trim(coalesce(owner_mobile_phone, '')) !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian owner mobile number';
  end if;
  if char_length(trim(coalesce(gym_city, ''))) not between 2 and 100 then
    raise exception 'Enter a city name between 2 and 100 characters';
  end if;
  if gym_theme is null or gym_theme not in (
    'fuchsia-grey', 'cream-black', 'red-black', 'green-ivory-yellow',
    'beige-grey', 'navy-electric', 'gradient-blue', 'brown-beige', 'onyx-champagne'
  ) then
    raise exception 'Choose a supported gym theme';
  end if;
  if exists (
    select 1 from public.gym_memberships gm
    where gm.user_id = current_user_id and gm.active
  ) then
    raise exception 'This account already has an active gym workspace';
  end if;
  select u.email into current_email from auth.users u where u.id = current_user_id;
  if current_email is null then raise exception 'A verified account email is required'; end if;

  insert into public.owner_access_requests(
    user_id, owner_email, owner_name, gym_name, city, phone, owner_mobile_phone, gym_theme,
    status, review_note, reviewed_at, reviewed_by, updated_at
  ) values (
    current_user_id, lower(trim(current_email)), trim(owner_name), trim(gym_name),
    trim(gym_city), nullif(trim(coalesce(gym_phone, '')), ''), trim(owner_mobile_phone), gym_theme,
    'pending', null, null, null, now()
  )
  on conflict (user_id) do update set
    owner_email = excluded.owner_email,
    owner_name = excluded.owner_name,
    gym_name = excluded.gym_name,
    city = excluded.city,
    phone = excluded.phone,
    owner_mobile_phone = excluded.owner_mobile_phone,
    gym_theme = excluded.gym_theme,
    status = 'pending',
    review_note = null,
    reviewed_at = null,
    reviewed_by = null,
    updated_at = now()
  where public.owner_access_requests.status = 'rejected'
  returning id into request_id;

  if request_id is null then
    raise exception 'A workspace request is already pending or has already been approved';
  end if;
  return request_id;
end;
$$;

-- Prevent an old client from bypassing required owner-phone collection.
revoke all on function public.request_owner_workspace(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.request_owner_workspace_with_contact(text, text, text, text, text, text) from public, anon;
grant execute on function public.request_owner_workspace_with_contact(text, text, text, text, text, text) to authenticated;

create or replace function public.copy_owner_contact_on_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
    and new.owner_mobile_phone is not null then
    insert into public.owner_contact_numbers(owner_user_id, phone, updated_at)
    values (new.user_id, new.owner_mobile_phone, now())
    on conflict (owner_user_id) do update
      set phone = excluded.phone, updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;

revoke all on function public.copy_owner_contact_on_approval() from public, anon, authenticated;

create trigger owner_access_request_copy_contact
after update of status on public.owner_access_requests
for each row execute function public.copy_owner_contact_on_approval();

create or replace function public.get_my_owner_contact_number()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_phone text;
begin
  if current_user_id is null or not exists (
    select 1 from public.gym_memberships gm
    where gm.user_id = current_user_id and gm.active and gm.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'Active gym Owner access is required';
  end if;
  select c.phone into current_phone
  from public.owner_contact_numbers c
  where c.owner_user_id = current_user_id;
  return current_phone;
end;
$$;

create or replace function public.update_my_owner_contact_number(requested_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not exists (
    select 1 from public.gym_memberships gm
    where gm.user_id = current_user_id and gm.active and gm.role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'Active gym Owner access is required';
  end if;
  if trim(coalesce(requested_phone, '')) !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number';
  end if;
  insert into public.owner_contact_numbers(owner_user_id, phone, updated_at)
  values (current_user_id, trim(requested_phone), now())
  on conflict (owner_user_id) do update
    set phone = excluded.phone, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.get_my_owner_contact_number() from public, anon;
grant execute on function public.get_my_owner_contact_number() to authenticated;
revoke all on function public.update_my_owner_contact_number(text) from public, anon;
grant execute on function public.update_my_owner_contact_number(text) to authenticated;

-- This explicit platform-admin RPC is the only read path for owners' personal numbers.
create or replace function public.list_liftdesk_platform_gym_directory_v2()
returns table (
  gym_id uuid,
  gym_name text,
  city text,
  owner_phone text,
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
    owner_contact.phone,
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
  left join public.owner_contact_numbers owner_contact
    on owner_contact.owner_user_id = g.owner_id
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

revoke all on function public.list_liftdesk_platform_gym_directory_v2() from public, anon;
grant execute on function public.list_liftdesk_platform_gym_directory_v2() to authenticated;

comment on table public.owner_contact_numbers is
  'Private Owner contact numbers. No direct role access; read/update through narrowly scoped RPCs.';
comment on function public.list_liftdesk_platform_gym_directory_v2() is
  'Returns aggregate gym metrics and current Owner contact numbers only to explicit LiftDesk platform admins.';
