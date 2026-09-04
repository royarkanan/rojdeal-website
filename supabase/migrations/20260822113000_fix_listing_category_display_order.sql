begin;
update public.listing_categories_config
set sort_order = case category_key
  when 'property' then 10
  when 'vehicle' then 20
  when 'other' then 10000
  else sort_order
end,
updated_at = now()
where category_key in ('property', 'vehicle', 'other');
commit;
