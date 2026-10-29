-- Secure, gym-scoped member invitations and private member profiles.
-- Apply after 0007_gym_roles_trainer_member.sql.
create extension if not exists pgcrypto;

alter table public.members
  add column if not exists member_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists whatsapp_number text,
  add column if not exists age integer check (age is null or age between 13 and 120),
  add column if not exists weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 20 and 500),
  add column if not exists height_cm numeric(5,2) check (height_cm is null or height_cm between 80 and 260);

create table if not exists public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  member_id uuid references public.members(id) on delete set null
);
create index if not exists member_invitations_gym_created_idx on public.member_invitations(gym_id, created_at desc);
alter table public.member_invitations enable row level security;
revoke all on table public.member_invitations from anon, authenticated;

-- Member accounts may discover only their own membership and gym identity.
drop policy if exists "gym members can read their gym" on public.gyms;
create policy "gym members can read their gym" on public.gyms for select to authenticated
  using (public.is_gym_member(id) or exists (
    select 1 from public.gym_memberships gm
    where gm.gym_id = gyms.id and gm.user_id = (select auth.uid()) and gm.active and gm.role = 'member'
  ));

drop policy if exists "gym members read workspace memberships" on public.gym_memberships;
create policy "gym members read workspace memberships" on public.gym_memberships for select to authenticated
  using (public.is_gym_member(gym_id) or user_id = (select auth.uid()));

drop policy if exists "gym staff read members" on public.members;
create policy "gym staff read members" on public.members for select to authenticated
  using (
    public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or member_user_id = (select auth.uid())
  );

create or replace function public.create_member_invitation(target_gym uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare raw_token text; token_id uuid;
begin
  if (select auth.uid()) is null or not public.has_gym_role(target_gym, array['owner','admin','trainer']::public.gym_role[]) then
    raise exception 'Only gym staff can create member invitations';
  end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.member_invitations(gym_id, token_hash, created_by)
    values (target_gym, extensions.digest(raw_token, 'sha256'), (select auth.uid()))
    returning id into token_id;
  return raw_token;
end;
$$;

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
  select * into invite from public.member_invitations mi
    where mi.token_hash = extensions.digest(invitation_token, 'sha256')
      and mi.used_at is null and mi.expires_at > now()
    for update;
  if not found then raise exception 'This invitation has expired or has already been used'; end if;
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

revoke all on function public.create_member_invitation(uuid) from public, anon;
grant execute on function public.create_member_invitation(uuid) to authenticated;
revoke all on function public.accept_member_invitation(text,text,text,text,integer,numeric,numeric) from public, anon;
grant execute on function public.accept_member_invitation(text,text,text,text,integer,numeric,numeric) to authenticated;
