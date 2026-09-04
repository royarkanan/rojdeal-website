begin;
update public.listing_categories_config
set names = coalesce(names, '{}'::jsonb) || jsonb_build_object(
  'ar', 'متنوعات',
  'ku', 'Cûrbecûr',
  'en', 'Miscellaneous',
  'de', 'Verschiedenes'
)
where category_key = 'other';
commit;
