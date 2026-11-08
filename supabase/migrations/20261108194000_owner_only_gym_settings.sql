-- Restrict workspace settings changes to the active Owner of the target gym.
-- Keep the RPC and all direct table writes unavailable to anonymous clients.
create or replace function public.update_gym_workspace_settings(
  target_gym uuid,
  requested_name text,
  requested_city text,
  requested_phone text,
  requested_theme text
)
returns table(gym_id uuid, gym_name text, gym_city text, gym_phone text, gym_theme text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Sign in to update gym settings';
  end if;

  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = target_gym
      and gm.user_id = (select auth.uid())
      and gm.active
      and gm.role::text = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'Only an active Owner can update this gym';
  end if;

  if char_length(trim(coalesce(requested_name, ''))) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Gym name must be between 2 and 120 characters';
  end if;
  if char_length(trim(coalesce(requested_city, ''))) not between 2 and 100 then
    raise exception using errcode = '22023', message = 'Enter a city between 2 and 100 characters';
  end if;
  if nullif(trim(coalesce(requested_phone, '')), '') is not null
    and char_length(trim(requested_phone)) not between 5 and 30 then
    raise exception using errcode = '22023', message = 'Gym phone must be between 5 and 30 characters';
  end if;
  if requested_theme is null or requested_theme not in (
    'fuchsia-grey', 'cream-black', 'red-black', 'green-ivory-yellow',
    'beige-grey', 'navy-electric', 'gradient-blue', 'brown-beige', 'onyx-champagne'
  ) then
    raise exception using errcode = '22023', message = 'Choose a supported LiftDesk theme';
  end if;

  update public.gyms g
  set name = trim(requested_name),
      city = trim(requested_city),
      phone = nullif(trim(coalesce(requested_phone, '')), ''),
      theme = requested_theme
  where g.id = target_gym;

  return query
  select g.id, g.name, g.city, g.phone, g.theme
  from public.gyms g
  where g.id = target_gym;
end;
$$;

revoke all on function public.update_gym_workspace_settings(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_gym_workspace_settings(uuid, text, text, text, text) to authenticated;
