-- Rename staff to trainer in-place and reserve member without granting member access.
-- Existing membership rows remain attached to the same user and gym.
alter type public.gym_role rename value 'staff' to 'trainer';
alter type public.gym_role add value if not exists 'member';
alter table public.gym_memberships alter column role set default 'trainer';

-- Until member permissions are explicitly designed, only operational gym roles
-- may load the shared workspace. A member account cannot read other members'
-- records, attendance, follow-ups, or workspace membership details.
create or replace function public.is_gym_member(target_gym uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gym_memberships gm
    where gm.gym_id = target_gym and gm.user_id = (select auth.uid())
      and gm.active and gm.role in ('owner', 'admin', 'trainer')
  );
$$;

-- Update stored SECURITY DEFINER RPC bodies: PL/pgSQL source text is not
-- automatically rewritten when an enum label is renamed.
create or replace function public.check_in_with_qr(target_gym uuid, target_token uuid)
returns table(attendance_id uuid, member_name text, checked_in_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare found_member public.members%rowtype; new_attendance_id uuid; stamp timestamptz := now();
begin
  if (select auth.uid()) is null or not public.has_gym_role(target_gym, array['owner','admin','trainer']::public.gym_role[]) then
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

create or replace function public.record_manual_check_in(target_gym uuid, target_member uuid)
returns table(attendance_id uuid, member_name text, checked_in_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare found_member public.members%rowtype; new_id uuid; stamp timestamptz := now();
begin
  if (select auth.uid()) is null or not public.has_gym_role(target_gym, array['owner','admin','trainer']::public.gym_role[]) then
    raise exception 'You do not have permission to record attendance for this gym';
  end if;
  select * into found_member from public.members m
    where m.id = target_member and m.gym_id = target_gym for update;
  if not found then raise exception 'Member does not belong to this gym'; end if;
  if found_member.status <> 'active' then raise exception 'Member is not active'; end if;
  if found_member.membership_expires_on is not null and found_member.membership_expires_on < (stamp at time zone 'Asia/Kolkata')::date then
    raise exception 'Membership has expired';
  end if;
  if exists (select 1 from public.attendance a where a.member_id = found_member.id and a.checked_in_at > stamp - interval '60 seconds') then
    raise exception 'This member was checked in moments ago';
  end if;
  insert into public.attendance(gym_id, member_id, checked_in_at, method, recorded_by)
    values (target_gym, found_member.id, stamp, 'manual', (select auth.uid()))
    returning id into new_id;
  return query select new_id, found_member.full_name, stamp;
end;
$$;

revoke all on function public.is_gym_member(uuid) from public;
grant execute on function public.is_gym_member(uuid) to authenticated;
revoke all on function public.check_in_with_qr(uuid,uuid) from public;
grant execute on function public.check_in_with_qr(uuid,uuid) to authenticated;
revoke all on function public.record_manual_check_in(uuid,uuid) from public;
grant execute on function public.record_manual_check_in(uuid,uuid) to authenticated;

-- Refresh write policies so the persisted policy expressions explicitly use trainer.
drop policy if exists "gym staff add members" on public.members;
create policy "gym trainers add members" on public.members for insert to authenticated
  with check (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
drop policy if exists "gym staff update members" on public.members;
create policy "gym trainers update members" on public.members for update to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
drop policy if exists "gym staff create follow ups" on public.follow_ups;
create policy "gym trainers create follow ups" on public.follow_ups for insert to authenticated with check (
  public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
  and created_by = (select auth.uid())
  and exists (select 1 from public.members m where m.id = member_id and m.gym_id = follow_ups.gym_id)
);
drop policy if exists "gym staff update follow ups" on public.follow_ups;
create policy "gym trainers update follow ups" on public.follow_ups for update to authenticated using (
  public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
) with check (
  public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
  and exists (select 1 from public.members m where m.id = member_id and m.gym_id = follow_ups.gym_id)
);
