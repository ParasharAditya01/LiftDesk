-- Keep staff directory role/status and the linked login's actual authorization
-- in sync. Direct browser updates are removed so this RPC is the only edit path.
revoke update on table public.gym_staff from authenticated;
revoke update (gym_id, staff_code, full_name, role, phone, email, joining_date,
  employment_status, profile_photo_url, notes) on table public.gym_staff from authenticated;

create table if not exists public.gym_staff_access_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  previous_role public.gym_role not null,
  new_role public.gym_role not null,
  previous_status text not null,
  new_status text not null,
  created_at timestamptz not null default now(),
  foreign key (staff_id, gym_id) references public.gym_staff(id, gym_id) on delete cascade
);
create index if not exists gym_staff_access_events_gym_created_idx
  on public.gym_staff_access_events (gym_id, created_at desc);
alter table public.gym_staff_access_events enable row level security;
revoke all on table public.gym_staff_access_events from anon, authenticated;
grant select on table public.gym_staff_access_events to authenticated;
create policy "owners and admins read staff access audit" on public.gym_staff_access_events
for select to authenticated using (
  public.has_gym_role(gym_id, array['owner']::public.gym_role[])
  or (new_role = 'trainer' and public.has_gym_role(gym_id, array['admin']::public.gym_role[]))
);

create or replace function public.update_gym_staff_directory(
  target_staff uuid,
  new_staff_code text,
  new_full_name text,
  new_role public.gym_role,
  new_phone text,
  new_email text,
  new_joining_date date,
  new_employment_status text,
  new_profile_photo_url text,
  new_notes text
)
returns public.gym_staff
language plpgsql security definer set search_path = ''
as $$
declare
  staff_row public.gym_staff%rowtype;
  result_row public.gym_staff%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before editing staff'; end if;

  select * into staff_row from public.gym_staff s where s.id = target_staff for update;
  if not found then raise exception 'Staff record not found'; end if;
  if not (
    public.has_gym_role(staff_row.gym_id, array['owner']::public.gym_role[])
    or (staff_row.role = 'trainer' and new_role = 'trainer'
        and public.has_gym_role(staff_row.gym_id, array['admin']::public.gym_role[]))
  ) then raise exception 'You do not have permission to edit this staff member'; end if;
  if new_role not in ('admin', 'trainer') then raise exception 'Invalid staff role'; end if;
  if new_employment_status not in ('active', 'inactive') then raise exception 'Invalid employment status'; end if;
  if staff_row.auth_user_id is not null
     and lower(trim(coalesce(new_email, ''))) is distinct from lower(trim(coalesce(staff_row.email, ''))) then
    raise exception 'Change the login email through the account email-change flow';
  end if;

  update public.gym_staff set
    staff_code = new_staff_code,
    full_name = new_full_name,
    role = new_role,
    phone = new_phone,
    email = nullif(trim(coalesce(new_email, '')), ''),
    joining_date = new_joining_date,
    employment_status = new_employment_status,
    profile_photo_url = nullif(trim(coalesce(new_profile_photo_url, '')), ''),
    notes = nullif(trim(coalesce(new_notes, '')), '')
  where id = target_staff
  returning * into result_row;

  if result_row.role is distinct from staff_row.role
     or result_row.employment_status is distinct from staff_row.employment_status then
    update public.gym_staff_invitations set revoked_at = now()
      where staff_id = staff_row.id and used_at is null and revoked_at is null;

    if staff_row.auth_user_id is not null then
      update public.gym_memberships gm set
        role = result_row.role,
        active = result_row.employment_status = 'active'
      where gm.gym_id = staff_row.gym_id and gm.user_id = staff_row.auth_user_id;
      if not found then
        raise exception 'Linked staff login has no matching gym membership; access was not changed';
      end if;
    end if;

    insert into public.gym_staff_access_events (
      gym_id, staff_id, actor_id, previous_role, new_role,
      previous_status, new_status
    ) values (
      staff_row.gym_id, staff_row.id, (select auth.uid()), staff_row.role, result_row.role,
      staff_row.employment_status, result_row.employment_status
    );
  end if;

  return result_row;
end;
$$;

revoke all on function public.update_gym_staff_directory(
  uuid,text,text,public.gym_role,text,text,date,text,text,text
) from public, anon;
grant execute on function public.update_gym_staff_directory(
  uuid,text,text,public.gym_role,text,text,date,text,text,text
) to authenticated;

comment on table public.gym_staff_access_events is
  'Append-only audit of staff role and active-status changes that affect login access.';
