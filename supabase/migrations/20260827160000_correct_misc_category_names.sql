-- Keep the dynamic category label aligned with the bundled AR/KU wording.
begin;
update public.listing_categories_config
set names = coalesce(names, '{}'::jsonb) || jsonb_build_object(
  'ar', 'أغراض متنوعة',
  'ku', 'Tiştên cûrbecûr',
  'en', 'Miscellaneous',
  'de', 'Verschiedenes'
)
where category_key = 'other';
commit;
