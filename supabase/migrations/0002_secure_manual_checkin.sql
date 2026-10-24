-- Server-side validation for manual check-ins as well as QR check-ins.
create or replace function public.record_manual_check_in(target_gym uuid, target_member uuid)
returns table(attendance_id uuid, member_name text, checked_in_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare found_member public.members%rowtype; new_id uuid; stamp timestamptz := now();
begin
  if (select auth.uid()) is null or not public.has_gym_role(target_gym, array['owner','admin','staff']::public.gym_role[]) then
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
revoke all on function public.record_manual_check_in(uuid,uuid) from public;
grant execute on function public.record_manual_check_in(uuid,uuid) to authenticated;
