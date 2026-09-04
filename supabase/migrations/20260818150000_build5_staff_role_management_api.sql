-- Build 5: simple, audited APIs for managing the granular staff-role model.

begin;
create or replace function public.get_my_staff_permissions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'listings', public.can_staff('listings'),
    'reports', public.can_staff('reports'),
    'locations', public.can_staff('locations'),
    'users', public.can_staff('users'),
    'media', public.can_staff('media'),
    'staff', public.has_staff_permission('staff.assign') or public.is_platform_owner(),
    'support', public.can_staff('support'),
    'catalog', public.can_staff('catalog'),
    'legal', public.can_staff('legal'),
    'ads', public.can_staff('ads'),
    'tiers', public.can_staff('tiers'),
    'platform_content', public.can_staff('platform_content.manage')
  );
$$;
revoke all on function public.get_my_staff_permissions() from public;
grant execute on function public.get_my_staff_permissions() to authenticated;
create or replace function public.assign_scoped_staff_role_by_email(
  target_email text,
  target_role_key text,
  assignment_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user uuid;
  existing record;
  assignment_id uuid;
begin
  if not public.is_platform_owner()
     and not public.has_staff_permission('staff.assign') then
    raise exception 'staff_assignment_permission_required' using errcode = '42501';
  end if;

  select account.id into target_user
  from auth.users as account
  where lower(account.email) = lower(trim(target_email))
  limit 1;
  if target_user is null then raise exception 'account_not_found'; end if;
  if exists (select 1 from public.platform_owners where user_id = target_user) then
    raise exception 'owner_account_cannot_be_modified' using errcode = '42501';
  end if;
  if target_role_key = 'general_manager' and not public.is_platform_owner() then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;

  for existing in
    select assignment.id
    from public.staff_assignments as assignment
    where assignment.user_id = target_user and assignment.is_active
    for update
  loop
    perform public.remove_staff_assignment(
      existing.id,
      coalesce(nullif(trim(assignment_note), ''), 'Role replaced')
    );
  end loop;

  assignment_id := public.assign_scoped_staff_role(
    target_user,
    target_role_key,
    null,
    null,
    null,
    null,
    assignment_note
  );
  return assignment_id;
end;
$$;
revoke all on function public.assign_scoped_staff_role_by_email(text,text,text)
from public;
grant execute on function public.assign_scoped_staff_role_by_email(text,text,text)
to authenticated;
create or replace function public.list_staff_accounts_v2()
returns table (
  id uuid,
  assignment_id uuid,
  email text,
  display_name text,
  role text,
  role_names jsonb,
  is_owner boolean,
  is_suspended boolean,
  can_manage_listings boolean,
  can_manage_reports boolean,
  can_manage_locations boolean,
  can_manage_users boolean,
  can_review_media boolean,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    profile.id,
    null::uuid,
    coalesce(account.email, ''),
    profile.display_name,
    'owner'::text,
    '{"ar":"المالك","ku":"Xwedî","en":"Owner","de":"Inhaber"}'::jsonb,
    true,
    coalesce(profile.is_suspended, false),
    true, true, true, true, true,
    null::timestamptz
  from public.platform_owners as owner_row
  join public.profiles as profile on profile.id = owner_row.user_id
  join auth.users as account on account.id = profile.id
  where public.is_staff()

  union all

  select
    profile.id,
    assignment.id,
    coalesce(account.email, ''),
    profile.display_name,
    role.role_key,
    role.names,
    false,
    coalesce(profile.is_suspended, false),
    exists (
      select 1 from public.staff_role_permissions permission
      where permission.role_id = role.id
        and permission.permission_key = 'listings.manage'
    ),
    exists (
      select 1 from public.staff_role_permissions permission
      where permission.role_id = role.id
        and permission.permission_key = 'reports.manage'
    ),
    exists (
      select 1 from public.staff_role_permissions permission
      where permission.role_id = role.id
        and permission.permission_key = 'locations.manage'
    ),
    exists (
      select 1 from public.staff_role_permissions permission
      where permission.role_id = role.id
        and permission.permission_key = 'users.manage'
    ),
    exists (
      select 1 from public.staff_role_permissions permission
      where permission.role_id = role.id
        and permission.permission_key = 'media.review'
    ),
    assignment.expires_at
  from public.staff_assignments as assignment
  join public.profiles as profile on profile.id = assignment.user_id
  join auth.users as account on account.id = profile.id
  join public.staff_roles as role on role.id = assignment.role_id
  where public.is_staff()
    and assignment.is_active
    and role.is_active
    and assignment.starts_at <= now()
    and (assignment.expires_at is null or assignment.expires_at > now())
  order by 7 desc, 5, 3;
$$;
revoke all on function public.list_staff_accounts_v2() from public;
grant execute on function public.list_staff_accounts_v2() to authenticated;
commit;
