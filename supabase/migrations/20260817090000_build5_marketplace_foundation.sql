-- RojDeal Build 5 (1.0.4+5)
-- Marketplace configuration, optional multi-market support, flexible prices,
-- wanted ads, contact privacy, video policy and recoverable listing lifecycle.

begin;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
-- -------------------------------------------------------------------------
-- Markets. Syria is the only active market at launch. Additional countries
-- stay as drafts until an owner/admin explicitly activates them.
-- -------------------------------------------------------------------------
create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,8}$'),
  names jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  default_currency text not null default 'USD',
  supported_currencies text[] not null default array['USD'],
  supported_languages text[] not null default array['ar', 'ku', 'en', 'de'],
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 1000,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(names) = 'object'),
  check (jsonb_typeof(settings) = 'object')
);
insert into public.markets (
  id, code, names, status, default_currency, supported_currencies,
  supported_languages, sort_order
) values
  ('00000000-0000-0000-0000-000000000760', 'SY',
   '{"ar":"سوريا","ku":"Sûriye","en":"Syria","de":"Syrien"}',
   'active', 'USD', array['USD','EUR','SYP'], array['ar','ku','en','de'], 10),
  ('00000000-0000-0000-0000-000000000368', 'IQ',
   '{"ar":"العراق","ku":"Iraq","en":"Iraq","de":"Irak"}',
   'draft', 'IQD', array['IQD','USD','EUR'], array['ar','ku','en','de'], 20),
  ('00000000-0000-0000-0000-000000000964', 'KRD',
   '{"ar":"كردستان","ku":"Kurdistan","en":"Kurdistan","de":"Kurdistan"}',
   'draft', 'IQD', array['IQD','USD','EUR'], array['ar','ku','en','de'], 30),
  ('00000000-0000-0000-0000-000000000422', 'LB',
   '{"ar":"لبنان","ku":"Lubnan","en":"Lebanon","de":"Libanon"}',
   'draft', 'USD', array['USD','EUR','LBP'], array['ar','ku','en','de'], 40),
  ('00000000-0000-0000-0000-000000000792', 'TR',
   '{"ar":"تركيا","ku":"Tirkiye","en":"Turkey","de":"Türkei"}',
   'draft', 'TRY', array['TRY','USD','EUR'], array['tr','ku','ar','en','de'], 50)
on conflict (code) do update set
  names = excluded.names,
  default_currency = excluded.default_currency,
  supported_currencies = excluded.supported_currencies,
  supported_languages = excluded.supported_languages,
  sort_order = excluded.sort_order;
alter table public.markets enable row level security;
drop policy if exists "active markets public read" on public.markets;
create policy "active markets public read" on public.markets
for select using (status = 'active' or public.can_staff('locations'));
drop policy if exists "location staff manages markets" on public.markets;
create policy "location staff manages markets" on public.markets
for all to authenticated
using (public.can_staff('locations'))
with check (public.can_staff('locations'));
grant select on public.markets to anon, authenticated;
grant insert, update, delete on public.markets to authenticated;
alter table public.profiles
  add column if not exists market_id uuid references public.markets(id)
    default '00000000-0000-0000-0000-000000000760',
  add column if not exists direct_call_enabled boolean not null default true,
  add column if not exists manager_contact_preference text not null default 'messages'
    check (manager_contact_preference in ('messages', 'email', 'phone'));
update public.profiles
set market_id = '00000000-0000-0000-0000-000000000760'
where market_id is null;
alter table public.location_nodes
  add column if not exists market_id uuid references public.markets(id)
    default '00000000-0000-0000-0000-000000000760';
update public.location_nodes
set market_id = '00000000-0000-0000-0000-000000000760'
where market_id is null;
alter table public.location_nodes drop constraint if exists location_nodes_kind_check;
alter table public.location_nodes
  add constraint location_nodes_kind_check
  check (kind in (
    'governorate', 'district', 'subdistrict', 'city', 'village', 'neighborhood'
  ));
create index if not exists location_nodes_market_parent_idx
on public.location_nodes(market_id, parent_id, kind, is_active, sort_order, id);
-- -------------------------------------------------------------------------
-- Flexible marketplace listing fields.
-- -------------------------------------------------------------------------
alter table public.listings
  add column if not exists market_id uuid references public.markets(id)
    default '00000000-0000-0000-0000-000000000760',
  add column if not exists listing_direction text not null default 'offer',
  add column if not exists price_type text not null default 'fixed',
  add column if not exists budget_min numeric(16,2),
  add column if not exists budget_max numeric(16,2),
  add column if not exists video_placement text not null default 'end',
  add column if not exists direct_call_override boolean,
  add column if not exists archived_at timestamptz,
  add column if not exists archive_delete_after timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id)
    on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists legal_hold_reason text,
  add column if not exists legal_hold_by uuid references public.profiles(id)
    on delete set null,
  add column if not exists legal_hold_at timestamptz;
