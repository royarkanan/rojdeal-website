begin;

delete from public.listing_media as media
where media.kind = 'image'
  and (
    media.storage_path is null
    or btrim(media.storage_path) = ''
    or not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'listing-images'
        and object.name = media.storage_path
    )
  );

commit;
