-- LiftDesk Staff workspace: separate employee directory and staff attendance.
-- Does not create auth users or alter existing member attendance/data.
create table if not exists public.gym_staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_code text not null check (char_length(trim(staff_code)) between 2 and 32),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role text not null check (role in ('admin', 'trainer')),
  phone text not null check (char_length(trim(phone)) between 5 and 30),
  email text,
  joining_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  employment_status text not null default 'active' check (employment_status in ('active', 'inactive')),
  profile_photo_url text,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, staff_code),
  unique (id, gym_id)
);
create index if not exists gym_staff_gym_role_status_idx
  on public.gym_staff (gym_id, role, employment_status, full_name);

create table if not exists public.gym_staff_attendance (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_id uuid not null,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent')),
  note text check (note is null or char_length(note) <= 1000),
  marked_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gym_staff_attendance_staff_gym_fk
    foreign key (staff_id, gym_id) references public.gym_staff(id, gym_id) on delete cascade,
  constraint gym_staff_attendance_one_per_day unique (gym_id, staff_id, attendance_date)
);
create index if not exists gym_staff_attendance_gym_date_idx
  on public.gym_staff_attendance (gym_id, attendance_date desc);
create index if not exists gym_staff_attendance_staff_date_idx
  on public.gym_staff_attendance (staff_id, attendance_date desc);

create or replace function public.set_gym_staff_audit_fields()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gym_staff_audit_fields on public.gym_staff;
create trigger gym_staff_audit_fields
before insert or update on public.gym_staff
for each row execute function public.set_gym_staff_audit_fields();

drop trigger if exists gym_staff_attendance_audit_fields on public.gym_staff_attendance;
create trigger gym_staff_attendance_audit_fields
before insert or update on public.gym_staff_attendance
for each row execute function public.set_gym_staff_audit_fields();

alter table public.gym_staff enable row level security;
alter table public.gym_staff_attendance enable row level security;
revoke all on table public.gym_staff from anon, authenticated;
revoke all on table public.gym_staff_attendance from anon, authenticated;
grant select, insert, update on table public.gym_staff to authenticated;
grant select, insert, update on table public.gym_staff_attendance to authenticated;

drop policy if exists "gym owners and admins read staff" on public.gym_staff;
create policy "gym owners and admins read staff" on public.gym_staff
for select to authenticated using (
  public.has_gym_role(gym_id, array['owner']::public.gym_role[])
  or (
    role = 'trainer'
    and public.has_gym_role(gym_id, array['admin']::public.gym_role[])
  )
);

drop policy if exists "owners and admins create staff" on public.gym_staff;
create policy "owners and admins create staff" on public.gym_staff
for insert to authenticated with check (
  (created_by = (select auth.uid()) and updated_by = (select auth.uid()))
  and (
    public.has_gym_role(gym_id, array['owner']::public.gym_role[])
    or (
      role = 'trainer'
      and public.has_gym_role(gym_id, array['admin']::public.gym_role[])
    )
  )
);

drop policy if exists "owners and admins update staff" on public.gym_staff;
create policy "owners and admins update staff" on public.gym_staff
for update to authenticated
using (
  public.has_gym_role(gym_id, array['owner']::public.gym_role[])
  or (
    role = 'trainer'
    and public.has_gym_role(gym_id, array['admin']::public.gym_role[])
  )
)
with check (
  (updated_by = (select auth.uid()))
  and (
    public.has_gym_role(gym_id, array['owner']::public.gym_role[])
    or (
      role = 'trainer'
      and public.has_gym_role(gym_id, array['admin']::public.gym_role[])
    )
  )
);

drop policy if exists "gym owners and admins read staff attendance" on public.gym_staff_attendance;
create policy "gym owners and admins read staff attendance" on public.gym_staff_attendance
for select to authenticated using (
  exists (
    select 1 from public.gym_staff s
    where s.id = staff_id and s.gym_id = gym_staff_attendance.gym_id
      and (
        public.has_gym_role(s.gym_id, array['owner']::public.gym_role[])
        or (
          s.role = 'trainer'
          and public.has_gym_role(s.gym_id, array['admin']::public.gym_role[])
        )
      )
  )
);

drop policy if exists "gym owners and admins mark staff attendance" on public.gym_staff_attendance;
create policy "gym owners and admins mark staff attendance" on public.gym_staff_attendance
for insert to authenticated with check (
  marked_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1 from public.gym_staff s
    where s.id = staff_id and s.gym_id = gym_staff_attendance.gym_id
      and s.employment_status = 'active'
      and (
        public.has_gym_role(s.gym_id, array['owner']::public.gym_role[])
        or (
          s.role = 'trainer'
          and public.has_gym_role(s.gym_id, array['admin']::public.gym_role[])
        )
      )
  )
);

drop policy if exists "gym owners and admins correct staff attendance" on public.gym_staff_attendance;
create policy "gym owners and admins correct staff attendance" on public.gym_staff_attendance
for update to authenticated
using (
  exists (
    select 1 from public.gym_staff s
    where s.id = staff_id and s.gym_id = gym_staff_attendance.gym_id
      and (
        public.has_gym_role(s.gym_id, array['owner']::public.gym_role[])
        or (
          s.role = 'trainer'
          and public.has_gym_role(s.gym_id, array['admin']::public.gym_role[])
        )
      )
  )
)
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.gym_staff s
    where s.id = staff_id and s.gym_id = gym_staff_attendance.gym_id
      and (
        public.has_gym_role(s.gym_id, array['owner']::public.gym_role[])
        or (
          s.role = 'trainer'
          and public.has_gym_role(s.gym_id, array['admin']::public.gym_role[])
        )
      )
  )
);

comment on table public.gym_staff is 'Gym-scoped employee directory. Does not create Supabase Auth accounts.';
comment on table public.gym_staff_attendance is 'Gym-scoped, audited staff attendance; missing rows mean Not Marked.';