update public.listings
set market_id = '00000000-0000-0000-0000-000000000760'
where market_id is null;
alter table public.listings
  alter column description drop not null,
  alter column description set default '',
  alter column area_label drop not null,
  alter column area_label set default '',
  alter column price drop not null,
  alter column contact_phone drop not null;
alter table public.listings drop constraint if exists listings_title_check;
alter table public.listings drop constraint if exists listings_description_check;
alter table public.listings drop constraint if exists listings_area_label_check;
alter table public.listings drop constraint if exists listings_price_check;
alter table public.listings drop constraint if exists listings_listing_direction_check;
alter table public.listings drop constraint if exists listings_price_type_check;
alter table public.listings drop constraint if exists listings_budget_check;
alter table public.listings drop constraint if exists listings_video_placement_check;
alter table public.listings
  add constraint listings_title_check
    check (char_length(trim(title)) between 5 and 120),
  add constraint listings_description_check
    check (char_length(coalesce(description, '')) <= 5000),
  add constraint listings_area_label_check
    check (char_length(coalesce(area_label, '')) <= 100),
  add constraint listings_listing_direction_check
    check (listing_direction in ('offer', 'wanted')),
  add constraint listings_price_type_check
    check (price_type in ('fixed', 'negotiable', 'contact', 'offers', 'free')),
  add constraint listings_budget_check check (
    budget_min is null or budget_min >= 0
  ) not valid,
  add constraint listings_budget_max_check check (
    budget_max is null or budget_max >= 0
  ) not valid,
  add constraint listings_budget_order_check check (
    budget_min is null or budget_max is null or budget_max >= budget_min
  ) not valid,
  add constraint listings_price_value_check check (
    price is null or price >= 0
  ) not valid,
  add constraint listings_video_placement_check
    check (video_placement in ('start', 'end'));
create index if not exists listings_market_feed_idx
on public.listings(market_id, state, listing_direction, category, published_at desc);
create index if not exists listings_archive_cleanup_idx
on public.listings(archive_delete_after)
where archived_at is not null and legal_hold = false;
alter table public.listing_media
  add column if not exists upload_state text not null default 'complete',
  add column if not exists upload_session_id text,
  add column if not exists original_filename text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id)
    on delete set null,
  add column if not exists deletion_reason text;
alter table public.listing_media
  drop constraint if exists listing_media_upload_state_check;
alter table public.listing_media
  add constraint listing_media_upload_state_check
  check (upload_state in ('queued', 'uploading', 'paused', 'complete', 'failed', 'cancelled'));
-- -------------------------------------------------------------------------
-- Remote configuration. Nothing forces Build 4 off until the owner enables
-- force_update_enabled and raises minimum_supported_build.
-- -------------------------------------------------------------------------
alter table public.platform_content
  add column if not exists listing_video_policy text not null default 'review',
  add column if not exists wanted_listings_enabled boolean not null default true,
  add column if not exists multi_market_enabled boolean not null default false,
  add column if not exists default_market_code text not null default 'SY',
  add column if not exists default_direct_call_enabled boolean not null default true,
  add column if not exists listing_archive_days integer not null default 60,
  add column if not exists message_delete_window_minutes integer not null default 1440,
  add column if not exists chat_attachment_max_bytes bigint not null default 26214400,
  add column if not exists listing_video_max_bytes bigint not null default 157286400,
  add column if not exists video_title_style jsonb not null default
    '{"placement":"above","theme":"brand","animation":"static","size":"medium"}'::jsonb,
  add column if not exists feature_flags jsonb not null default '{}'::jsonb,
  add column if not exists contact_options jsonb not null default
    '{"directCall":true,"messages":true,"email":true}'::jsonb,
  add column if not exists config_revision bigint not null default 1;
update public.platform_content
set listing_video_policy = case
  when listing_video_review_required then 'review'
  else 'direct'
end
where listing_video_policy = 'review'
  and listing_video_review_required = false;
alter table public.platform_content
  drop constraint if exists platform_content_listing_video_policy_check;
alter table public.platform_content
  drop constraint if exists platform_content_listing_archive_days_check;
alter table public.platform_content
  drop constraint if exists platform_content_message_delete_window_check;
alter table public.platform_content
  drop constraint if exists platform_content_chat_attachment_size_check;
alter table public.platform_content
  drop constraint if exists platform_content_listing_video_size_check;
