-- Enforce 10-digit phone and WhatsApp values for member-account records.
-- Staff-managed legacy records are not retroactively validated.
create or replace function public.validate_member_account_mobile_numbers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_user_id is not null then
    if coalesce(new.phone, '') !~ '^[0-9]{10}$' then
      raise exception 'Phone number must contain exactly 10 digits';
    end if;
    if coalesce(new.whatsapp_number, '') !~ '^[0-9]{10}$' then
      raise exception 'WhatsApp number must contain exactly 10 digits';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_member_account_mobile_numbers on public.members;
create trigger validate_member_account_mobile_numbers
before insert or update of phone, whatsapp_number, member_user_id on public.members
for each row execute function public.validate_member_account_mobile_numbers();
