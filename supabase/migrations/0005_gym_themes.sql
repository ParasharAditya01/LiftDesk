-- Persist each gym's dashboard theme. Existing gyms keep LiftDesk's original theme.
alter table public.gyms
  add column if not exists theme text not null default 'onyx-champagne';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gyms_theme_check'
      and conrelid = 'public.gyms'::regclass
  ) then
    alter table public.gyms
      add constraint gyms_theme_check check (theme in (
        'fuchsia-grey', 'cream-black', 'red-black', 'green-ivory-yellow',
        'beige-grey', 'navy-electric', 'gradient-blue', 'brown-beige', 'onyx-champagne'
      ));
  end if;
end;
$$;

-- New clients pass all five arguments. The four-argument RPC remains available
-- to older clients and uses the default theme; no argument-count ambiguity exists.
create or replace function public.create_gym_for_current_user(
  gym_name text,
  owner_name text,
  gym_city text default null,
  gym_phone text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  return public.create_gym_for_current_user(gym_name, owner_name, gym_city, gym_phone, 'onyx-champagne');
end;
$$;

create or replace function public.create_gym_for_current_user(
  gym_name text,
  owner_name text,
  gym_city text,
  gym_phone text,
  gym_theme text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare new_gym_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before creating a gym'; end if;
  if char_length(trim(coalesce(gym_name,''))) not between 2 and 120 then raise exception 'Enter a gym name between 2 and 120 characters'; end if;
  if gym_theme is null or gym_theme not in (
    'fuchsia-grey', 'cream-black', 'red-black', 'green-ivory-yellow',
    'beige-grey', 'navy-electric', 'gradient-blue', 'brown-beige', 'onyx-champagne'
  ) then raise exception 'Choose a supported gym theme'; end if;
  if exists (select 1 from public.gym_memberships where user_id = (select auth.uid()) and active) then
    raise exception 'This account already belongs to a gym. Ask an owner to invite you to another workspace.';
  end if;
  insert into public.profiles(id, full_name) values ((select auth.uid()), trim(coalesce(owner_name,'')))
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.gyms(name, owner_id, city, phone, theme)
    values (trim(gym_name), (select auth.uid()), nullif(trim(coalesce(gym_city,'')),''), nullif(trim(coalesce(gym_phone,'')),''), gym_theme)
    returning id into new_gym_id;
  insert into public.gym_memberships(gym_id, user_id, role) values (new_gym_id, (select auth.uid()), 'owner');
  return new_gym_id;
end;
$$;

revoke all on function public.create_gym_for_current_user(text,text,text,text) from public, anon;
revoke all on function public.create_gym_for_current_user(text,text,text,text,text) from public, anon;
grant execute on function public.create_gym_for_current_user(text,text,text,text) to authenticated;
grant execute on function public.create_gym_for_current_user(text,text,text,text,text) to authenticated;
