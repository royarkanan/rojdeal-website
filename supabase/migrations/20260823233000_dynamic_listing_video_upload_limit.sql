begin;
update public.listing_categories_config
set settings =
  coalesce(settings, '{}'::jsonb)
  || jsonb_build_object(
    'video_compression',
    coalesce(settings -> 'video_compression', '{}'::jsonb)
    || jsonb_build_object(
      'max_upload_bytes', 50331648,
      'max_source_bytes', 1073741824
    )
  ),
  updated_at = now()
where is_active = true;
commit;
