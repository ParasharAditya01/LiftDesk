-- Bound authenticated invitation creation to reduce abuse and email enumeration
-- pressure. The advisory transaction lock prevents concurrent requests from
-- bypassing the per-account count. No invitation tokens or email addresses are
-- added to the rate-limit audit surface.

create index if not exists member_invitations_creator_created_idx
  on public.member_invitations(created_by, created_at desc);
create index if not exists gym_staff_invitations_creator_created_idx
  on public.gym_staff_invitations(created_by, created_at desc);

create or replace function public.create_member_invitation(target_gym uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  raw_token text;
  recent_count bigint;
  requesting_user uuid := (select auth.uid());
begin
  if requesting_user is null or not public.has_gym_role(target_gym, array['owner','admin','trainer']::public.gym_role[]) then
    raise exception 'Only gym staff can create member invitations';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requesting_user::text || ':member-invitations', 0));
  select count(*) into recent_count from public.member_invitations
    where created_by = requesting_user and created_at > now() - interval '1 hour';
  if recent_count >= 20 then raise exception 'Invitation request limit reached. Try again later'; end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.member_invitations(gym_id, token_hash, created_by)
    values (target_gym, extensions.digest(raw_token, 'sha256'), requesting_user);
  return raw_token;
end;
$$;

create or replace function public.create_gym_staff_invitation(target_staff uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  staff_row public.gym_staff%rowtype;
  raw_token text;
  recent_count bigint;
  requesting_user uuid := (select auth.uid());
begin
  if requesting_user is null then raise exception 'Sign in before inviting staff'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requesting_user::text || ':staff-invitations', 0));
  select count(*) into recent_count from public.gym_staff_invitations
    where created_by = requesting_user and created_at > now() - interval '1 hour';
  if recent_count >= 10 then raise exception 'Invitation request limit reached. Try again later'; end if;

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
      extensions.digest(raw_token, 'sha256'), requesting_user);
  return raw_token;
end;
$$;

revoke all on function public.create_member_invitation(uuid) from public, anon;
grant execute on function public.create_member_invitation(uuid) to authenticated;
revoke all on function public.create_gym_staff_invitation(uuid) from public, anon;
grant execute on function public.create_gym_staff_invitation(uuid) to authenticated;
