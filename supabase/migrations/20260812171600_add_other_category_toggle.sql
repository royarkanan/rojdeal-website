alter table public.platform_content
add column if not exists other_category_enabled boolean not null default false;
update public.platform_content
set other_category_enabled = false
where id = true;
