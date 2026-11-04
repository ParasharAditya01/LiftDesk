-- One-time, email-bound staff login invitations. Access is granted only by the
-- authenticated acceptance RPC after checking the current gym_staff record.
create extension if not exists pgcrypto;

alter table public.gym_staff
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- Do not let browser clients assign the linkage field. Keep the existing staff
-- editor's writable directory fields, but reserve auth_user_id for the RPC.
revoke insert, update on table public.gym_staff from authenticated;
grant insert (gym_id, staff_code, full_name, role, phone, email, joining_date,
  employment_status, profile_photo_url, notes) on public.gym_staff to authenticated;
grant update (gym_id, staff_code, full_name, role, phone, email, joining_date,
  employment_status, profile_photo_url, notes) on public.gym_staff to authenticated;

create table if not exists public.gym_staff_invitations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_id uuid not null,
  role public.gym_role not null check (role in ('admin', 'trainer')),
  invited_email text not null check (char_length(trim(invited_email)) between 3 and 320),
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  revoked_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  constraint gym_staff_invitations_staff_gym_fk
    foreign key (staff_id, gym_id) references public.gym_staff(id, gym_id) on delete cascade
);
create index if not exists gym_staff_invitations_staff_created_idx
  on public.gym_staff_invitations (staff_id, created_at desc);
alter table public.gym_staff_invitations enable row level security;
revoke all on table public.gym_staff_invitations from anon, authenticated;

create or replace function public.create_gym_staff_invitation(target_staff uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  staff_row public.gym_staff%rowtype;
  raw_token text;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before inviting staff'; end if;

  select * into staff_row from public.gym_staff s where s.id = target_staff for update;
  if not found then raise exception 'Staff record not found'; end if;
  if not (
    public.has_gym_role(staff_row.gym_id, array['owner']::public.gym_role[])
    or (staff_row.role = 'trainer' and public.has_gym_role(staff_row.gym_id, array['admin']::public.gym_role[]))
  ) then raise exception 'You do not have permission to invite this staff member'; end if;
  if staff_row.employment_status <> 'active' then raise exception 'Only active staff can be invited'; end if;
  if staff_row.auth_user_id is not null then raise exception 'This staff member already has a LiftDesk login'; end if;
  if nullif(trim(coalesce(staff_row.email, '')), '') is null or position('@' in staff_row.email) < 2 then
    raise exception 'Add a valid staff email before creating an invitation';
  end if;

  update public.gym_staff_invitations
    set revoked_at = now()
    where staff_id = staff_row.id and used_at is null and revoked_at is null;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.gym_staff_invitations(gym_id, staff_id, role, invited_email, token_hash, created_by)
    values (staff_row.gym_id, staff_row.id, staff_row.role, lower(trim(staff_row.email)),
      extensions.digest(raw_token, 'sha256'), (select auth.uid()));
  return raw_token;
end;
$$;

create or replace function public.accept_gym_staff_invitation(invitation_token text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  invite public.gym_staff_invitations%rowtype;
  staff_row public.gym_staff%rowtype;
  auth_email text;
  confirmed_at timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before accepting a staff invitation'; end if;
  if invitation_token is null or char_length(invitation_token) <> 64 then raise exception 'This invitation link is invalid'; end if;

  select * into invite from public.gym_staff_invitations i
    where i.token_hash = extensions.digest(invitation_token, 'sha256')
      and i.used_at is null and i.revoked_at is null and i.expires_at > now()
    for update;
  if not found then raise exception 'This invitation has expired or has already been used'; end if;

  select * into staff_row from public.gym_staff s
    where s.id = invite.staff_id and s.gym_id = invite.gym_id for update;
  if not found or staff_row.employment_status <> 'active' or staff_row.role <> invite.role then
    raise exception 'The invited staff record is no longer active';
  end if;
  if not (
    public.has_gym_role(invite.gym_id, array['owner']::public.gym_role[])
    or (invite.role = 'trainer' and public.has_gym_role(invite.gym_id, array['admin']::public.gym_role[]))
  ) then raise exception 'This invitation is no longer authorized'; end if;
  if staff_row.auth_user_id is not null then raise exception 'This staff member already has a LiftDesk login'; end if;

  select lower(trim(u.email)), u.email_confirmed_at into auth_email, confirmed_at
    from auth.users u where u.id = (select auth.uid());
  if auth_email is null or auth_email <> invite.invited_email or lower(trim(coalesce(staff_row.email, ''))) <> invite.invited_email then
    raise exception 'Sign in with the email address this invitation was sent to';
  end if;
  if confirmed_at is null then raise exception 'Confirm your email before accepting the staff invitation'; end if;
  if exists (select 1 from public.gym_memberships gm where gm.user_id = (select auth.uid()) and gm.active) then
    raise exception 'This account already belongs to a gym';
  end if;

  insert into public.profiles(id, full_name)
    values ((select auth.uid()), staff_row.full_name)
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.gym_memberships(gym_id, user_id, role, active)
    values (invite.gym_id, (select auth.uid()), invite.role, true);
  update public.gym_staff set auth_user_id = (select auth.uid()) where id = staff_row.id;
  update public.gym_staff_invitations
    set used_at = now(), accepted_by = (select auth.uid()) where id = invite.id;
end;
$$;

revoke all on function public.create_gym_staff_invitation(uuid) from public, anon;
grant execute on function public.create_gym_staff_invitation(uuid) to authenticated;
revoke all on function public.accept_gym_staff_invitation(text) from public, anon;
grant execute on function public.accept_gym_staff_invitation(text) to authenticated;

comment on table public.gym_staff_invitations is
  'One-time email-bound invitations. Raw tokens are returned once by a role-checked RPC and never stored.';
