-- Enrich the owner's analytics rows so equal titles remain distinguishable and
-- the UI does not depend on an already-loaded local listing collection.
begin;

drop function if exists public.get_my_listing_metrics();

create function public.get_my_listing_metrics()
returns table (
  listing_id uuid,
  listing_title text,
  listing_area text,
  listing_state text,
  listing_created_at timestamptz,
  listing_image_path text,
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
    listing.title,
    listing.area_label,
    listing.state::text,
    listing.created_at,
    image.storage_path,
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
  left join lateral (
    select media.storage_path
    from public.listing_media as media
    where media.listing_id = listing.id
      and media.kind::text = 'image'
    order by media.sort_order, media.created_at
    limit 1
  ) as image on true
  left join public.listing_events as event on event.listing_id = listing.id
  where listing.owner_id = auth.uid()
  group by listing.id, image.storage_path, viewer.analytics_level
  order by listing.created_at desc;
$$;

revoke all on function public.get_my_listing_metrics() from public;
grant execute on function public.get_my_listing_metrics() to authenticated;

commit;
