-- Enforce one attendance check-in per member per India calendar day.
-- The member-row lock serializes concurrent inserts for the same member.
-- Existing attendance rows are preserved; this migration does not delete history.
create or replace function public.enforce_one_checkin_per_member_per_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Lock the owning member row so concurrent check-ins for this member serialize.
  perform 1
  from public.members m
  where m.id = new.member_id
    and m.gym_id = new.gym_id
  for update;

  if not found then
    raise exception 'Member does not belong to this gym';
  end if;

  if exists (
    select 1
    from public.attendance a
    where a.member_id = new.member_id
      and a.gym_id = new.gym_id
      and (a.checked_in_at at time zone 'Asia/Kolkata')::date =
          (new.checked_in_at at time zone 'Asia/Kolkata')::date
      and a.id is distinct from new.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This member has already checked in today';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_one_checkin_per_member_per_day on public.attendance;
create trigger enforce_one_checkin_per_member_per_day
before insert or update of gym_id, member_id, checked_in_at
on public.attendance
for each row
execute function public.enforce_one_checkin_per_member_per_day();

revoke all on function public.enforce_one_checkin_per_member_per_day() from public, anon, authenticated;
