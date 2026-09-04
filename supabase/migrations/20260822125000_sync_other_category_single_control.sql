begin;
update public.platform_content as content
set other_category_enabled = category.is_active,
    updated_at = now()
from public.listing_categories_config as category
where content.id = true
  and category.category_key = 'other';
commit;
