-- Only safe, tested listing-card templates are configurable.
begin;

alter table public.platform_content
  add column if not exists listing_grid_columns integer not null default 2;

alter table public.platform_content
  drop constraint if exists platform_content_listing_grid_columns_check;
alter table public.platform_content
  add constraint platform_content_listing_grid_columns_check
  check (listing_grid_columns in (1, 2));

commit;
