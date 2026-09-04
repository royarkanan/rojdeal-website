-- Build 8: make remote staff/tier changes visible and notify the affected user.

begin;

create or replace function public.notify_staff_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
begin
  if tg_op = 'INSERT' and new.is_active then
    notification_title := 'staffRoleAssigned';
    notification_body := 'staffRoleAssignedBody';
  elsif tg_op = 'UPDATE' and old.is_active and not new.is_active then
    notification_title := 'staffRoleRemoved';
    notification_body := 'staffRoleRemovedBody';
  elsif tg_op = 'UPDATE' and new.is_active and
        (old.role_id is distinct from new.role_id or
         old.expires_at is distinct from new.expires_at) then
    notification_title := 'staffRoleUpdated';
    notification_body := 'staffRoleUpdatedBody';
  else
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, payload)
  values (
    new.user_id,
    'staff_role',
    notification_title,
    notification_body,
    jsonb_build_object(
      'assignment_id', new.id,
      'role_id', new.role_id,
      'is_active', new.is_active,
      'expires_at', new.expires_at
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_staff_assignment_change
on public.staff_assignments;
create trigger notify_staff_assignment_change
after insert or update of role_id, is_active, expires_at
on public.staff_assignments
for each row execute function public.notify_staff_assignment_change();

create or replace function public.notify_account_tier_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.account_tier is not distinct from new.account_tier then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, payload)
  values (
    new.id,
    'account_tier',
    'accountTierChanged',
    case new.account_tier::text
      when 'standard' then 'accountTierStandardBody'
      when 'pro' then 'accountTierProBody'
      when 'gold' then 'accountTierGoldBody'
      else 'accountTierChangedBody'
    end,
    jsonb_build_object(
      'old_tier', old.account_tier,
      'new_tier', new.account_tier,
      'promotion_location_node_id', new.promotion_location_node_id
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_account_tier_change on public.profiles;
create trigger notify_account_tier_change
after update of account_tier on public.profiles
for each row execute function public.notify_account_tier_change();

revoke all on function public.notify_staff_assignment_change() from public;
revoke all on function public.notify_account_tier_change() from public;

commit;
