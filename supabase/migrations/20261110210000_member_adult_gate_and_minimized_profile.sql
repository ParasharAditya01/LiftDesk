-- New member account claims are adult-only until LiftDesk has a verifiable
-- parent/guardian consent flow. Avoid requiring optional progress/contact data.
alter table public.members
  add column if not exists adult_attested_at timestamptz;

drop function if exists public.accept_member_invitation(text,text,text,text,integer,numeric,numeric);

create function public.accept_member_invitation(
  invitation_token text,
  full_name text,
  phone_number text,
  whatsapp_number text,
  member_age integer,
  adult_attested boolean,
  weight_kg numeric,
  height_cm numeric
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare invite public.member_invitations%rowtype; new_member_id uuid; user_email text;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before accepting a member invitation'; end if;
  if invitation_token is null or char_length(invitation_token) <> 64 then raise exception 'This invitation link is invalid'; end if;
  if char_length(trim(coalesce(full_name,''))) not between 2 and 120 then raise exception 'Enter your full name'; end if;
  if char_length(trim(coalesce(phone_number,''))) not between 5 and 30 then raise exception 'Enter a valid phone number'; end if;
  if nullif(trim(coalesce(whatsapp_number,'')), '') is not null
    and trim(whatsapp_number) !~ '^[0-9]{10}$' then
    raise exception 'Enter a 10-digit WhatsApp number';
  end if;
  if member_age not between 18 and 120 then raise exception 'Member accounts are available to people aged 18 or older'; end if;
  if adult_attested is distinct from true then raise exception 'Confirm that you are 18 or older'; end if;
  if weight_kg is not null and weight_kg not between 20 and 500 then raise exception 'Weight must be between 20 and 500 kg'; end if;
  if height_cm is not null and height_cm not between 80 and 260 then raise exception 'Height must be between 80 and 260 cm'; end if;
  if exists (select 1 from public.gym_memberships where user_id = (select auth.uid()) and active) then
    raise exception 'This account already belongs to a gym';
  end if;
  select * into invite from public.member_invitations mi
    where mi.token_hash = extensions.digest(invitation_token, 'sha256')
      and mi.used_at is null and mi.expires_at > now()
    for update;
  if not found then raise exception 'This invitation has expired or has already been used'; end if;
  select email into user_email from auth.users where id = (select auth.uid());
  insert into public.profiles(id, full_name)
    values ((select auth.uid()), trim(full_name))
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.members(
    gym_id, full_name, phone, email, whatsapp_number, age, weight_kg, height_cm, adult_attested_at, member_user_id
  ) values (
    invite.gym_id, trim(full_name), trim(phone_number), user_email,
    nullif(trim(coalesce(whatsapp_number,'')), ''), member_age, weight_kg, height_cm, now(), (select auth.uid())
  ) returning id into new_member_id;
  insert into public.gym_memberships(gym_id, user_id, role, active)
    values (invite.gym_id, (select auth.uid()), 'member', true);
  update public.member_invitations set used_at = now(), member_id = new_member_id where id = invite.id;
  return new_member_id;
end;
$$;

revoke all on function public.accept_member_invitation(text,text,text,text,integer,boolean,numeric,numeric) from public, anon;
grant execute on function public.accept_member_invitation(text,text,text,text,integer,boolean,numeric,numeric) to authenticated;
