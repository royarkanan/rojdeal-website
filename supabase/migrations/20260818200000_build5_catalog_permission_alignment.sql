begin;
drop policy if exists "staff manages listing catalog purposes" on public.listing_purpose_definitions;
create policy "staff manages listing catalog purposes" on public.listing_purpose_definitions
for all to authenticated using (public.can_staff('catalog')) with check (public.can_staff('catalog'));
drop policy if exists "staff manages listing categories" on public.listing_categories_config;
create policy "staff manages listing categories" on public.listing_categories_config
for all to authenticated using (public.can_staff('catalog')) with check (public.can_staff('catalog'));
drop policy if exists "staff manages listing types" on public.listing_category_types;
create policy "staff manages listing types" on public.listing_category_types
for all to authenticated using (public.can_staff('catalog')) with check (public.can_staff('catalog'));
drop policy if exists "staff manages category fields" on public.category_field_definitions;
create policy "staff manages category fields" on public.category_field_definitions
for all to authenticated using (public.can_staff('catalog')) with check (public.can_staff('catalog'));
drop policy if exists "staff manages category options" on public.category_field_options;
create policy "staff manages category options" on public.category_field_options
for all to authenticated using (public.can_staff('catalog')) with check (public.can_staff('catalog'));
-- Catalog staff can inspect disabled items, while the public only sees active items.
drop policy if exists "active listing purposes public read" on public.listing_purpose_definitions;
create policy "active listing purposes public read" on public.listing_purpose_definitions
for select using (is_active or public.can_staff('catalog'));
drop policy if exists "active listing categories public read" on public.listing_categories_config;
create policy "active listing categories public read" on public.listing_categories_config
for select using (is_active or public.can_staff('catalog'));
drop policy if exists "active listing types public read" on public.listing_category_types;
create policy "active listing types public read" on public.listing_category_types
for select using (is_active or public.can_staff('catalog'));
drop policy if exists "active category fields public read" on public.category_field_definitions;
create policy "active category fields public read" on public.category_field_definitions
for select using (is_active or public.can_staff('catalog'));
drop policy if exists "active category options public read" on public.category_field_options;
create policy "active category options public read" on public.category_field_options
for select using (is_active or public.can_staff('catalog'));
commit;
