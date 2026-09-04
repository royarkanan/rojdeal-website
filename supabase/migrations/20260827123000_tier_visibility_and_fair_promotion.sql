begin;
alter table public.platform_content
  add column if not exists tier_upgrades_enabled boolean not null default true;
update public.platform_content
set tier_upgrades_enabled = true
where id = true and tier_upgrades_enabled is null;
drop policy if exists "active tier plans public read" on public.tier_plans;
create policy "active tier plans public read" on public.tier_plans
for select using (
  is_active
  or public.can_staff('tiers')
  or exists (
    select 1
    from public.account_subscriptions as subscription
    where subscription.user_id = auth.uid()
      and subscription.tier_key = tier_plans.tier_key
      and subscription.status = 'active'
      and (
        subscription.expires_at is null
        or subscription.expires_at > now()
      )
  )
);
create or replace function public.save_tier_upgrades_enabled(
  target_enabled boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.can_staff('tiers') or
    public.can_staff('platform_content.manage')
  ) then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;

  update public.platform_content
  set tier_upgrades_enabled = target_enabled,
      updated_by = auth.uid(),
      updated_at = now()
  where id = true;

  insert into public.admin_audit_log(
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(), 'tier_visibility_updated', 'platform_content', 'global',
    jsonb_build_object('enabled', target_enabled)
  );
end;
$$;
revoke all on function public.save_tier_upgrades_enabled(boolean) from public;
grant execute on function public.save_tier_upgrades_enabled(boolean)
  to authenticated;
create or replace function public.enforce_tier_upgrade_requests_enabled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(
    (select content.tier_upgrades_enabled
       from public.platform_content as content
      where content.id = true),
    false
  ) then
    raise exception 'tier_upgrades_disabled' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists promotion_requests_require_enabled_tiers
  on public.promotion_requests;
create trigger promotion_requests_require_enabled_tiers
before insert on public.promotion_requests
for each row execute function public.enforce_tier_upgrade_requests_enabled();
revoke all on function public.enforce_tier_upgrade_requests_enabled()
  from public;
alter table public.profiles
  add column if not exists promotion_location_node_ids bigint[]
  not null default '{}'::bigint[];
alter table public.profiles
  drop constraint if exists profiles_promotion_location_node_ids_limit;
alter table public.profiles
  add constraint profiles_promotion_location_node_ids_limit
  check (cardinality(promotion_location_node_ids) <= 20);
create index if not exists profiles_promotion_locations_gin_idx
  on public.profiles using gin(promotion_location_node_ids)
  where account_tier in ('pro', 'gold');
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    new.role = old.role;
    new.is_phone_verified = old.is_phone_verified;
    new.is_identity_verified = old.is_identity_verified;
    new.account_tier = old.account_tier;
    new.promotion_location_node_id = old.promotion_location_node_id;
    new.promotion_location_node_ids = old.promotion_location_node_ids;
  end if;
  if new.account_tier = 'standard' then
    new.promotion_location_node_id = null;
    new.promotion_location_node_ids = '{}'::bigint[];
  end if;
  return new;
end;
$$;
create or replace function public.sync_approved_tier_locations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state = 'approved' and (
    tg_op = 'INSERT' or old.state is distinct from new.state
  ) then
    update public.profiles
    set promotion_location_node_ids = coalesce(
          new.location_node_ids,
          '{}'::bigint[]
        ),
        promotion_location_node_id = new.location_node_ids[1]
    where id = new.requester_id
      and account_tier in ('pro', 'gold');
  end if;
  return new;
end;
$$;
drop trigger if exists promotion_requests_sync_approved_locations
  on public.promotion_requests;
create trigger promotion_requests_sync_approved_locations
after insert or update of state on public.promotion_requests
for each row execute function public.sync_approved_tier_locations();
revoke all on function public.sync_approved_tier_locations() from public;
with latest_approved as (
  select distinct on (request.requester_id)
    request.requester_id,
    request.location_node_ids
  from public.promotion_requests as request
  where request.state = 'approved'
  order by request.requester_id,
           request.handled_at desc nulls last,
           request.created_at desc
)
update public.profiles as profile
set promotion_location_node_ids = latest.location_node_ids,
    promotion_location_node_id = latest.location_node_ids[1]
from latest_approved as latest
where profile.id = latest.requester_id
  and profile.account_tier in ('pro', 'gold');
