-- Enforce category media limits on the server, not only in Flutter.
begin;

create or replace function public.prepare_listing_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  policy text := 'review';
  listing_owner uuid;
  image_limit integer := 12;
  video_limit integer := 300;
  current_images integer := 0;
begin
  select listing.owner_id,
         coalesce(category.max_images, 12),
         coalesce(category.max_video_seconds, 300)
  into listing_owner, image_limit, video_limit
  from public.listings as listing
  left join public.listing_categories_config as category
    on category.id = listing.category_config_id
  where listing.id = new.listing_id;

  if listing_owner is null or listing_owner <> new.owner_id then
    raise exception 'listing_media_owner_mismatch' using errcode = '42501';
  end if;

  if new.kind::text = 'image' then
    select count(*) into current_images
    from public.listing_media as media
    where media.listing_id = new.listing_id
      and media.kind::text = 'image';
    if current_images >= image_limit then
      raise exception 'listing_image_limit_reached' using errcode = 'P0001';
    end if;
    new.review_status = 'approved'::public.review_state;
    new.reviewed_at = now();
    new.reviewed_by = null;
    return new;
  end if;

  if new.kind::text <> 'video' then
    new.review_status = 'approved'::public.review_state;
    new.reviewed_at = now();
    new.reviewed_by = null;
    return new;
  end if;

  if coalesce(new.duration_seconds, 0) > video_limit then
    raise exception 'listing_video_too_long' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.listing_media as media
    where media.listing_id = new.listing_id
      and media.kind::text = 'video'
  ) then
    raise exception 'only_one_listing_video_allowed' using errcode = 'P0001';
  end if;

  policy := public.effective_listing_video_policy_for_listing(
    new.listing_id, new.owner_id
  );
  if policy = 'hidden' then
    raise exception 'listing_video_disabled' using errcode = '42501';
  elsif policy = 'direct' then
    new.review_status = 'approved'::public.review_state;
    new.reviewed_at = now();
    new.reviewed_by = null;
  else
    new.review_status = 'pending'::public.review_state;
    new.reviewed_at = null;
    new.reviewed_by = null;
  end if;
  return new;
end;
$$;

commit;
