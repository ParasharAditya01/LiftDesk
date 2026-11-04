-- New members and staff cannot be created with a joining date in the past.
-- Membership expiry for a new member must be today or later and cannot predate
-- that member's joining date. Historical values already stored remain readable.

alter table public.members
  alter column joined_on set default ((now() at time zone 'Asia/Kolkata')::date);

create or replace function public.validate_member_joining_and_expiry_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  business_today date := (now() at time zone 'Asia/Kolkata')::date;
  dates_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    dates_changed := true;
  else
    dates_changed := new.joined_on is distinct from old.joined_on
      or new.membership_expires_on is distinct from old.membership_expires_on;
  end if;

  if dates_changed and new.joined_on < business_today then
    raise exception using errcode = '23514', message = 'A new member joining date cannot be earlier than today.';
  end if;

  if new.membership_expires_on is not null
     and dates_changed
     and new.membership_expires_on < business_today then
    raise exception using errcode = '23514', message = 'Membership expiry cannot be earlier than today.';
  end if;

  if dates_changed and new.membership_expires_on is not null
     and new.membership_expires_on < new.joined_on then
    raise exception using errcode = '23514', message = 'Membership expiry cannot be earlier than the joining date.';
  end if;
  return new;
end;
$$;

drop trigger if exists members_validate_joining_and_expiry_dates on public.members;
create trigger members_validate_joining_and_expiry_dates
before insert or update on public.members
for each row execute function public.validate_member_joining_and_expiry_dates();

create or replace function public.validate_staff_joining_date()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  business_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if tg_op = 'INSERT' then
    if new.joining_date < business_today then
      raise exception using errcode = '23514', message = 'A new staff joining date cannot be earlier than today.';
    end if;
  elsif new.joining_date is distinct from old.joining_date and new.joining_date < business_today then
    raise exception using errcode = '23514', message = 'A new staff joining date cannot be earlier than today.';
  end if;
  return new;
end;
$$;

drop trigger if exists gym_staff_validate_joining_date on public.gym_staff;
create trigger gym_staff_validate_joining_date
before insert or update on public.gym_staff
for each row execute function public.validate_staff_joining_date();
