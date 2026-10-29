-- Gym-scoped trainer coaching records. Apply after 0011_staff_workspace.sql.
-- Composite foreign keys make it impossible to pair a member with the wrong gym.
alter table public.members add constraint members_gym_id_id_unique unique (gym_id, id);

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  objective text not null default '',
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  plan_data jsonb not null default '{}'::jsonb check (jsonb_typeof(plan_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diet_plans_member_gym_fk foreign key (gym_id, member_id)
    references public.members(gym_id, id) on delete cascade,
  check (ends_on is null or ends_on >= starts_on)
);
create index diet_plans_gym_member_idx on public.diet_plans(gym_id, member_id, updated_at desc);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  goal text not null default '',
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  plan_data jsonb not null default '{}'::jsonb check (jsonb_typeof(plan_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_plans_member_gym_fk foreign key (gym_id, member_id)
    references public.members(gym_id, id) on delete cascade,
  check (ends_on is null or ends_on >= starts_on)
);
create index workout_plans_gym_member_idx on public.workout_plans(gym_id, member_id, updated_at desc);

create table public.member_progress (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  recorded_on date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 20 and 500),
  measurements jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements) = 'object'),
  milestone text not null default '',
  workout_notes text not null default '',
  member_feedback text not null default '',
  observations text not null default '',
  created_at timestamptz not null default now(),
  constraint member_progress_member_gym_fk foreign key (gym_id, member_id)
    references public.members(gym_id, id) on delete cascade
);
create index member_progress_gym_member_idx on public.member_progress(gym_id, member_id, recorded_on desc);

create table public.coaching_notes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  category text not null default 'general' check (category in ('general','diet','workout','follow-up')),
  note text not null check (char_length(trim(note)) between 1 and 5000),
  follow_up_on date,
  created_at timestamptz not null default now(),
  constraint coaching_notes_member_gym_fk foreign key (gym_id, member_id)
    references public.members(gym_id, id) on delete cascade
);
create index coaching_notes_gym_member_idx on public.coaching_notes(gym_id, member_id, created_at desc);

create table public.coaching_plan_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('diet','workout')),
  name text not null check (char_length(trim(name)) between 2 and 120),
  objective text not null default '',
  plan_data jsonb not null check (jsonb_typeof(plan_data) = 'object'),
  created_at timestamptz not null default now(),
  unique (gym_id, id)
);
create index coaching_templates_gym_kind_idx on public.coaching_plan_templates(gym_id, kind, name);

create table public.coaching_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null,
  plan_kind text not null check (plan_kind in ('diet','workout')),
  plan_id uuid not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  foreign key (gym_id, member_id) references public.members(gym_id, id) on delete cascade
);
create index coaching_plan_revisions_member_idx on public.coaching_plan_revisions(gym_id, member_id, changed_at desc);

create or replace function public.keep_coaching_creator_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'The original coaching record creator cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger diet_plan_creator_immutable before update on public.diet_plans
  for each row execute function public.keep_coaching_creator_immutable();
create trigger workout_plan_creator_immutable before update on public.workout_plans
  for each row execute function public.keep_coaching_creator_immutable();
create or replace function public.keep_coaching_template_creator_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'The original template creator cannot be changed';
  end if;
  return new;
end;
$$;
create trigger coaching_template_creator_immutable before update on public.coaching_plan_templates
  for each row execute function public.keep_coaching_template_creator_immutable();
create or replace function public.snapshot_coaching_plan_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.coaching_plan_revisions(gym_id, member_id, plan_kind, plan_id, changed_by, snapshot)
  values (old.gym_id, old.member_id, tg_argv[0], old.id, (select auth.uid()), to_jsonb(old));
  return new;
end;
$$;
create trigger diet_plan_history before update on public.diet_plans
  for each row execute function public.snapshot_coaching_plan_revision('diet');
create trigger workout_plan_history before update on public.workout_plans
  for each row execute function public.snapshot_coaching_plan_revision('workout');

alter table public.diet_plans enable row level security;
alter table public.workout_plans enable row level security;
alter table public.member_progress enable row level security;
alter table public.coaching_notes enable row level security;
alter table public.coaching_plan_templates enable row level security;
alter table public.coaching_plan_revisions enable row level security;
revoke all on public.diet_plans, public.workout_plans, public.member_progress, public.coaching_notes, public.coaching_plan_templates, public.coaching_plan_revisions from anon, authenticated;
grant select, insert, update on public.diet_plans, public.workout_plans to authenticated;
grant select, insert on public.member_progress, public.coaching_notes to authenticated;
grant select, insert on public.coaching_plan_templates to authenticated;
grant select on public.coaching_plan_revisions to authenticated;

-- Staff read is gym-scoped; members can only read their own active/completed plans.
create policy "coaching staff read diet plans" on public.diet_plans for select to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or (status in ('active','completed') and exists (
      select 1 from public.members m where m.id = diet_plans.member_id
        and m.gym_id = diet_plans.gym_id and m.member_user_id = (select auth.uid())
    )));
create policy "coaching staff create diet plans" on public.diet_plans for insert to authenticated
  with check (created_by = (select auth.uid()) and public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
create policy "coaching staff update diet plans" on public.diet_plans for update to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));

create policy "coaching staff read workout plans" on public.workout_plans for select to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or (status in ('active','completed') and exists (
      select 1 from public.members m where m.id = workout_plans.member_id
        and m.gym_id = workout_plans.gym_id and m.member_user_id = (select auth.uid())
    )));
create policy "coaching staff create workout plans" on public.workout_plans for insert to authenticated
  with check (created_by = (select auth.uid()) and public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
create policy "coaching staff update workout plans" on public.workout_plans for update to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));

create policy "coaching staff read progress" on public.member_progress for select to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[])
    or exists (select 1 from public.members m where m.id = member_progress.member_id
      and m.gym_id = member_progress.gym_id and m.member_user_id = (select auth.uid())));
create policy "coaching staff create progress" on public.member_progress for insert to authenticated
  with check (created_by = (select auth.uid()) and public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));

-- Coaching notes are an append-only history visible only to authorized gym staff.
create policy "coaching staff read notes" on public.coaching_notes for select to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
create policy "coaching staff create notes" on public.coaching_notes for insert to authenticated
  with check (created_by = (select auth.uid()) and public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));

create policy "coaching staff manage templates" on public.coaching_plan_templates for select to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
create policy "coaching staff create templates" on public.coaching_plan_templates for insert to authenticated
  with check (created_by = (select auth.uid()) and public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
create policy "coaching staff read revisions" on public.coaching_plan_revisions for select to authenticated
  using (public.has_gym_role(gym_id, array['owner','admin','trainer']::public.gym_role[]));