alter table public.platform_content
  drop constraint if exists platform_content_build5_json_check;
alter table public.platform_content
  add constraint platform_content_listing_video_policy_check
    check (listing_video_policy in ('hidden', 'review', 'direct')),
  add constraint platform_content_listing_archive_days_check
    check (listing_archive_days between 1 and 365),
  add constraint platform_content_message_delete_window_check
    check (message_delete_window_minutes between 0 and 43200),
  add constraint platform_content_chat_attachment_size_check
    check (chat_attachment_max_bytes between 1048576 and 104857600),
  add constraint platform_content_listing_video_size_check
    check (listing_video_max_bytes between 10485760 and 1073741824),
  add constraint platform_content_build5_json_check check (
    jsonb_typeof(video_title_style) = 'object'
    and jsonb_typeof(feature_flags) = 'object'
    and jsonb_typeof(contact_options) = 'object'
  );
-- Per-tier and per-user switches override a global option without publishing
-- a new client version.
create table if not exists public.tier_feature_overrides (
  tier text not null check (tier in ('standard', 'pro', 'gold')),
  feature_key text not null check (feature_key ~ '^[a-z0-9_]{2,80}$'),
  enabled boolean,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tier, feature_key),
  check (jsonb_typeof(value) = 'object')
);
create table if not exists public.user_feature_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z0-9_]{2,80}$'),
  enabled boolean,
  value jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key),
  check (jsonb_typeof(value) = 'object')
);
alter table public.tier_feature_overrides enable row level security;
alter table public.user_feature_overrides enable row level security;
drop policy if exists "public reads tier features" on public.tier_feature_overrides;
create policy "public reads tier features" on public.tier_feature_overrides
for select using (true);
drop policy if exists "users read own feature overrides" on public.user_feature_overrides;
create policy "users read own feature overrides" on public.user_feature_overrides
for select to authenticated
using (user_id = auth.uid() or public.can_staff('users'));
drop policy if exists "admins manage tier features" on public.tier_feature_overrides;
create policy "admins manage tier features" on public.tier_feature_overrides
for all to authenticated
using (public.can_staff('users')) with check (public.can_staff('users'));
drop policy if exists "admins manage user features" on public.user_feature_overrides;
create policy "admins manage user features" on public.user_feature_overrides
for all to authenticated
using (public.can_staff('users')) with check (public.can_staff('users'));
grant select on public.tier_feature_overrides to anon, authenticated;
grant select, insert, update, delete on public.user_feature_overrides to authenticated;
grant insert, update, delete on public.tier_feature_overrides to authenticated;
create or replace function public.effective_listing_video_policy(target_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with profile_tier as (
    select coalesce(account_tier, 'standard') as tier
    from public.profiles where id = target_user
  ), user_value as (
    select nullif(value->>'policy', '') as policy
    from public.user_feature_overrides
    where user_id = target_user
      and feature_key = 'listing_video'
      and (expires_at is null or expires_at > now())
      and coalesce(enabled, true)
  ), tier_value as (
    select nullif(setting.value->>'policy', '') as policy
    from public.tier_feature_overrides as setting
    join profile_tier on profile_tier.tier = setting.tier
    where setting.feature_key = 'listing_video'
      and coalesce(setting.enabled, true)
  )
  select coalesce(
    (select policy from user_value),
    (select policy from tier_value),
    (select listing_video_policy from public.platform_content where id = true),
    'review'
  );
$$;
revoke all on function public.effective_listing_video_policy(uuid) from public;
grant execute on function public.effective_listing_video_policy(uuid)
to anon, authenticated;
create or replace function public.prepare_listing_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  policy text := 'review';
begin
  if new.kind::text <> 'video' then
    new.review_status = 'approved'::public.review_state;
    new.reviewed_at = now();
    new.reviewed_by = null;
    return new;
  end if;

  policy := public.effective_listing_video_policy(new.owner_id);
  if policy = 'hidden' then
    raise exception 'listing_video_disabled' using errcode = '42501';
  elsif policy = 'direct' then
    new.review_status = 'approved'::public.review_state;
    new.reviewed_at = now();
    new.reviewed_by = null;
  else
    new.review_status = 'pending'::public.review_state;
    new.reviewed_at = null;
    new.reviewed_by = null;
  end if;

  return new;
end;
$$;
create or replace function public.bump_platform_config_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.config_revision = greatest(coalesce(old.config_revision, 0) + 1, 1);
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists platform_content_bump_revision on public.platform_content;
create trigger platform_content_bump_revision
before update on public.platform_content
for each row execute function public.bump_platform_config_revision();
commit;
