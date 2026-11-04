-- Universal gym QR self check-in. A member proves control of the registered
-- phone by completing Supabase SMS OTP, then this function matches that phone
-- to exactly one member inside the gym encoded by the public QR link.
create or replace function public.check_in_with_phone_otp(target_gym uuid)
returns table(attendance_id uuid, member_name text, gym_name text, checked_in_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  verified_phone text := regexp_replace(coalesce((select auth.jwt() ->> 'phone'), ''), '[^0-9]', '', 'g');
  phone_suffix text;
  match_count integer;
  found_member public.members%rowtype;
  found_gym_name text;
  new_attendance_id uuid;
  stamp timestamptz := now();
begin
  if (select auth.uid()) is null or length(verified_phone) < 10 then
    raise exception 'Phone verification is required';
  end if;

  phone_suffix := right(verified_phone, 10);

  select count(*) into match_count
  from public.members m
  where m.gym_id = target_gym
    and length(regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g')) >= 10
    and right(regexp_replace(m.phone, '[^0-9]', '', 'g'), 10) = phone_suffix;

  if match_count = 0 then
    raise exception 'No member matches this verified phone number in this gym';
  end if;
  if match_count > 1 then
    raise exception 'Multiple members match this phone number; ask gym staff to correct the records';
  end if;

  select m.* into found_member
  from public.members m
  where m.gym_id = target_gym
    and length(regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g')) >= 10
    and right(regexp_replace(m.phone, '[^0-9]', '', 'g'), 10) = phone_suffix
  for update;

  if found_member.status <> 'active' then
    raise exception 'Member is not active';
  end if;
  if found_member.membership_expires_on is not null
     and found_member.membership_expires_on < (stamp at time zone 'Asia/Kolkata')::date then
    raise exception 'Membership has expired';
  end if;
  if exists (
    select 1 from public.attendance a
    where a.member_id = found_member.id
      and a.checked_in_at > stamp - interval '60 seconds'
  ) then
    raise exception 'This member was checked in moments ago';
  end if;

  select g.name into found_gym_name from public.gyms g where g.id = target_gym;
  if found_gym_name is null then
    raise exception 'Gym was not found';
  end if;

  insert into public.attendance(gym_id, member_id, checked_in_at, method, recorded_by)
  values (target_gym, found_member.id, stamp, 'qr', (select auth.uid()))
  returning id into new_attendance_id;

  return query select new_attendance_id, found_member.full_name, found_gym_name, stamp;
end;
$$;

revoke all on function public.check_in_with_phone_otp(uuid) from public, anon;
grant execute on function public.check_in_with_phone_otp(uuid) to authenticated;
