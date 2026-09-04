-- Make role removal complete and predictable: demoting a staff account to a
-- normal user also removes its stored staff permissions.
create or replace function public.set_staff_role(
  target_user uuid,
  new_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_role text;
begin
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;

  if not public.is_platform_owner()
     and not (public.is_admin() and new_role <> 'admin') then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.platform_owners
    where user_id = target_user
  ) then
    raise exception 'owner_role_cannot_be_changed' using errcode = '42501';
  end if;

  select profile.role::text
  into old_role
  from public.profiles as profile
  where profile.id = target_user
  for update;

  if old_role is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if target_user = auth.uid() then
    raise exception 'self_role_change_not_allowed' using errcode = '42501';
  end if;

  if not public.is_platform_owner() and old_role = 'admin' then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;

  update public.profiles as profile
  set role = new_role::public.user_role
  where profile.id = target_user;

  if new_role = 'user' then
    delete from public.staff_permissions as permission
    where permission.user_id = target_user;
  end if;

  insert into public.admin_audit_log(
    actor_id,
    action,
    target_type,
    target_id,
    details
  ) values (
    auth.uid(),
    'staff_role_changed',
    'profile',
    target_user::text,
    jsonb_build_object(
      'old_role', old_role,
      'new_role', new_role,
      'permissions_removed', new_role = 'user'
    )
  );
end;
$$;

revoke all on function public.set_staff_role(uuid, text) from public;
grant execute on function public.set_staff_role(uuid, text) to authenticated;
