-- Build 5: audited destructive actions, readable audit history, configurable
-- tier pricing and human-friendly manager assignment.

begin;
create or replace function public.admin_delete_listing(
  target_listing uuid,
  deletion_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare listing_owner uuid;
begin
  if not public.can_staff('listings') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if length(trim(coalesce(deletion_note, ''))) < 5 then
    raise exception 'deletion_reason_required';
  end if;

  select owner_id into listing_owner from public.listings
  where id = target_listing for update;
  if listing_owner is null then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log(
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(), 'listing_deleted_permanently', 'listing',
    target_listing::text,
    jsonb_build_object('owner_id', listing_owner, 'reason', trim(deletion_note))
  );
  delete from public.listings where id = target_listing;
end;
$$;
revoke all on function public.admin_delete_listing(uuid,text) from public;
grant execute on function public.admin_delete_listing(uuid,text) to authenticated;
drop policy if exists "staff reads audit log" on public.admin_audit_log;
create policy "staff with audit permission reads audit log"
on public.admin_audit_log for select to authenticated
using (
  public.is_platform_owner() or public.has_staff_permission('audit.read')
);
grant select on public.admin_audit_log to authenticated;
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
    'audit', public.has_staff_permission('audit.read') or public.is_platform_owner(),
    'platform_content', public.can_staff('platform_content.manage')
  );
