-- Require a LiftDesk platform-admin decision before a new Owner workspace exists.
-- Gym roles remain separate from this platform-level permission.

create table if not exists public.liftdesk_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  owner_email text not null check (char_length(trim(owner_email)) between 3 and 320),
  owner_name text not null check (char_length(trim(owner_name)) between 2 and 120),
  gym_name text not null check (char_length(trim(gym_name)) between 2 and 120),
  city text,
  phone text,
  gym_theme text not null default 'onyx-champagne' check (gym_theme in (
    'fuchsia-grey', 'cream-black', 'red-black', 'green-ivory-yellow',
    'beige-grey', 'navy-electric', 'gradient-blue', 'brown-beige', 'onyx-champagne'
  )),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists owner_access_requests_status_created_idx
  on public.owner_access_requests(status, created_at desc);

alter table public.liftdesk_platform_admins enable row level security;
alter table public.owner_access_requests enable row level security;

create or replace function public.is_liftdesk_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.liftdesk_platform_admins a
    where a.user_id = (select auth.uid())
  );
$$;

drop policy if exists "platform admins can read own platform role" on public.liftdesk_platform_admins;
create policy "platform admins can read own platform role"
  on public.liftdesk_platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "owners and platform admins can read relevant requests" on public.owner_access_requests;
create policy "owners and platform admins can read relevant requests"
  on public.owner_access_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_liftdesk_platform_admin());

revoke all on public.liftdesk_platform_admins from anon, authenticated;
grant select on public.liftdesk_platform_admins to authenticated;
revoke all on public.owner_access_requests from anon, authenticated;
grant select on public.owner_access_requests to authenticated;

-- User-created requests can only describe the signed-in account. Direct table
-- writes are denied; this RPC is the only owner-facing write path.
create or replace function public.request_owner_workspace(
  gym_name text,
  owner_name text,
  gym_city text default null,
  gym_phone text default null,
  gym_theme text default 'onyx-champagne'
)
returns uuid
language plpgsql security definer set search_path = ''
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
    user_id, owner_email, owner_name, gym_name, city, phone, gym_theme,
    status, review_note, reviewed_at, reviewed_by, updated_at
  ) values (
    current_user_id, lower(trim(current_email)), trim(owner_name), trim(gym_name),
    nullif(trim(coalesce(gym_city, '')), ''), nullif(trim(coalesce(gym_phone, '')), ''), gym_theme,
    'pending', null, null, null, now()
  )
  on conflict (user_id) do update set
    owner_email = excluded.owner_email,
    owner_name = excluded.owner_name,
    gym_name = excluded.gym_name,
    city = excluded.city,
    phone = excluded.phone,
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

create or replace function public.approve_owner_workspace_request(request_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  request_row public.owner_access_requests%rowtype;
  new_gym_id uuid;
begin
  if not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Only a LiftDesk platform administrator can approve owners';
  end if;
  select * into request_row
  from public.owner_access_requests r
  where r.id = request_id and r.status = 'pending'
  for update;
  if not found then raise exception 'This request is no longer pending'; end if;
  if exists (
    select 1 from public.gym_memberships gm
    where gm.user_id = request_row.user_id and gm.active
  ) then
    raise exception 'This account already has an active gym workspace';
  end if;

  insert into public.profiles(id, full_name)
  values (request_row.user_id, request_row.owner_name)
  on conflict (id) do update set full_name = excluded.full_name;
  insert into public.gyms(name, owner_id, city, phone, theme)
  values (request_row.gym_name, request_row.user_id, request_row.city, request_row.phone, request_row.gym_theme)
  returning id into new_gym_id;
  insert into public.gym_memberships(gym_id, user_id, role, active)
  values (new_gym_id, request_row.user_id, 'owner', true);
  update public.owner_access_requests
  set status = 'approved', review_note = null,
      reviewed_at = now(), reviewed_by = (select auth.uid()), updated_at = now()
  where id = request_row.id;
  return new_gym_id;
end;
$$;

create or replace function public.reject_owner_workspace_request(request_id uuid, decision_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Only a LiftDesk platform administrator can reject owner requests';
  end if;
  if decision_note is not null and char_length(decision_note) > 1000 then
    raise exception 'Decision note must be 1000 characters or fewer';
  end if;
  update public.owner_access_requests
  set status = 'rejected', review_note = nullif(trim(coalesce(decision_note, '')), ''),
      reviewed_at = now(), reviewed_by = (select auth.uid()), updated_at = now()
  where id = request_id and status = 'pending';
  if not found then raise exception 'This request is no longer pending'; end if;
end;
$$;

-- Close the old direct owner-creation route. Existing workspaces and memberships
-- are untouched; future workspaces must be created by the approval RPC above.
create or replace function public.create_gym_for_current_user(
  gym_name text, owner_name text, gym_city text default null, gym_phone text default null
)
returns uuid language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Owner workspace access requires LiftDesk approval';
end;
$$;

create or replace function public.create_gym_for_current_user(
  gym_name text, owner_name text, gym_city text, gym_phone text, gym_theme text
)
returns uuid language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Owner workspace access requires LiftDesk approval';
end;
$$;

revoke all on function public.is_liftdesk_platform_admin() from public, anon;
grant execute on function public.is_liftdesk_platform_admin() to authenticated;
revoke all on function public.request_owner_workspace(text,text,text,text,text) from public, anon;
grant execute on function public.request_owner_workspace(text,text,text,text,text) to authenticated;
revoke all on function public.approve_owner_workspace_request(uuid) from public, anon;
grant execute on function public.approve_owner_workspace_request(uuid) to authenticated;
revoke all on function public.reject_owner_workspace_request(uuid,text) from public, anon;
grant execute on function public.reject_owner_workspace_request(uuid,text) to authenticated;
revoke all on function public.create_gym_for_current_user(text,text,text,text) from public, anon;
revoke all on function public.create_gym_for_current_user(text,text,text,text,text) from public, anon;
grant execute on function public.create_gym_for_current_user(text,text,text,text) to authenticated;
grant execute on function public.create_gym_for_current_user(text,text,text,text,text) to authenticated;
