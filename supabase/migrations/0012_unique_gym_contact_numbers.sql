-- Enforce one contact number per person across member and staff records within each gym.
-- The registry provides a single unique key across both tables, avoiding cross-table race conditions.
create or replace function public.normalize_gym_contact_number(raw_number text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_number, ''), '[^0-9]', '', 'g');
  if digits = '' then
    return '';
  end if;

  -- Normalize common Indian formats to the same key.
  if left(digits, 2) = '00' then
    digits := substr(digits, 3);
  end if;
  if length(digits) = 10 then
    digits := '91' || digits;
  elsif length(digits) = 11 and left(digits, 1) = '0' then
    digits := '91' || substr(digits, 2);
  end if;

  return digits;
end;
$$;

create table if not exists public.gym_contact_number_registry (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  normalized_phone text not null,
  source_table text not null check (source_table in ('members', 'gym_staff')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  constraint gym_contact_number_registry_gym_phone_key unique (gym_id, normalized_phone),
  constraint gym_contact_number_registry_source_key unique (source_table, source_id)
);

alter table public.gym_contact_number_registry enable row level security;
revoke all on table public.gym_contact_number_registry from anon, authenticated;
revoke all on function public.normalize_gym_contact_number(text) from public, anon, authenticated;

-- Fail clearly instead of silently choosing which existing person owns a duplicated number.
do $$
declare
  duplicate_numbers text;
begin
  with contacts as (
    select gym_id, public.normalize_gym_contact_number(phone) as normalized_phone, 'member' as source
    from public.members
    union all
    select gym_id, public.normalize_gym_contact_number(phone) as normalized_phone, 'staff' as source
    from public.gym_staff
  )
  select string_agg(format('gym=%s number=%s (%s records)', gym_id, normalized_phone, count), '; ')
    into duplicate_numbers
  from (
    select gym_id, normalized_phone, count(*) as count
    from contacts
    where normalized_phone <> ''
    group by gym_id, normalized_phone
    having count(*) > 1
    order by gym_id, normalized_phone
    limit 20
  ) duplicates;

  if duplicate_numbers is not null then
    raise exception 'Cannot enforce unique phone numbers until existing duplicates are resolved: %', duplicate_numbers
      using errcode = '23505';
  end if;
end;
$$;

insert into public.gym_contact_number_registry (gym_id, normalized_phone, source_table, source_id)
select gym_id, public.normalize_gym_contact_number(phone), 'members', id
from public.members
where public.normalize_gym_contact_number(phone) <> ''
on conflict do nothing;

insert into public.gym_contact_number_registry (gym_id, normalized_phone, source_table, source_id)
select gym_id, public.normalize_gym_contact_number(phone), 'gym_staff', id
from public.gym_staff
where public.normalize_gym_contact_number(phone) <> ''
on conflict do nothing;

create or replace function public.enforce_unique_gym_contact_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
begin
  if tg_op = 'DELETE' then
    delete from public.gym_contact_number_registry
    where source_table = tg_table_name and source_id = old.id;
    return old;
  end if;

  normalized := public.normalize_gym_contact_number(new.phone);

  delete from public.gym_contact_number_registry
  where source_table = tg_table_name and source_id = new.id;

  if normalized <> '' then
    begin
      insert into public.gym_contact_number_registry (gym_id, normalized_phone, source_table, source_id)
      values (new.gym_id, normalized, tg_table_name, new.id);
    exception when unique_violation then
      raise exception 'This phone/WhatsApp number is already used by another person in this gym.'
        using errcode = '23505', constraint = 'gym_contact_number_registry_gym_phone_key';
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_unique_gym_contact_number() from public, anon, authenticated;

drop trigger if exists members_unique_contact_number on public.members;
create trigger members_unique_contact_number
before insert or update of gym_id, phone or delete on public.members
for each row execute function public.enforce_unique_gym_contact_number();

drop trigger if exists gym_staff_unique_contact_number on public.gym_staff;
create trigger gym_staff_unique_contact_number
before insert or update of gym_id, phone or delete on public.gym_staff
for each row execute function public.enforce_unique_gym_contact_number();

comment on table public.gym_contact_number_registry is
  'Private registry enforcing unique normalized contact numbers across member and staff records within each gym.';
