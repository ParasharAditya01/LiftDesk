-- LiftDesk platform-admin removal permanently deletes a gym and its gym-scoped records.
-- Dependent gym-owned tables reference gyms(id) with ON DELETE CASCADE.
create or replace function public.remove_liftdesk_gym_workspace(target_gym uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_liftdesk_platform_admin() then
    raise exception using errcode = '42501', message = 'Only a LiftDesk platform administrator can remove a gym';
  end if;

  delete from public.gyms where id = target_gym;
  if not found then
    raise exception 'This gym does not exist';
  end if;
end;
$$;

revoke all on function public.remove_liftdesk_gym_workspace(uuid) from public, anon;
grant execute on function public.remove_liftdesk_gym_workspace(uuid) to authenticated;

comment on function public.remove_liftdesk_gym_workspace(uuid) is
  'Permanently deletes a gym and all gym-scoped records for an authenticated LiftDesk platform administrator.';
