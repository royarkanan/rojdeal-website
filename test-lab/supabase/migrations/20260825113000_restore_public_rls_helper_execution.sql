begin;

-- These read-only boolean helpers are referenced by RLS policies on public
-- marketplace data. They must be executable by the roles whose SELECT
-- statements are evaluated by those policies.
revoke all on function public.is_staff() from public;
revoke all on function public.can_staff(text) from public;
revoke all on function public.is_profile_suspended(uuid) from public;

grant execute on function public.is_staff()
  to anon, authenticated, service_role;
grant execute on function public.can_staff(text)
  to anon, authenticated, service_role;
grant execute on function public.is_profile_suspended(uuid)
  to anon, authenticated, service_role;

commit;
