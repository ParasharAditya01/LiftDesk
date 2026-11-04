-- Harden tenant membership administration.
-- Browser clients may read memberships for workspace discovery, but must never
-- directly create memberships or change roles. Owner creation happens through
-- create_gym_for_current_user(), a validated SECURITY DEFINER RPC.
-- Remove all table-level privileges (including anon's unnecessary privileges),
-- then grant back only the read access required by the current frontend.
revoke all privileges on table public.gym_memberships from anon, authenticated;
grant select on table public.gym_memberships to authenticated;
