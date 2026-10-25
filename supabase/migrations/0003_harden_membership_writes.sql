-- Harden tenant membership administration.
-- Membership invitations/role changes must go through a reviewed server-side workflow.
-- The current browser app only reads memberships; onboarding inserts the first owner
-- through create_gym_for_current_user(), which runs as SECURITY DEFINER.
revoke insert, update, delete on table public.gym_memberships from authenticated;
