begin;
create or replace function public.delete_own_listing(
  target_listing uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  listing_owner_id uuid;
  image_paths jsonb := '[]'::jsonb;
  video_paths jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select owner_id
  into listing_owner_id
  from public.listings
  where id = target_listing
  for update;

  if not found or listing_owner_id <> current_user_id then
    raise exception 'listing_owner_required' using errcode = '42501';
  end if;

  select
    coalesce(
      jsonb_agg(storage_path)
        filter (
          where kind::text <> 'video'
            and nullif(trim(storage_path), '') is not null
        ),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(storage_path)
        filter (
          where kind::text = 'video'
            and nullif(trim(storage_path), '') is not null
        ),
      '[]'::jsonb
    )
  into image_paths, video_paths
  from public.listing_media
  where listing_id = target_listing
    and owner_id = current_user_id;

  delete from public.listing_media
  where listing_id = target_listing
    and owner_id = current_user_id;

  update public.listings
  set state = 'removed',
      updated_at = now()
  where id = target_listing
    and owner_id = current_user_id;

  return jsonb_build_object(
    'images', image_paths,
    'videos', video_paths
  );
end;
$$;
revoke all on function public.delete_own_listing(uuid) from public;
grant execute on function public.delete_own_listing(uuid) to authenticated;
commit;
