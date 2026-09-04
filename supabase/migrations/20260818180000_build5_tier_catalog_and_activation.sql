begin;
-- Upgrade requests describe the desired account tier. A geographic promotion
-- can be requested as an optional extra, but must never block an upgrade.
alter table public.promotion_requests
  drop constraint if exists promotion_requests_locations_required;
alter table public.promotion_requests
  add constraint promotion_requests_locations_optional check (
    cardinality(location_node_ids) between 0 and 20
  );
alter table public.promotion_requests
  drop constraint if exists promotion_requests_payment_method_check;
alter table public.promotion_requests
  add constraint promotion_requests_payment_method_valid check (
    payment_method ~ '^[a-z0-9_]{2,80}$'
  );
create unique index if not exists promotion_requests_one_pending_per_user
on public.promotion_requests(requester_id)
where state in ('pending','contacted');
create or replace function public.get_my_subscription_details()
returns table (
  subscription_id uuid,
  tier_key text,
  status text,
  starts_at timestamptz,
  expires_at timestamptz,
  manager_user_id uuid,
  manager_name text,
  manager_email text,
  manager_phone text,
  manager_channel text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select subscription.id, subscription.tier_key, subscription.status,
    subscription.starts_at, subscription.expires_at,
    subscription.manager_user_id,
    nullif(trim(manager.display_name), ''),
    case when plan.manager_channel in ('email','phone') then manager_auth.email else null end,
    case when plan.manager_channel = 'phone' then manager.phone else null end,
    plan.manager_channel
  from public.account_subscriptions as subscription
  join public.tier_plans as plan on plan.tier_key = subscription.tier_key
  left join public.profiles as manager on manager.id = subscription.manager_user_id
  left join auth.users as manager_auth on manager_auth.id = subscription.manager_user_id
  where subscription.user_id = auth.uid() and subscription.status = 'active'
  order by subscription.starts_at desc nulls last
  limit 1;
$$;
revoke all on function public.get_my_subscription_details() from public;
grant execute on function public.get_my_subscription_details() to authenticated;
create or replace function public.activate_account_subscription_by_email(
  target_email text,
  target_tier text,
  duration_months integer,
  manager_user uuid default null,
  activation_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare target_user uuid;
begin
  if not public.can_staff('tiers') then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;
  select id into target_user from auth.users
  where lower(email) = lower(trim(target_email)) limit 1;
  if target_user is null then raise exception 'user_not_found'; end if;
  return public.activate_account_subscription(
    target_user, target_tier, duration_months, manager_user, activation_reason
  );
end;
$$;
revoke all on function public.activate_account_subscription_by_email(text,text,integer,uuid,text) from public;
grant execute on function public.activate_account_subscription_by_email(text,text,integer,uuid,text) to authenticated;
create or replace function public.approve_promotion_request(
  target_request uuid,
  duration_months integer,
  manager_user uuid default null,
  decision_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare request_row public.promotion_requests%rowtype;
declare result_id uuid;
begin
  if not public.can_staff('tiers') then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;
  select * into request_row from public.promotion_requests
  where id = target_request for update;
  if not found then raise exception 'promotion_request_not_found'; end if;
  if request_row.state not in ('pending','contacted') then
    raise exception 'promotion_request_already_decided';
  end if;
  result_id := public.activate_account_subscription(
    request_row.requester_id,
    request_row.requested_tier,
    coalesce(duration_months, request_row.duration_months),
    manager_user,
    decision_note
  );
  update public.promotion_requests set
    state = 'approved', subscription_id = result_id,
    payment_status = case when payment_status = 'unpaid' then 'pending' else payment_status end,
    admin_note = nullif(trim(decision_note), ''), handled_by = auth.uid(),
    handled_at = now()
  where id = target_request;
  return result_id;
end;
$$;
revoke all on function public.approve_promotion_request(uuid,integer,uuid,text) from public;
grant execute on function public.approve_promotion_request(uuid,integer,uuid,text) to authenticated;
create or replace function public.save_tier_plan(
  target_tier text,
  target_names jsonb,
  target_descriptions jsonb,
  target_benefits jsonb,
  target_active boolean,
  target_listing_limit integer,
  target_analytics_level text,
  target_manager_channel text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_staff('tiers') then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;
  update public.tier_plans set names = target_names,
    descriptions = target_descriptions, benefits = target_benefits,
    is_active = target_active, listing_limit = target_listing_limit,
    analytics_level = target_analytics_level,
    manager_channel = target_manager_channel,
    updated_by = auth.uid(), updated_at = now()
  where tier_key = target_tier;
  if not found then raise exception 'tier_plan_not_found'; end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'tier_plan_updated','tier_plan',target_tier,
    jsonb_build_object('active',target_active,'listing_limit',target_listing_limit,
      'analytics_level',target_analytics_level,'manager_channel',target_manager_channel));
end;
$$;
create or replace function public.save_payment_method_config(
  target_method text,
  target_names jsonb,
  target_enabled boolean,
  target_channel text,
  target_platform_scope text,
  target_requires_review boolean,
  target_settings jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_staff('tiers') then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;
  insert into public.payment_method_config(
    method_key,names,is_enabled,channel,platform_scope,
    requires_admin_review,settings,updated_by,updated_at
  ) values (
    target_method,target_names,target_enabled,target_channel,target_platform_scope,
    target_requires_review,target_settings,auth.uid(),now()
  ) on conflict (method_key) do update set names = excluded.names,
    is_enabled = excluded.is_enabled, channel = excluded.channel,
    platform_scope = excluded.platform_scope,
    requires_admin_review = excluded.requires_admin_review,
    settings = excluded.settings, updated_by = auth.uid(), updated_at = now();
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'payment_method_updated','payment_method',target_method,
    jsonb_build_object('enabled',target_enabled,'channel',target_channel,
      'platform_scope',target_platform_scope));
end;
$$;
revoke all on function public.save_tier_plan(text,jsonb,jsonb,jsonb,boolean,integer,text,text) from public;
revoke all on function public.save_payment_method_config(text,jsonb,boolean,text,text,boolean,jsonb) from public;
grant execute on function public.save_tier_plan(text,jsonb,jsonb,jsonb,boolean,integer,text,text) to authenticated;
grant execute on function public.save_payment_method_config(text,jsonb,boolean,text,text,boolean,jsonb) to authenticated;
commit;
