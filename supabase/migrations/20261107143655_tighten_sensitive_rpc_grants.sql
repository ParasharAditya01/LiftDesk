-- Sensitive SECURITY DEFINER helpers must not be exposed to anonymous callers.
-- Keep the authenticated grants used by RLS and authenticated staff workflows.
revoke execute on function public.check_in_with_qr(uuid, uuid) from public, anon;
grant execute on function public.check_in_with_qr(uuid, uuid) to authenticated;

revoke execute on function public.record_manual_check_in(uuid, uuid) from public, anon;
grant execute on function public.record_manual_check_in(uuid, uuid) to authenticated;

revoke execute on function public.has_gym_role(uuid, public.gym_role[]) from public, anon;
grant execute on function public.has_gym_role(uuid, public.gym_role[]) to authenticated;

revoke execute on function public.is_gym_member(uuid) from public, anon;
grant execute on function public.is_gym_member(uuid) to authenticated;

-- These are invoked only by their existing event/row triggers, never by API RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.snapshot_coaching_plan_revision() from public, anon, authenticated;
