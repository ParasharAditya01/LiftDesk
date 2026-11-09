-- Require and retain the assigned Owner's mobile number in direct admin provisioning.
alter table public.liftdesk_owner_provisions
  add column if not exists owner_phone text check (owner_phone is null or owner_phone ~ '^[6-9][0-9]{9}$');

-- Replace the earlier provisioning RPC so a stale six-argument client cannot omit the phone.
drop function if exists public.create_liftdesk_gym_workspace(text,text,text,text,text,text);

create or replace function public.create_liftdesk_gym_workspace(
  requested_gym_name text,
  requested_owner_name text,
  requested_owner_email text,
  requested_owner_phone text,
  requested_city text default null,
  requested_gym_phone text default null,
  requested_theme text default 'onyx-champagne'
)
returns table (gym_id uuid, owner_email text, owner_account_ready boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  current_admin uuid := (select auth.uid());
  normalized_email text := lower(trim(coalesce(requested_owner_email, '')));
  normalized_owner_phone text := trim(coalesce(requested_owner_phone, ''));
  existing_owner_id uuid;
  owner_confirmed_at timestamptz;
  owner_providers jsonb;
  created_gym_id uuid;
begin
  if current_admin is null or not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Only a LiftDesk platform administrator can add a gym';
  end if;
  if char_length(trim(coalesce(requested_gym_name, ''))) not between 2 and 120 then
    raise exception 'Enter a gym name between 2 and 120 characters';
  end if;
  if char_length(trim(coalesce(requested_owner_name, ''))) not between 2 and 120 then
    raise exception 'Enter an owner name between 2 and 120 characters';
  end if;
  if normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'Enter the owner’s Google account email';
  end if;
  if normalized_owner_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian owner mobile number';
  end if;
  if requested_theme is null or requested_theme not in (
    'fuchsia-grey', 'cream-black', 'red-black', 'green-ivory-yellow',
    'beige-grey', 'navy-electric', 'gradient-blue', 'brown-beige', 'onyx-champagne'
  ) then raise exception 'Choose a supported gym theme'; end if;
  if char_length(trim(coalesce(requested_city, ''))) > 120 then raise exception 'City must be 120 characters or fewer'; end if;
  if char_length(trim(coalesce(requested_gym_phone, ''))) > 30 then raise exception 'Gym phone must be 30 characters or fewer'; end if;

  select u.id, u.email_confirmed_at, u.raw_app_meta_data
    into existing_owner_id, owner_confirmed_at, owner_providers
    from auth.users u where lower(u.email) = normalized_email for update;

  if existing_owner_id is not null then
    if owner_confirmed_at is null or not (
      owner_providers ->> 'provider' = 'google'
      or coalesce(owner_providers -> 'providers', '[]'::jsonb) ? 'google'
    ) then
      raise exception 'This email is already registered without a verified Google sign-in. Use the owner’s Google account email.';
    end if;
    if exists (select 1 from public.gym_memberships gm where gm.user_id = existing_owner_id and gm.active) then
      raise exception 'This Google account already has an active gym workspace';
    end if;
  end if;

  insert into public.gyms(name, owner_id, city, phone, theme)
  values (
    trim(requested_gym_name), existing_owner_id,
    nullif(trim(coalesce(requested_city, '')), ''),
    nullif(trim(coalesce(requested_gym_phone, '')), ''), requested_theme
  ) returning id into created_gym_id;

  insert into public.liftdesk_owner_provisions(
    gym_id, owner_email, owner_name, owner_phone, created_by, claimed_by, claimed_at
  ) values (
    created_gym_id, normalized_email, trim(requested_owner_name), normalized_owner_phone,
    current_admin, existing_owner_id, case when existing_owner_id is null then null else now() end
  );

  if existing_owner_id is not null then
    insert into public.profiles(id, full_name)
    values (existing_owner_id, trim(requested_owner_name))
    on conflict (id) do update set full_name = excluded.full_name;
    insert into public.gym_memberships(gym_id, user_id, role, active)
    values (created_gym_id, existing_owner_id, 'owner', true);
    insert into public.owner_contact_numbers(owner_user_id, phone, updated_at)
    values (existing_owner_id, normalized_owner_phone, now())
    on conflict (owner_user_id) do update
      set phone = excluded.phone, updated_at = excluded.updated_at;
  end if;

  return query select created_gym_id, normalized_email, existing_owner_id is not null;
end;
$$;

create or replace function public.claim_liftdesk_owner_workspace()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_email text;
  confirmed_at timestamptz;
  providers jsonb;
  provision public.liftdesk_owner_provisions%rowtype;
begin
  if current_user_id is null then return null; end if;
  select lower(trim(u.email)), u.email_confirmed_at, u.raw_app_meta_data
    into normalized_email, confirmed_at, providers
    from auth.users u where u.id = current_user_id;
  if normalized_email is null then return null; end if;

  select p.* into provision
    from public.liftdesk_owner_provisions p
    join public.gyms g on g.id = p.gym_id
    where lower(p.owner_email) = normalized_email
      and p.claimed_at is null and g.removed_at is null
    for update of p, g;
  if not found then return null; end if;
  if confirmed_at is null or not (
    providers ->> 'provider' = 'google'
    or coalesce(providers -> 'providers', '[]'::jsonb) ? 'google'
  ) then
    raise exception 'Sign in with the verified Google account assigned to this gym';
  end if;
  if exists (select 1 from public.gym_memberships gm where gm.user_id = current_user_id and gm.active) then
    raise exception 'This account already belongs to an active gym';
  end if;

  insert into public.profiles(id, full_name)
  values (current_user_id, provision.owner_name)
  on conflict (id) do update set full_name = excluded.full_name;
  update public.gyms set owner_id = current_user_id
    where id = provision.gym_id and owner_id is null and removed_at is null;
  if not found then raise exception 'This gym is no longer available for owner sign-in'; end if;
  insert into public.gym_memberships(gym_id, user_id, role, active)
    values (provision.gym_id, current_user_id, 'owner', true);
  if provision.owner_phone is not null then
    insert into public.owner_contact_numbers(owner_user_id, phone, updated_at)
    values (current_user_id, provision.owner_phone, now())
    on conflict (owner_user_id) do update
      set phone = excluded.phone, updated_at = excluded.updated_at;
  end if;
  update public.liftdesk_owner_provisions
    set claimed_by = current_user_id, claimed_at = now()
    where gym_id = provision.gym_id;
  return provision.gym_id;
end;
$$;

create or replace function public.list_liftdesk_platform_gym_directory_v3()
returns table (
  gym_id uuid,
  gym_name text,
  city text,
  owner_phone text,
  owner_email text,
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
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform administrator access is required';
  end if;
  return query
  select
    g.id, g.name, g.city, coalesce(oc.phone, p.owner_phone), coalesce(p.owner_email, u.email), g.created_at,
    owners.active_owner_count, members.member_count, members.active_member_count,
    staff.admin_count, staff.active_admin_count, staff.trainer_count, staff.active_trainer_count,
    attendance.last_attendance_at
  from public.gyms g
  left join public.owner_contact_numbers oc on oc.owner_user_id = g.owner_id
  left join public.liftdesk_owner_provisions p on p.gym_id = g.id
  left join auth.users u on u.id = g.owner_id
  cross join lateral (
    select count(*)::bigint as active_owner_count from public.gym_memberships gm
    where gm.gym_id = g.id and gm.active and gm.role = 'owner'
  ) owners
  cross join lateral (
    select count(*)::bigint as member_count,
      count(*) filter (where m.status = 'active')::bigint as active_member_count
    from public.members m where m.gym_id = g.id
  ) members
  cross join lateral (
    select count(*) filter (where s.role = 'admin')::bigint as admin_count,
      count(*) filter (where s.role = 'admin' and s.employment_status = 'active')::bigint as active_admin_count,
      count(*) filter (where s.role = 'trainer')::bigint as trainer_count,
      count(*) filter (where s.role = 'trainer' and s.employment_status = 'active')::bigint as active_trainer_count
    from public.gym_staff s where s.gym_id = g.id
  ) staff
  cross join lateral (
    select max(a.checked_in_at) as last_attendance_at from public.attendance a where a.gym_id = g.id
  ) attendance
  where g.removed_at is null
  order by g.created_at desc, g.name;
end;
$$;

revoke all on function public.create_liftdesk_gym_workspace(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_liftdesk_gym_workspace(text,text,text,text,text,text,text) to authenticated;
revoke all on function public.claim_liftdesk_owner_workspace() from public, anon;
grant execute on function public.claim_liftdesk_owner_workspace() to authenticated;
revoke all on function public.list_liftdesk_platform_gym_directory_v3() from public, anon;
grant execute on function public.list_liftdesk_platform_gym_directory_v3() to authenticated;

comment on column public.liftdesk_owner_provisions.owner_phone is
  'Required at admin provisioning time and copied to owner_contact_numbers when the Owner account is assigned or claims the workspace.';