create or replace function public.expire_due_account_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare expired_count integer;
begin
  with expired as (
    update public.account_subscriptions
    set status = 'expired', updated_at = now()
    where status = 'active'
      and expires_at is not null
      and expires_at <= now()
    returning user_id
  ), affected as (
    select distinct user_id from expired
  )
  update public.profiles as profile
  set account_tier = 'standard',
      promotion_location_node_id = null,
      promotion_location_node_ids = '{}'::bigint[]
  from affected
  where profile.id = affected.user_id
    and not exists (
      select 1
      from public.account_subscriptions as active
      where active.user_id = profile.id
        and active.status = 'active'
        and (active.expires_at is null or active.expires_at > now())
    );

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;
revoke all on function public.expire_due_account_subscriptions() from public;
grant execute on function public.expire_due_account_subscriptions()
  to authenticated;
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
    case when plan.manager_channel in ('email','phone')
      then manager_auth.email else null end,
    case when plan.manager_channel = 'phone'
      then manager.phone else null end,
    plan.manager_channel
  from public.account_subscriptions as subscription
  join public.tier_plans as plan on plan.tier_key = subscription.tier_key
  left join public.profiles as manager
    on manager.id = subscription.manager_user_id
  left join auth.users as manager_auth
    on manager_auth.id = subscription.manager_user_id
  where subscription.user_id = auth.uid()
    and subscription.status = 'active'
    and (
      subscription.expires_at is null
      or subscription.expires_at > now()
    )
  order by subscription.starts_at desc nulls last
  limit 1;
$$;
revoke all on function public.get_my_subscription_details() from public;
grant execute on function public.get_my_subscription_details()
  to authenticated;
create or replace function public.record_listing_event(
  target_listing uuid,
  event_name text,
  anonymous_session text default null,
  event_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  key_value text;
  inserted boolean := false;
  listing_owner uuid;
begin
  if event_name not in ('view', 'call', 'share', 'message') then
    raise exception 'invalid_listing_event';
  end if;

  select listing.owner_id into listing_owner
  from public.listings as listing
  where listing.id = target_listing
    and listing.deleted_at is null
    and listing.state::text in ('published', 'reserved');
  if listing_owner is null then return false; end if;

  if event_name in ('call', 'share', 'message')
     and auth.uid() = listing_owner then
    return false;
  end if;

  key_value := case
    when auth.uid() is not null then 'u:' || auth.uid()::text
    when nullif(trim(anonymous_session), '') is not null
      then 'a:' || encode(
        digest(trim(anonymous_session), 'sha256'), 'hex'
      )
    else 'a:' || encode(
      digest(
        coalesce(current_setting('request.headers', true), '') ||
        current_date::text,
        'sha256'
      ),
      'hex'
    )
  end;

  insert into public.listing_events(
    listing_id, event_type, actor_key, metadata
  ) values (
    target_listing, event_name, key_value,
    coalesce(event_metadata, '{}'::jsonb)
  ) on conflict do nothing;
  inserted := found;

  if inserted and event_name = 'view' then
    update public.listings
    set view_count = view_count + 1
    where id = target_listing;
  end if;
  return inserted;
end;
$$;
revoke all on function public.record_listing_event(uuid, text, text, jsonb)
  from public;
grant execute on function public.record_listing_event(uuid, text, text, jsonb)
  to anon, authenticated;
create or replace function public.get_my_listing_metrics()
returns table (
  listing_id uuid,
  view_count bigint,
  favorite_count bigint,
  call_count bigint,
  share_count bigint,
  message_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer_plan as (
    select plan.analytics_level
    from public.profiles as profile
    join public.tier_plans as plan
      on plan.tier_key = profile.account_tier::text
    where profile.id = auth.uid()
      and profile.account_tier in ('pro', 'gold')
      and plan.analytics_level <> 'none'
  )
  select
    listing.id,
    listing.view_count,
    listing.favorite_count,
    case when viewer.analytics_level = 'advanced'
      then count(event.id) filter (where event.event_type = 'call')
      else 0
    end::bigint,
    case when viewer.analytics_level = 'advanced'
      then count(event.id) filter (where event.event_type = 'share')
      else 0
    end::bigint,
    case when viewer.analytics_level = 'advanced'
      then count(event.id) filter (where event.event_type = 'message')
      else 0
    end::bigint
  from public.listings as listing
  cross join viewer_plan as viewer
  left join public.listing_events as event on event.listing_id = listing.id
  where listing.owner_id = auth.uid()
  group by listing.id, viewer.analytics_level;
$$;
revoke all on function public.get_my_listing_metrics() from public;
grant execute on function public.get_my_listing_metrics() to authenticated;
commit;
