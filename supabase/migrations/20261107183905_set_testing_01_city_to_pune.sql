-- Fill the missing city for the specifically requested Testing 01 workspace.
-- Refuse to choose arbitrarily if multiple same-named gyms have no city.
do $migration$
declare
  target_count integer;
begin
  select count(*)
    into target_count
  from public.gyms
  where lower(trim(name)) = 'testing 01'
    and nullif(trim(city), '') is null;

  if target_count > 1 then
    raise exception 'More than one Testing 01 workspace has no city; update the intended gym by ID.';
  elsif target_count = 1 then
    update public.gyms
    set city = 'Pune'
    where lower(trim(name)) = 'testing 01'
      and nullif(trim(city), '') is null;
  end if;
end;
$migration$;
