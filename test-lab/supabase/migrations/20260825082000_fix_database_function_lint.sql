-- Fix production function errors reported by `supabase db lint --linked`.
-- Existing function signatures are preserved so grants and callers remain valid.

begin;

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
begin
  if event_name not in ('view', 'call', 'share', 'message') then
    raise exception 'invalid_listing_event';
  end if;

  if not exists (
    select 1
    from public.listings
    where id = target_listing
      and deleted_at is null
      and state::text in ('published', 'reserved')
  ) then
    return false;
  end if;

  key_value := case
    when auth.uid() is not null then 'u:' || auth.uid()::text
    when nullif(trim(anonymous_session), '') is not null then
      'a:' || encode(
        extensions.digest(trim(anonymous_session), 'sha256'::text),
        'hex'
      )
    else
      'a:' || encode(
        extensions.digest(
          coalesce(current_setting('request.headers', true), '') || current_date::text,
          'sha256'::text
        ),
        'hex'
      )
  end;

  insert into public.listing_events(
    listing_id,
    event_type,
    actor_key,
    metadata
  ) values (
    target_listing,
    event_name,
    key_value,
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

create or replace function public.record_ad_event(
  target_campaign uuid,
  target_creative uuid,
  target_placement text,
  event_name text,
  anonymous_session text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  key_value text;
  inserted boolean := false;
begin
  if event_name not in ('impression', 'click') then
    raise exception 'invalid_ad_event';
  end if;

  if not exists (
    select 1
    from public.ad_campaigns as campaign
    join public.ad_placements as placement
      on placement.placement_key = target_placement
    where campaign.id = target_campaign
      and placement.is_enabled
      and campaign.status in ('scheduled', 'active')
      and target_placement = any(campaign.placement_keys)
      and (campaign.start_at is null or campaign.start_at <= now())
      and (campaign.end_at is null or campaign.end_at > now())
  ) then
    return false;
  end if;

  key_value := case
    when auth.uid() is not null then 'u:' || auth.uid()::text
    when nullif(trim(anonymous_session), '') is not null then
      'a:' || encode(
        extensions.digest(trim(anonymous_session), 'sha256'::text),
        'hex'
      )
    else
      'a:' || encode(
        extensions.digest(
          coalesce(current_setting('request.headers', true), '') || current_date::text,
          'sha256'::text
        ),
        'hex'
      )
  end;

  insert into public.ad_events(
    campaign_id,
    creative_id,
    placement_key,
    event_type,
    actor_key
  ) values (
    target_campaign,
    target_creative,
    target_placement,
    event_name,
    key_value
  ) on conflict do nothing;

  inserted := found;
  return inserted;
end;
$$;

create or replace function public.cancel_own_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request uuid;
begin
  select request.id
  into target_request
  from public.account_deletion_requests as request
  where request.user_id = auth.uid()
    and request.state = 'pending'
    and request.execute_after > now()
  order by request.requested_at desc
  limit 1
  for update;

  if target_request is null then
    raise exception 'no_cancellable_deletion_request';
  end if;

  update public.listings as listing
  set state = snapshot.previous_state::public.listing_state,
      updated_at = now()
  from public.account_deletion_listing_states as snapshot
  where snapshot.request_id = target_request
    and snapshot.listing_id = listing.id
    and listing.state::text = 'hidden'
    and listing.deleted_at is null;

  update public.account_deletion_requests
  set state = 'cancelled',
      cancelled_at = now()
  where id = target_request;

  update public.profiles
  set account_deletion_pending = false,
      account_deletion_requested_at = null
  where id = auth.uid();
end;
$$;

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
  select
    log.id,
    log.actor_id,
    profile.display_name::text,
    coalesce(account.email::text, ''::text),
    log.action::text,
    log.target_type::text,
    log.target_id::text,
    log.details,
    log.created_at
  from public.admin_audit_log as log
  left join public.profiles as profile on profile.id = log.actor_id
  left join auth.users as account on account.id = log.actor_id
  where trim(coalesce(search_term, '')) = ''
    or log.action ilike '%' || trim(search_term) || '%'
    or log.target_type ilike '%' || trim(search_term) || '%'
    or coalesce(log.target_id, '') ilike '%' || trim(search_term) || '%'
    or coalesce(profile.display_name, '') ilike '%' || trim(search_term) || '%'
    or coalesce(account.email, '') ilike '%' || trim(search_term) || '%'
    or log.details::text ilike '%' || trim(search_term) || '%'
  order by log.created_at desc
  limit least(greatest(coalesce(page_limit, 200), 1), 500);
end;
$$;

create or replace function public.replace_home_platform_videos(items jsonb)
returns setof public.platform_media_items
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_id uuid;
  retained_ids uuid[] := array[]::uuid[];
  style jsonb;
begin
  if not public.can_staff('platform_content.manage') then
    raise exception 'platform_content_permission_required' using errcode = '42501';
  end if;

  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 20 then
    raise exception 'invalid_platform_video_list';
  end if;

  for item in select value from jsonb_array_elements(items)
  loop
    if char_length(trim(coalesce(item->>'media_url', ''))) not between 8 and 2000
       or jsonb_typeof(coalesce(item->'titles', '{}'::jsonb)) <> 'object' then
      raise exception 'invalid_platform_video';
    end if;

    style := coalesce(item->'display_style', '{}'::jsonb);
    item_id := nullif(item->>'id', '')::uuid;
    if item_id is null then
      item_id := gen_random_uuid();
    end if;
    retained_ids := array_append(retained_ids, item_id);

    insert into public.platform_media_items(
      id,
      placement_key,
      media_type,
      titles,
      media_url,
      is_active,
      start_at,
      end_at,
      sort_order,
      display_style,
      created_by,
      updated_by
    ) values (
      item_id,
      'home_carousel',
      'video',
      item->'titles',
      trim(item->>'media_url'),
      coalesce((item->>'is_active')::boolean, true),
      nullif(item->>'start_at', '')::timestamptz,
      nullif(item->>'end_at', '')::timestamptz,
      coalesce((item->>'sort_order')::integer, 1000),
      style,
      auth.uid(),
      auth.uid()
    ) on conflict (id) do update set
      titles = excluded.titles,
      media_url = excluded.media_url,
      is_active = excluded.is_active,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      sort_order = excluded.sort_order,
      display_style = excluded.display_style,
      updated_by = auth.uid(),
      updated_at = now()
    where public.platform_media_items.placement_key = 'home_carousel'
      and public.platform_media_items.media_type = 'video';
  end loop;

  delete from public.platform_media_items
  where placement_key = 'home_carousel'
    and media_type = 'video'
    and not (id = any(retained_ids));

  insert into public.admin_audit_log(
    actor_id,
    action,
    target_type,
    target_id,
    details
  ) values (
    auth.uid(),
    'platform_videos_replaced',
    'platform_media',
    'home_carousel',
    jsonb_build_object('count', cardinality(retained_ids))
  );

  return query
  select *
  from public.platform_media_items
  where placement_key = 'home_carousel'
    and media_type = 'video'
  order by sort_order, created_at;
end;
$$;

commit;
