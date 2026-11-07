-- Require email on newly added members and staff without rewriting legacy rows.
-- Existing null emails remain unchanged; populated emails cannot be cleared.

create or replace function public.enforce_member_staff_email()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
begin
  if normalized_email = '' then
    if tg_op = 'UPDATE' then
      if nullif(trim(coalesce(old.email, '')), '') is null then
        new.email := null;
        return new;
      end if;
    end if;
    raise exception 'A valid email address is required';
  end if;

  if char_length(normalized_email) not between 3 and 320
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;

  new.email := normalized_email;
  return new;
end;
$$;

drop trigger if exists members_require_email on public.members;
create trigger members_require_email
before insert or update of email on public.members
for each row execute function public.enforce_member_staff_email();

drop trigger if exists gym_staff_require_email on public.gym_staff;
create trigger gym_staff_require_email
before insert or update of email on public.gym_staff
for each row execute function public.enforce_member_staff_email();

comment on function public.enforce_member_staff_email() is
  'Requires valid email for new member and staff records while preserving existing legacy rows with no email.';
