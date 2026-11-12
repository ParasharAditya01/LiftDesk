-- One rotating QR code per gym. Every member uses the same currently displayed code.
create table public.gym_checkin_challenges (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index gym_checkin_challenges_gym_expiry_idx
  on public.gym_checkin_challenges (gym_id, expires_at desc);

alter table public.gym_checkin_challenges enable row level security;
revoke all on table public.gym_checkin_challenges from public, anon, authenticated;

create or replace function public.issue_gym_checkin_challenge(target_gym uuid)
returns table(challenge text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare raw_token text; token_expiry timestamptz := now() + interval '2 minutes';
begin
  if (select auth.uid()) is null
    or not public.has_gym_role(target_gym, array['owner','admin','trainer']::public.gym_role[]) then
    raise exception using errcode = '42501', message = 'Staff access is required to display the gym check-in code';
  end if;

  -- Keep only currently usable short-lived challenges; raw tokens are never stored.
  delete from public.gym_checkin_challenges c where c.gym_id = target_gym and c.expires_at <= now();
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.gym_checkin_challenges (gym_id, token_hash, expires_at)
    values (target_gym, extensions.digest(raw_token, 'sha256'), token_expiry);
  return query select raw_token, token_expiry;
end;
$$;

create or replace function public.record_member_qr_check_in(
  target_gym uuid,
  presented_challenge text
)
returns table(attendance_id uuid, member_name text, checked_in_at timestamptz, already_checked_in boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  matched_member public.members%rowtype;
  existing_attendance public.attendance%rowtype;
  new_attendance_id uuid;
  stamp timestamptz := now();
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in with your gym member account to check in';
  end if;
  if presented_challenge is null or presented_challenge !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'This check-in code is invalid';
  end if;
  if not public.has_gym_role(target_gym, array['member']::public.gym_role[]) then
    raise exception using errcode = '42501', message = 'This account does not have member access to this gym';
  end if;
  if not exists (
    select 1 from public.gym_checkin_challenges c
    where c.gym_id = target_gym
      and c.token_hash = extensions.digest(presented_challenge, 'sha256')
      and c.expires_at > stamp
  ) then
    raise exception using errcode = '22023', message = 'This gym check-in code has expired. Scan the current code again';
  end if;

  select m.* into matched_member
  from public.members m
  where m.gym_id = target_gym and m.member_user_id = current_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'This account is not linked to a member record at this gym';
  end if;
  if matched_member.status <> 'active' then
    raise exception using errcode = '42501', message = 'Your membership is not active. Please contact gym staff';
  end if;
  if matched_member.membership_expires_on is not null
    and matched_member.membership_expires_on < (stamp at time zone 'Asia/Kolkata')::date then
    raise exception using errcode = '42501', message = 'Your membership has expired. Please contact gym staff';
  end if;

  -- The member row lock serializes scans for this account; return the existing
  -- visit for repeat scans while the trigger remains the final daily safeguard.
  select a.* into existing_attendance
  from public.attendance a
  where a.gym_id = target_gym and a.member_id = matched_member.id
    and (a.checked_in_at at time zone 'Asia/Kolkata')::date = (stamp at time zone 'Asia/Kolkata')::date
  order by a.checked_in_at desc
  limit 1;
  if found then
    return query select existing_attendance.id, matched_member.full_name, existing_attendance.checked_in_at, true;
    return;
  end if;

  insert into public.attendance (gym_id, member_id, checked_in_at, method, recorded_by)
    values (target_gym, matched_member.id, stamp, 'qr', current_user_id)
    returning id into new_attendance_id;
  return query select new_attendance_id, matched_member.full_name, stamp, false;
end;
$$;

revoke all on function public.issue_gym_checkin_challenge(uuid) from public, anon;
grant execute on function public.issue_gym_checkin_challenge(uuid) to authenticated;
revoke all on function public.record_member_qr_check_in(uuid,text) from public, anon;
grant execute on function public.record_member_qr_check_in(uuid,text) to authenticated;
