-- RojDeal Build 5 follow-up: countries are launch-critical configuration.
-- Only the platform owner or an active general manager may view/change drafts
-- or activate additional markets. Syria remains the only public launch market.

begin;

create or replace function public.is_market_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_owner() or exists (
    select 1
    from public.staff_assignments as assignment
    join public.staff_roles as role on role.id = assignment.role_id
    where assignment.user_id = auth.uid()
      and assignment.is_active
      and role.is_active
      and role.role_key = 'general_manager'
      and assignment.starts_at <= now()
      and (assignment.expires_at is null or assignment.expires_at > now())
  );
$$;

revoke all on function public.is_market_manager() from public;
grant execute on function public.is_market_manager() to authenticated;

-- Expose this sensitive capability explicitly to the Flutter client. Do not
-- infer it from a collection of unrelated permissions.
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

drop policy if exists "active markets public read" on public.markets;
create policy "active markets public read" on public.markets
for select to anon, authenticated using (status = 'active');

drop policy if exists "market managers read every market" on public.markets;
create policy "market managers read every market" on public.markets
for select to authenticated using (public.is_market_manager());

drop policy if exists "location staff manages markets" on public.markets;
drop policy if exists "owner and general manager manage markets" on public.markets;
create policy "owner and general manager manage markets" on public.markets
for all to authenticated
using (public.is_market_manager())
with check (public.is_market_manager());

create or replace function public.set_market_status(
  target_market uuid,
  new_status text,
  change_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare previous_status text;
begin
  if not public.is_market_manager() then
    raise exception 'market_management_permission_required' using errcode = '42501';
  end if;
  if new_status not in ('draft','active','paused','archived') then
    raise exception 'invalid_market_status';
  end if;
  if length(trim(coalesce(change_reason, ''))) < 5 then
    raise exception 'market_status_reason_required';
  end if;
  select status into previous_status from public.markets
  where id = target_market for update;
  if previous_status is null then raise exception 'market_not_found'; end if;
  if previous_status = new_status then return; end if;
  update public.markets set
    status = new_status,
    updated_by = auth.uid(),
    updated_at = now()
  where id = target_market;
  insert into public.admin_audit_log(
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(), 'market_status_changed', 'market', target_market::text,
    jsonb_build_object(
      'previous_status', previous_status,
      'new_status', new_status,
      'reason', trim(change_reason)
    )
  );
end;
$$;

revoke all on function public.set_market_status(uuid,text,text) from public;
grant execute on function public.set_market_status(uuid,text,text) to authenticated;

commit;
