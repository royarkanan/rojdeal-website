begin;
-- Read-only boolean predicates required while PostgreSQL evaluates the
-- existing RLS policies for public cities and public marketplace listings.
revoke all on function public.is_admin() from public;
revoke all on function public.is_user_interaction_blocked(uuid, uuid) from public;
grant execute on function public.is_admin()
  to anon, authenticated, service_role;
grant execute on function public.is_user_interaction_blocked(uuid, uuid)
  to anon, authenticated, service_role;
commit;
