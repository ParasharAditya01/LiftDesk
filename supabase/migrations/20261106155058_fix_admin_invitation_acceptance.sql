-- Fix staff invitation acceptance authorization.
-- The invitee is not yet a gym member, so authorization must be checked against
-- the still-active inviter recorded on the invitation, not auth.uid().
create or replace function public.accept_gym_staff_invitation(invitation_token text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  invite public.gym_staff_invitations%rowtype;
  staff_row public.gym_staff%rowtype;
  auth_email text;
  confirmed_at timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before accepting a staff invitation'; end if;
  if invitation_token is null or char_length(invitation_token) <> 64 then raise exception 'This invitation link is invalid'; end if;

  select * into invite from public.gym_staff_invitations i
    where i.token_hash = extensions.digest(invitation_token, 'sha256')
      and i.used_at is null and i.revoked_at is null and i.expires_at > now()
    for update;
  if not found then raise exception 'This invitation has expired or has already been used'; end if;

  select * into staff_row from public.gym_staff s
    where s.id = invite.staff_id and s.gym_id = invite.gym_id for update;
  if not found or staff_row.employment_status <> 'active' or staff_row.role <> invite.role then
    raise exception 'The invited staff record is no longer active';
  end if;
  if not exists (
    select 1 from public.gym_memberships gm
    where gm.gym_id = invite.gym_id
      and gm.user_id = invite.created_by
      and gm.active
      and (
        gm.role = 'owner'
        or (invite.role = 'trainer' and gm.role = 'admin')
      )
  ) then raise exception 'This invitation is no longer authorized'; end if;
  if staff_row.auth_user_id is not null then raise exception 'This staff member already has a LiftDesk login'; end if;

  select lower(trim(u.email)), u.email_confirmed_at into auth_email, confirmed_at
    from auth.users u where u.id = (select auth.uid());
  if auth_email is null or auth_email <> invite.invited_email or lower(trim(coalesce(staff_row.email, ''))) <> invite.invited_email then
    raise exception 'Sign in with the email address this invitation was sent to';
  end if;
  if confirmed_at is null then raise exception 'Confirm your email before accepting the staff invitation'; end if;
  if exists (select 1 from public.gym_memberships gm where gm.user_id = (select auth.uid()) and gm.active) then
    raise exception 'This account already belongs to a gym';
  end if;

  insert into public.profiles(id, full_name)
    values ((select auth.uid()), staff_row.full_name)
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.gym_memberships(gym_id, user_id, role, active)
    values (invite.gym_id, (select auth.uid()), invite.role, true);
  update public.gym_staff set auth_user_id = (select auth.uid()) where id = staff_row.id;
  update public.gym_staff_invitations
    set used_at = now(), accepted_by = (select auth.uid()) where id = invite.id;
end;
$$;

revoke all on function public.accept_gym_staff_invitation(text) from public, anon;
grant execute on function public.accept_gym_staff_invitation(text) to authenticated;
