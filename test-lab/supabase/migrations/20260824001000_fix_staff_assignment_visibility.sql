-- A staff assignment must be visible even when its role has no enabled task permission.
begin;

create or replace function public.get_my_staff_permissions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'assigned', public.is_platform_owner() or exists (
      select 1
      from public.staff_assignments as assignment
      join public.staff_roles as role on role.id = assignment.role_id
      where assignment.user_id = auth.uid()
        and assignment.is_active
        and role.is_active
        and assignment.starts_at <= now()
        and (assignment.expires_at is null or assignment.expires_at > now())
    ),
    'listings', public.can_staff('listings'),
    'reports', public.can_staff('reports'),
    'locations', public.can_staff('locations'),
    'users', public.can_staff('users'),
    'media', public.can_staff('media'),
    'staff', public.has_staff_permission('staff.assign') or public.is_platform_owner(),
    'support', public.can_staff('support'),
    'catalog', public.can_staff('catalog'),
    'markets', public.is_market_manager(),
    'legal', public.can_staff('legal'),
    'ads', public.can_staff('ads'),
    'tiers', public.can_staff('tiers'),
    'audit', public.has_staff_permission('audit.read') or public.is_platform_owner(),
    'platform_content', public.can_staff('platform_content.manage')
  );
$$;

revoke all on function public.get_my_staff_permissions() from public;
grant execute on function public.get_my_staff_permissions() to authenticated;

commit;
