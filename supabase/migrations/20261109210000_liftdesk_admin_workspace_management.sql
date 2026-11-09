-- Let LiftDesk platform administrators provision Owner workspaces directly.
-- Owners claim a pre-provisioned workspace with the matching verified Google account.
-- Removing a workspace disables sign-in but preserves its records for recovery/history.

alter table public.gyms alter column owner_id drop not null;
alter table public.gyms add column if not exists removed_at timestamptz;
create index if not exists gyms_active_created_idx on public.gyms(created_at desc) where removed_at is null;

alter table public.member_invitations add column if not exists revoked_at timestamptz;

create table if not exists public.liftdesk_owner_provisions (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  owner_email text not null check (char_length(trim(owner_email)) between 3 and 320),
  owner_name text not null check (char_length(trim(owner_name)) between 2 and 120),
  created_by uuid references auth.users(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists liftdesk_owner_provisions_pending_email_idx
  on public.liftdesk_owner_provisions(lower(owner_email))
  where claimed_at is null;

alter table public.liftdesk_owner_provisions enable row level security;
revoke all on public.liftdesk_owner_provisions from public, anon, authenticated;

create or replace function public.create_liftdesk_gym_workspace(
  requested_gym_name text,
  requested_owner_name text,
  requested_owner_email text,
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
    gym_id, owner_email, owner_name, created_by, claimed_by, claimed_at
  ) values (
    created_gym_id, normalized_email, trim(requested_owner_name), current_admin,
    existing_owner_id, case when existing_owner_id is null then null else now() end
  );

  if existing_owner_id is not null then
    insert into public.profiles(id, full_name)
    values (existing_owner_id, trim(requested_owner_name))
    on conflict (id) do update set full_name = excluded.full_name;
    insert into public.gym_memberships(gym_id, user_id, role, active)
    values (created_gym_id, existing_owner_id, 'owner', true);
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
  update public.liftdesk_owner_provisions
    set claimed_by = current_user_id, claimed_at = now()
    where gym_id = provision.gym_id;
  return provision.gym_id;
end;
$$;

create or replace function public.remove_liftdesk_gym_workspace(target_gym uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Only a LiftDesk platform administrator can remove a gym';
  end if;
  update public.gyms set removed_at = now()
    where id = target_gym and removed_at is null;
  if not found then raise exception 'This gym is already removed or does not exist'; end if;
  update public.gym_memberships set active = false where gym_id = target_gym and active;
  update public.member_invitations set revoked_at = now()
    where gym_id = target_gym and used_at is null and revoked_at is null;
  update public.gym_staff_invitations set revoked_at = now()
    where gym_id = target_gym and used_at is null and revoked_at is null;
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
    g.id, g.name, g.city, oc.phone, coalesce(p.owner_email, u.email), g.created_at,
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

revoke all on function public.create_liftdesk_gym_workspace(text,text,text,text,text,text) from public, anon;
grant execute on function public.create_liftdesk_gym_workspace(text,text,text,text,text,text) to authenticated;
revoke all on function public.claim_liftdesk_owner_workspace() from public, anon;
grant execute on function public.claim_liftdesk_owner_workspace() to authenticated;
revoke all on function public.remove_liftdesk_gym_workspace(uuid) from public, anon;
grant execute on function public.remove_liftdesk_gym_workspace(uuid) to authenticated;
revoke all on function public.list_liftdesk_platform_gym_directory_v3() from public, anon;
grant execute on function public.list_liftdesk_platform_gym_directory_v3() to authenticated;

comment on table public.liftdesk_owner_provisions is
  'Platform-admin-created owner assignments. An owner may claim only by verified Google sign-in matching owner_email.';
comment on function public.remove_liftdesk_gym_workspace(uuid) is
  'Soft-removes a gym, disables active workspace memberships, and revokes outstanding staff invitations while retaining gym history.';

create or replace function public.accept_member_invitation(
  invitation_token text,
  full_name text,
  phone_number text,
  whatsapp_number text,
  member_age integer,
  weight_kg numeric,
  height_cm numeric
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare invite public.member_invitations%rowtype; new_member_id uuid; user_email text;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before accepting a member invitation'; end if;
  if invitation_token is null or char_length(invitation_token) <> 64 then raise exception 'This invitation link is invalid'; end if;
  if char_length(trim(coalesce(full_name,''))) not between 2 and 120 then raise exception 'Enter your full name'; end if;
  if char_length(trim(coalesce(phone_number,''))) not between 5 and 30 then raise exception 'Enter a valid phone number'; end if;
  if char_length(trim(coalesce(whatsapp_number,''))) not between 5 and 30 then raise exception 'Enter a valid WhatsApp number'; end if;
  if member_age not between 13 and 120 then raise exception 'Age must be between 13 and 120'; end if;
  if weight_kg not between 20 and 500 then raise exception 'Weight must be between 20 and 500 kg'; end if;
  if height_cm not between 80 and 260 then raise exception 'Height must be between 80 and 260 cm'; end if;
  if exists (select 1 from public.gym_memberships where user_id = (select auth.uid()) and active) then
    raise exception 'This account already belongs to a gym';
  end if;
  select mi.* into invite
    from public.member_invitations mi join public.gyms g on g.id = mi.gym_id
    where mi.token_hash = extensions.digest(invitation_token, 'sha256')
      and mi.used_at is null and mi.revoked_at is null and mi.expires_at > now()
      and g.removed_at is null
    for update of mi;
  if not found then raise exception 'This invitation has expired, was revoked, or its gym is no longer available'; end if;
  select email into user_email from auth.users where id = (select auth.uid());
  insert into public.profiles(id, full_name)
    values ((select auth.uid()), trim(full_name))
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.members(
    gym_id, full_name, phone, email, whatsapp_number, age, weight_kg, height_cm, member_user_id
  ) values (
    invite.gym_id, trim(full_name), trim(phone_number), user_email, trim(whatsapp_number),
    member_age, weight_kg, height_cm, (select auth.uid())
  ) returning id into new_member_id;
  insert into public.gym_memberships(gym_id, user_id, role, active)
    values (invite.gym_id, (select auth.uid()), 'member', true);
  update public.member_invitations set used_at = now(), member_id = new_member_id where id = invite.id;
  return new_member_id;
end;
$$;

revoke all on function public.accept_member_invitation(text,text,text,text,integer,numeric,numeric) from public, anon;
grant execute on function public.accept_member_invitation(text,text,text,text,integer,numeric,numeric) to authenticated;
