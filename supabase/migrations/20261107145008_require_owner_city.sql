-- Require a real city on new owner workspace requests.
-- Existing requests with no city remain readable and approvable.

create or replace function public.request_owner_workspace(
  gym_name text,
  owner_name text,
  gym_city text default null,
  gym_phone text default null,
  gym_theme text default 'onyx-champagne'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  request_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in before requesting a workspace';
  end if;
  if char_length(trim(coalesce(gym_name, ''))) not between 2 and 120 then
    raise exception 'Enter a gym name between 2 and 120 characters';
  end if;
  if char_length(trim(coalesce(owner_name, ''))) not between 2 and 120 then
    raise exception 'Enter an owner name between 2 and 120 characters';
  end if;
  if char_length(trim(coalesce(gym_city, ''))) not between 2 and 100 then
    raise exception 'Enter a city name between 2 and 100 characters';
  end if;
  if gym_theme is null or gym_theme not in (
    'fuchsia-grey', 'cream-black', 'red-black', 'green-ivory-yellow',
    'beige-grey', 'navy-electric', 'gradient-blue', 'brown-beige', 'onyx-champagne'
  ) then
    raise exception 'Choose a supported gym theme';
  end if;
  if exists (
    select 1 from public.gym_memberships gm
    where gm.user_id = current_user_id and gm.active
  ) then
    raise exception 'This account already has an active gym workspace';
  end if;
  select u.email into current_email from auth.users u where u.id = current_user_id;
  if current_email is null then raise exception 'A verified account email is required'; end if;

  insert into public.owner_access_requests(
    user_id, owner_email, owner_name, gym_name, city, phone, gym_theme,
    status, review_note, reviewed_at, reviewed_by, updated_at
  ) values (
    current_user_id, lower(trim(current_email)), trim(owner_name), trim(gym_name),
    trim(gym_city), nullif(trim(coalesce(gym_phone, '')), ''), gym_theme,
    'pending', null, null, null, now()
  )
  on conflict (user_id) do update set
    owner_email = excluded.owner_email,
    owner_name = excluded.owner_name,
    gym_name = excluded.gym_name,
    city = excluded.city,
    phone = excluded.phone,
    gym_theme = excluded.gym_theme,
    status = 'pending',
    review_note = null,
    reviewed_at = null,
    reviewed_by = null,
    updated_at = now()
  where public.owner_access_requests.status = 'rejected'
  returning id into request_id;

  if request_id is null then
    raise exception 'A workspace request is already pending or has already been approved';
  end if;
  return request_id;
end;
$$;

revoke all on function public.request_owner_workspace(text, text, text, text, text) from public, anon;
grant execute on function public.request_owner_workspace(text, text, text, text, text) to authenticated;

comment on function public.request_owner_workspace(text, text, text, text, text) is
  'Creates or updates an authenticated owner workspace request with a required city name.';
