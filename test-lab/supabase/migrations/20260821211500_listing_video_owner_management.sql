begin;

create or replace function public.replace_own_listing_video(
  target_listing uuid,
  new_storage_path text default null,
  new_mime_type text default null,
  new_size_bytes bigint default null,
  new_duration_seconds integer default null
)
returns table (
  old_storage_path text,
  media_review_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  previous_storage_path text;
  saved_review_status text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.listings
    where id = target_listing
      and owner_id = current_user_id
  ) then
    raise exception 'listing_owner_required' using errcode = '42501';
  end if;

  select storage_path
  into previous_storage_path
  from public.listing_media
  where listing_id = target_listing
    and owner_id = current_user_id
    and kind::text = 'video'
  limit 1
  for update;

  delete from public.listing_media
  where listing_id = target_listing
    and owner_id = current_user_id
    and kind::text = 'video';

  if nullif(trim(coalesce(new_storage_path, '')), '') is not null then
    insert into public.listing_media (
      listing_id,
      owner_id,
      kind,
      storage_path,
      mime_type,
      size_bytes,
      duration_seconds
    )
    values (
      target_listing,
      current_user_id,
      'video',
      trim(new_storage_path),
      coalesce(nullif(trim(new_mime_type), ''), 'video/mp4'),
      greatest(coalesce(new_size_bytes, 0), 0),
      new_duration_seconds
    )
    returning review_status::text into saved_review_status;
  end if;

  return query
  select previous_storage_path, saved_review_status;
end;
$$;

revoke all on function public.replace_own_listing_video(
  uuid, text, text, bigint, integer
) from public;

grant execute on function public.replace_own_listing_video(
  uuid, text, text, bigint, integer
) to authenticated;

commit;