$$;
revoke all on function public.get_my_staff_permissions() from public;
grant execute on function public.get_my_staff_permissions() to authenticated;
create or replace function public.list_admin_audit_log(
  search_term text default '',
  page_limit integer default 200
) returns table (
  id bigint,
  actor_id uuid,
  actor_name text,
  actor_email text,
  action text,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_owner()
     and not public.has_staff_permission('audit.read') then
    raise exception 'audit_read_permission_required' using errcode = '42501';
  end if;
  return query
  select log.id, log.actor_id, profile.display_name,
    coalesce(account.email, ''), log.action, log.target_type,
    log.target_id, log.details, log.created_at
  from public.admin_audit_log as log
  left join public.profiles as profile on profile.id = log.actor_id
  left join auth.users as account on account.id = log.actor_id
  where trim(search_term) = ''
    or log.action ilike '%' || trim(search_term) || '%'
    or log.target_type ilike '%' || trim(search_term) || '%'
    or coalesce(log.target_id, '') ilike '%' || trim(search_term) || '%'
    or coalesce(profile.display_name, '') ilike '%' || trim(search_term) || '%'
    or coalesce(account.email, '') ilike '%' || trim(search_term) || '%'
    or log.details::text ilike '%' || trim(search_term) || '%'
  order by log.created_at desc
  limit least(greatest(page_limit, 1), 500);
end;
$$;
revoke all on function public.list_admin_audit_log(text,integer) from public;
grant execute on function public.list_admin_audit_log(text,integer) to authenticated;
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
  if not public.can_staff('locations') then
    raise exception 'location_management_permission_required' using errcode = '42501';
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
create or replace function public.search_public_profiles(
  search_term text,
  result_limit integer default 20
) returns table (
  user_id uuid,
  display_name text,
  business_name text,
  avatar_url text,
  account_type text,
  relevance real
)
language sql
stable
security definer
set search_path = public
as $$
  with query as (
    select public.normalize_marketplace_search(search_term) as value
  ), candidates as (
    select profile.id,
      profile.display_name,
      profile.business_name,
      profile.avatar_url,
      profile.account_type::text,
      public.normalize_marketplace_search(concat_ws(
        ' ', profile.display_name, profile.business_name, profile.office_address
      )) as document
    from public.profiles as profile
    where not coalesce(profile.is_suspended, false)
      and not exists (
        select 1 from public.user_blocks as block
        where auth.uid() is not null
          and ((block.blocker_id = auth.uid() and block.blocked_id = profile.id)
            or (block.blocked_id = auth.uid() and block.blocker_id = profile.id))
      )
  )
  select candidate.id, candidate.display_name, candidate.business_name,
    candidate.avatar_url, candidate.account_type,
    greatest(
      similarity(candidate.document, query.value),
      case when candidate.document like '%' || query.value || '%' then 0.9 else 0 end
    )::real
  from candidates as candidate cross join query
  where query.value <> ''
    and (candidate.document like '%' || query.value || '%'
      or similarity(candidate.document, query.value) >= 0.2)
  order by 6 desc, candidate.display_name
  limit least(greatest(coalesce(result_limit, 20), 1), 50);
$$;
revoke all on function public.search_public_profiles(text,integer) from public;
grant execute on function public.search_public_profiles(text,integer)
to anon, authenticated;
alter table public.tier_plans
  add column if not exists pricing jsonb not null default '{}'::jsonb;
alter table public.tier_plans
  drop constraint if exists tier_plans_pricing_object;
alter table public.tier_plans
  add constraint tier_plans_pricing_object check (jsonb_typeof(pricing) = 'object');
create or replace function public.save_tier_plan_v2(
  target_tier text,
  target_names jsonb,
  target_descriptions jsonb,
  target_benefits jsonb,
  target_pricing jsonb,
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
  if jsonb_typeof(target_pricing) <> 'object' then
    raise exception 'pricing_must_be_an_object';
  end if;
  update public.tier_plans set
    names = target_names,
    descriptions = target_descriptions,
    benefits = target_benefits,
    pricing = target_pricing,
    is_active = target_active,
    listing_limit = target_listing_limit,
    analytics_level = target_analytics_level,
    manager_channel = target_manager_channel,
    updated_by = auth.uid(),
    updated_at = now()
  where tier_key = target_tier;
  if not found then raise exception 'tier_not_found'; end if;
  insert into public.admin_audit_log(
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(), 'tier_plan_updated', 'tier_plan', target_tier,
    jsonb_build_object('active', target_active, 'pricing', target_pricing)
  );
end;
$$;
revoke all on function public.save_tier_plan_v2(text,jsonb,jsonb,jsonb,jsonb,boolean,integer,text,text) from public;
grant execute on function public.save_tier_plan_v2(text,jsonb,jsonb,jsonb,jsonb,boolean,integer,text,text) to authenticated;
create or replace function public.activate_account_subscription_by_email_v2(
  target_email text,
  target_tier text,
  duration_months integer,
  target_manager_email text default null,
  activation_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare target_user uuid;
declare manager_user uuid;
begin
  if not public.can_staff('tiers') then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;
  if length(trim(coalesce(activation_reason, ''))) < 5 then
    raise exception 'activation_reason_required';
  end if;
  select id into target_user from auth.users
  where lower(email) = lower(trim(target_email)) limit 1;
  if target_user is null then raise exception 'user_not_found'; end if;

  if target_tier <> 'standard' and nullif(trim(target_manager_email), '') is not null then
    select account.id into manager_user from auth.users as account
    where lower(account.email) = lower(trim(target_manager_email))
      and (
        exists (select 1 from public.platform_owners owner_row
                where owner_row.user_id = account.id)
        or exists (
          select 1 from public.staff_assignments assignment
          where assignment.user_id = account.id and assignment.is_active
            and assignment.starts_at <= now()
            and (assignment.expires_at is null or assignment.expires_at > now())
        )
      )
    limit 1;
    if manager_user is null then raise exception 'manager_not_found_or_inactive'; end if;
  end if;

  return public.activate_account_subscription(
    target_user, target_tier, duration_months, manager_user, activation_reason
  );
end;
$$;
revoke all on function public.activate_account_subscription_by_email_v2(text,text,integer,text,text) from public;
grant execute on function public.activate_account_subscription_by_email_v2(text,text,integer,text,text) to authenticated;
create or replace function public.approve_promotion_request_v2(
  target_request uuid,
  duration_months integer,
  target_manager_email text default null,
  target_payment_status text default 'pending',
  decision_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare request_row public.promotion_requests%rowtype;
declare manager_user uuid;
declare result_id uuid;
begin
  if not public.can_staff('tiers') then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;
  if length(trim(coalesce(decision_note, ''))) < 5 then
    raise exception 'decision_note_required';
  end if;
  if target_payment_status not in ('unpaid','pending','paid','refunded','waived') then
    raise exception 'invalid_payment_status';
  end if;
  select * into request_row from public.promotion_requests
  where id = target_request for update;
  if not found then raise exception 'promotion_request_not_found'; end if;
  if request_row.state not in ('pending','contacted') then
    raise exception 'promotion_request_already_decided';
  end if;

  if nullif(trim(target_manager_email), '') is not null then
    select account.id into manager_user from auth.users as account
    where lower(account.email) = lower(trim(target_manager_email))
      and (
        exists (select 1 from public.platform_owners owner_row
                where owner_row.user_id = account.id)
        or exists (
          select 1 from public.staff_assignments assignment
          where assignment.user_id = account.id and assignment.is_active
            and assignment.starts_at <= now()
            and (assignment.expires_at is null or assignment.expires_at > now())
        )
      ) limit 1;
    if manager_user is null then raise exception 'manager_not_found_or_inactive'; end if;
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
    payment_status = target_payment_status,
    admin_note = trim(decision_note), handled_by = auth.uid(), handled_at = now()
  where id = target_request;
  return result_id;
end;
$$;
revoke all on function public.approve_promotion_request_v2(uuid,integer,text,text,text) from public;
grant execute on function public.approve_promotion_request_v2(uuid,integer,text,text,text) to authenticated;
commit;
