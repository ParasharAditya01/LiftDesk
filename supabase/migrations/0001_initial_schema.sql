-- GymPulse initial schema. Run in Supabase SQL Editor on a NEW project.
-- Tenant isolation is enforced by PostgreSQL RLS, not by frontend filters.
create extension if not exists pgcrypto;

create type public.gym_role as enum ('owner', 'admin', 'staff');
create type public.member_status as enum ('active', 'inactive', 'paused');
create type public.follow_up_kind as enum ('inactive', 'renewal', 'general');
create type public.follow_up_status as enum ('open', 'contacted', 'resolved');

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  owner_id uuid not null references auth.users(id) on delete restrict,
  phone text,
  city text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.gym_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (gym_id, user_id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone text not null check (char_length(trim(phone)) between 5 and 30),
  email text,
  status public.member_status not null default 'active',
  joined_on date not null default current_date,
  membership_expires_on date,
  plan_name text not null default 'Monthly',
  monthly_fee numeric(10,2) not null default 0 check (monthly_fee >= 0),
  qr_token uuid not null default gen_random_uuid() unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_gym_name_idx on public.members (gym_id, full_name);
create index members_gym_expiry_idx on public.members (gym_id, membership_expires_on);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method text not null default 'manual' check (method in ('manual', 'qr')),
  recorded_by uuid references auth.users(id) on delete set null
);
create index attendance_gym_time_idx on public.attendance (gym_id, checked_in_at desc);
create index attendance_member_time_idx on public.attendance (member_id, checked_in_at desc);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  kind public.follow_up_kind not null,
  status public.follow_up_status not null default 'open',
  due_on date not null default current_date,
  note text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index follow_ups_gym_status_idx on public.follow_ups (gym_id, status, due_on);

create or replace function public.is_gym_member(target_gym uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gym_memberships gm
    where gm.gym_id = target_gym and gm.user_id = (select auth.uid()) and gm.active
  );
$$;

create or replace function public.has_gym_role(target_gym uuid, allowed public.gym_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gym_memberships gm
    where gm.gym_id = target_gym and gm.user_id = (select auth.uid())
      and gm.active and gm.role = any(allowed)
  );
$$;

-- Safe first-run onboarding. Authenticated user becomes owner of a new isolated gym.
create or replace function public.create_gym_for_current_user(gym_name text, owner_name text, gym_city text default null, gym_phone text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare new_gym_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before creating a gym'; end if;
  if char_length(trim(coalesce(gym_name,''))) not between 2 and 120 then raise exception 'Enter a gym name between 2 and 120 characters'; end if;
  if exists (select 1 from public.gym_memberships where user_id = (select auth.uid()) and active) then
    raise exception 'This account already belongs to a gym. Ask an owner to invite you to another workspace.';
  end if;
  insert into public.profiles(id, full_name) values ((select auth.uid()), trim(coalesce(owner_name,'')))
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.gyms(name, owner_id, city, phone)
    values (trim(gym_name), (select auth.uid()), nullif(trim(coalesce(gym_city,'')),''), nullif(trim(coalesce(gym_phone,'')),''))
    returning id into new_gym_id;
  insert into public.gym_memberships(gym_id, user_id, role) values (new_gym_id, (select auth.uid()), 'owner');
  return new_gym_id;
end;
$$;

-- QR payloads contain a random UUID token, but server validates gym, member status,
-- and expiry. Repeated scans within 60 seconds are rejected.
create or replace function public.check_in_with_qr(target_gym uuid, target_token uuid)
returns table(attendance_id uuid, member_name text, checked_in_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare found_member public.members%rowtype; new_attendance_id uuid; stamp timestamptz := now();
begin
  if (select auth.uid()) is null or not public.has_gym_role(target_gym, array['owner','admin','staff']::public.gym_role[]) then
    raise exception 'You do not have permission to record attendance for this gym';
  end if;
  select * into found_member from public.members m
    where m.gym_id = target_gym and m.qr_token = target_token for update;
  if not found then raise exception 'QR code is not valid for this gym'; end if;
  if found_member.status <> 'active' then raise exception 'Member is not active'; end if;
  if found_member.membership_expires_on is not null and found_member.membership_expires_on < (stamp at time zone 'Asia/Kolkata')::date then
    raise exception 'Membership has expired';
  end if;
  if exists (select 1 from public.attendance a where a.member_id = found_member.id and a.checked_in_at > stamp - interval '60 seconds') then
    raise exception 'This member was checked in moments ago';
  end if;
  insert into public.attendance(gym_id, member_id, checked_in_at, method, recorded_by)
    values (target_gym, found_member.id, stamp, 'qr', (select auth.uid()))
    returning id into new_attendance_id;
  return query select new_attendance_id, found_member.full_name, stamp;
end;
$$;

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.gym_memberships enable row level security;
alter table public.members enable row level security;
alter table public.attendance enable row level security;
alter table public.follow_ups enable row level security;

create policy "gym members can read their gym" on public.gyms for select to authenticated using (public.is_gym_member(id));
create policy "owners can update their gym" on public.gyms for update to authenticated using (public.has_gym_role(id, array['owner','admin']::public.gym_role[])) with check (public.has_gym_role(id, array['owner','admin']::public.gym_role[]));
create policy "users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "users update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "gym members read workspace memberships" on public.gym_memberships for select to authenticated using (public.is_gym_member(gym_id));
create policy "owners manage workspace memberships" on public.gym_memberships for all to authenticated using (public.has_gym_role(gym_id, array['owner','admin']::public.gym_role[])) with check (public.has_gym_role(gym_id, array['owner','admin']::public.gym_role[]));
create policy "gym staff read members" on public.members for select to authenticated using (public.is_gym_member(gym_id));
create policy "gym staff add members" on public.members for insert to authenticated with check (public.has_gym_role(gym_id, array['owner','admin','staff']::public.gym_role[]));
create policy "gym staff update members" on public.members for update to authenticated using (public.has_gym_role(gym_id, array['owner','admin','staff']::public.gym_role[])) with check (public.has_gym_role(gym_id, array['owner','admin','staff']::public.gym_role[]));
create policy "owners remove members" on public.members for delete to authenticated using (public.has_gym_role(gym_id, array['owner','admin']::public.gym_role[]));
create policy "gym staff read attendance" on public.attendance for select to authenticated using (public.is_gym_member(gym_id));
create policy "gym staff record manual attendance" on public.attendance for insert to authenticated with check (
  public.has_gym_role(gym_id, array['owner','admin','staff']::public.gym_role[])
  and recorded_by = (select auth.uid())
  and exists (select 1 from public.members m where m.id = member_id and m.gym_id = attendance.gym_id and m.status = 'active')
);
create policy "gym staff read follow ups" on public.follow_ups for select to authenticated using (public.is_gym_member(gym_id));
create policy "gym staff create follow ups" on public.follow_ups for insert to authenticated with check (public.has_gym_role(gym_id, array['owner','admin','staff']::public.gym_role[]) and created_by = (select auth.uid()));
create policy "gym staff update follow ups" on public.follow_ups for update to authenticated using (public.has_gym_role(gym_id, array['owner','admin','staff']::public.gym_role[])) with check (public.has_gym_role(gym_id, array['owner','admin','staff']::public.gym_role[]));
create policy "owners delete follow ups" on public.follow_ups for delete to authenticated using (public.has_gym_role(gym_id, array['owner','admin']::public.gym_role[]));

revoke all on function public.create_gym_for_current_user(text,text,text,text) from public;
grant execute on function public.create_gym_for_current_user(text,text,text,text) to authenticated;
revoke all on function public.check_in_with_qr(uuid,uuid) from public;
grant execute on function public.check_in_with_qr(uuid,uuid) to authenticated;
revoke all on function public.is_gym_member(uuid) from public;
grant execute on function public.is_gym_member(uuid) to authenticated;
revoke all on function public.has_gym_role(uuid,public.gym_role[]) from public;
grant execute on function public.has_gym_role(uuid,public.gym_role[]) to authenticated;

grant select, update on public.gyms to authenticated;
grant select, insert, update, delete on public.gym_memberships to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert on public.attendance to authenticated;
grant select, insert, update, delete on public.follow_ups to authenticated;
grant select, update on public.profiles to authenticated;

-- IMPORTANT: no service_role key belongs in browser environment variables.
