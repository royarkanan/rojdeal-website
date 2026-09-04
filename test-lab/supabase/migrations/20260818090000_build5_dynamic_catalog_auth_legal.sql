-- RojDeal Build 5: dynamic catalog, non-secret auth switches, versioned legal
-- documents and legal-operator configuration.

begin;

-- -------------------------------------------------------------------------
-- Dynamic listing catalog. Legacy enum columns remain for backward
-- compatibility; new configurable keys are added alongside them.
-- -------------------------------------------------------------------------
create table if not exists public.listing_purpose_definitions (
  id uuid primary key default gen_random_uuid(),
  purpose_key text not null unique check (purpose_key ~ '^[a-z0-9_]{2,60}$'),
  names jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(names) = 'object')
);

create table if not exists public.listing_categories_config (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique check (category_key ~ '^[a-z0-9_]{2,60}$'),
  names jsonb not null default '{}'::jsonb,
  icon_key text not null default 'category',
  is_active boolean not null default true,
  is_system boolean not null default false,
  allowed_purpose_keys text[] not null default array['sale','rent'],
  video_policy text not null default 'inherit'
    check (video_policy in ('inherit', 'hidden', 'review', 'direct')),
  max_images integer not null default 12 check (max_images between 0 and 30),
  max_video_seconds integer not null default 300
    check (max_video_seconds between 1 and 1800),
  sort_order integer not null default 1000,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(names) = 'object'),
  check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.listing_category_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.listing_categories_config(id)
    on delete cascade,
  type_key text not null check (type_key ~ '^[a-z0-9_]{2,80}$'),
  names jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  video_policy text not null default 'inherit'
    check (video_policy in ('inherit', 'hidden', 'review', 'direct')),
  sort_order integer not null default 1000,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, type_key),
  check (jsonb_typeof(names) = 'object'),
  check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.category_field_definitions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.listing_categories_config(id)
    on delete cascade,
  category_type_id uuid references public.listing_category_types(id)
    on delete cascade,
  field_key text not null check (field_key ~ '^[a-z0-9_]{1,80}$'),
  labels jsonb not null default '{}'::jsonb,
  help_text jsonb not null default '{}'::jsonb,
  field_type text not null check (
    field_type in ('short_text','long_text','number','select','boolean','date','year')
  ),
  is_required boolean not null default false,
  is_filterable boolean not null default false,
  is_searchable boolean not null default true,
  validation jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(labels) = 'object'),
  check (jsonb_typeof(help_text) = 'object'),
  check (jsonb_typeof(validation) = 'object')
);

create unique index if not exists category_fields_scope_key_unique
on public.category_field_definitions(
  category_id, coalesce(category_type_id, '00000000-0000-0000-0000-000000000000'::uuid), field_key
);

create table if not exists public.category_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.category_field_definitions(id)
    on delete cascade,
  option_key text not null check (option_key ~ '^[a-z0-9_]{1,80}$'),
  labels jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  unique (field_id, option_key),
  check (jsonb_typeof(labels) = 'object')
);

insert into public.listing_purpose_definitions(
  purpose_key, names, is_active, sort_order
) values
  ('sale', '{"ar":"للبيع","ku":"Ji bo firotinê","en":"For sale","de":"Zu verkaufen"}', true, 10),
  ('rent', '{"ar":"للإيجار","ku":"Ji bo kirêkirinê","en":"For rent","de":"Zu vermieten"}', true, 20),
  ('wanted', '{"ar":"أبحث عن","ku":"Ez digerim","en":"Wanted","de":"Gesucht"}', true, 30)
on conflict (purpose_key) do update set
  names = excluded.names, sort_order = excluded.sort_order;

insert into public.listing_categories_config(
  category_key, names, icon_key, is_active, is_system,
  allowed_purpose_keys, sort_order
) values
  ('property', '{"ar":"العقارات","ku":"Emlak","en":"Real estate","de":"Immobilien"}',
   'apartment', true, true, array['sale','rent','wanted'], 10),
  ('vehicle', '{"ar":"السيارات والآليات","ku":"Erebe û Makîneyên","en":"Vehicles","de":"Fahrzeuge"}',
   'directions_car', true, true, array['sale','rent','wanted'], 20),
  ('other', '{"ar":"أخرى","ku":"Yên din","en":"Other","de":"Andere"}',
   'more_horiz', false, true, array['sale','rent','wanted'], 30)
on conflict (category_key) do update set
  names = excluded.names,
  icon_key = excluded.icon_key,
  is_system = true,
  allowed_purpose_keys = excluded.allowed_purpose_keys,
  sort_order = excluded.sort_order;

-- Respect the legacy Other switch when backfilling the dynamic catalog.
update public.listing_categories_config
set is_active = coalesce((
  select other_category_enabled from public.platform_content where id = true
), false)
where category_key = 'other';

alter table public.listings
  add column if not exists category_config_id uuid
    references public.listing_categories_config(id),
  add column if not exists category_type_id uuid
    references public.listing_category_types(id),
  add column if not exists category_key text,
  add column if not exists purpose_key text;

update public.listings as listing
set category_key = coalesce(listing.category_key, listing.category::text),
    purpose_key = coalesce(
      listing.purpose_key,
      case when listing.listing_direction = 'wanted' then 'wanted'
           else listing.purpose::text end
    ),
    category_config_id = coalesce(
      listing.category_config_id,
      (select category.id from public.listing_categories_config as category
       where category.category_key = listing.category::text)
    );

create index if not exists listings_dynamic_category_idx
on public.listings(category_config_id, category_type_id, purpose_key, state, published_at desc);

create table if not exists public.listing_field_values (
  listing_id uuid not null references public.listings(id) on delete cascade,
  field_id uuid not null references public.category_field_definitions(id)
    on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (listing_id, field_id),
  check (jsonb_typeof(value) in ('string','number','boolean','array','object'))
);

alter table public.listing_purpose_definitions enable row level security;
alter table public.listing_categories_config enable row level security;
alter table public.listing_category_types enable row level security;
alter table public.category_field_definitions enable row level security;
alter table public.category_field_options enable row level security;
alter table public.listing_field_values enable row level security;

drop policy if exists "active listing purposes public read" on public.listing_purpose_definitions;
create policy "active listing purposes public read" on public.listing_purpose_definitions
for select using (is_active or public.can_staff('listings'));

drop policy if exists "active listing categories public read" on public.listing_categories_config;
create policy "active listing categories public read" on public.listing_categories_config
for select using (is_active or public.can_staff('listings'));

drop policy if exists "active listing types public read" on public.listing_category_types;
create policy "active listing types public read" on public.listing_category_types
for select using (is_active or public.can_staff('listings'));

drop policy if exists "active category fields public read" on public.category_field_definitions;
create policy "active category fields public read" on public.category_field_definitions
for select using (is_active or public.can_staff('listings'));

drop policy if exists "active category options public read" on public.category_field_options;
create policy "active category options public read" on public.category_field_options
for select using (is_active or public.can_staff('listings'));

drop policy if exists "staff manages listing catalog purposes" on public.listing_purpose_definitions;
create policy "staff manages listing catalog purposes" on public.listing_purpose_definitions
for all to authenticated using (public.can_staff('listings')) with check (public.can_staff('listings'));

drop policy if exists "staff manages listing categories" on public.listing_categories_config;
create policy "staff manages listing categories" on public.listing_categories_config
for all to authenticated using (public.can_staff('listings')) with check (public.can_staff('listings'));

drop policy if exists "staff manages listing types" on public.listing_category_types;
create policy "staff manages listing types" on public.listing_category_types
for all to authenticated using (public.can_staff('listings')) with check (public.can_staff('listings'));

drop policy if exists "staff manages category fields" on public.category_field_definitions;
create policy "staff manages category fields" on public.category_field_definitions
for all to authenticated using (public.can_staff('listings')) with check (public.can_staff('listings'));

drop policy if exists "staff manages category options" on public.category_field_options;
create policy "staff manages category options" on public.category_field_options
for all to authenticated using (public.can_staff('listings')) with check (public.can_staff('listings'));

drop policy if exists "listing field values follow listing visibility" on public.listing_field_values;
create policy "listing field values follow listing visibility" on public.listing_field_values
for select using (
  exists (select 1 from public.listings where id = listing_id)
);

drop policy if exists "owners manage listing field values" on public.listing_field_values;
create policy "owners manage listing field values" on public.listing_field_values
for all to authenticated
using (
  exists (
    select 1 from public.listings
    where id = listing_id and (owner_id = auth.uid() or public.can_staff('listings'))
  )
)
with check (
  exists (
    select 1 from public.listings
    where id = listing_id and (owner_id = auth.uid() or public.can_staff('listings'))
  )
);

grant select on public.listing_purpose_definitions,
  public.listing_categories_config, public.listing_category_types,
  public.category_field_definitions, public.category_field_options
to anon, authenticated;
grant insert, update, delete on public.listing_purpose_definitions,
  public.listing_categories_config, public.listing_category_types,
  public.category_field_definitions, public.category_field_options,
  public.listing_field_values
to authenticated;
grant select on public.listing_field_values to anon, authenticated;

create or replace function public.validate_listing_dynamic_configuration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  category_row public.listing_categories_config%rowtype;
  missing_key text;
begin
  if new.category_config_id is null then
    select * into category_row from public.listing_categories_config
    where category_key = coalesce(new.category_key, new.category::text);
    new.category_config_id = category_row.id;
  else
    select * into category_row from public.listing_categories_config
    where id = new.category_config_id;
  end if;

  if category_row.id is null then raise exception 'invalid_listing_category'; end if;
  if not category_row.is_active and not public.can_staff('listings') then
    raise exception 'listing_category_disabled' using errcode = '42501';
  end if;
  new.category_key = category_row.category_key;
  new.purpose_key = coalesce(
    nullif(new.purpose_key, ''),
    case when new.listing_direction = 'wanted' then 'wanted' else new.purpose::text end
  );
  if not (new.purpose_key = any(category_row.allowed_purpose_keys)) then
    raise exception 'listing_purpose_not_available_for_category';
  end if;

  if new.state::text in ('published', 'reserved') then
    select field.field_key into missing_key
    from public.category_field_definitions as field
    where field.category_id = category_row.id
      and field.is_active and field.is_required
      and (field.category_type_id is null or field.category_type_id = new.category_type_id)
      and not (
        coalesce(new.attributes, '{}'::jsonb) ? field.field_key
        and nullif(trim(coalesce(new.attributes->>field.field_key, '')), '') is not null
      )
    order by field.sort_order, field.field_key
    limit 1;
    if missing_key is not null then
      raise exception 'required_dynamic_field_missing'
        using detail = missing_key, errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_validate_dynamic_configuration on public.listings;
create trigger listings_validate_dynamic_configuration
before insert or update of category, category_config_id, category_type_id,
  category_key, purpose, purpose_key, listing_direction, attributes, state
on public.listings
for each row execute function public.validate_listing_dynamic_configuration();

create or replace function public.effective_listing_video_policy_for_listing(
  target_listing uuid,
  target_user uuid
) returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(type.video_policy, 'inherit')
     from public.listings as listing
     join public.listing_category_types as type on type.id = listing.category_type_id
     where listing.id = target_listing),
    (select nullif(category.video_policy, 'inherit')
     from public.listings as listing
     join public.listing_categories_config as category
       on category.id = listing.category_config_id
     where listing.id = target_listing),
    public.effective_listing_video_policy(target_user)
  );
$$;

revoke all on function public.effective_listing_video_policy_for_listing(uuid, uuid)
from public;
grant execute on function public.effective_listing_video_policy_for_listing(uuid, uuid)
to anon, authenticated;

create or replace function public.prepare_listing_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare policy text := 'review';
begin
  if new.kind::text <> 'video' then
    new.review_status = 'approved'::public.review_state;
    new.reviewed_at = now();
    new.reviewed_by = null;
    return new;
  end if;
  policy := public.effective_listing_video_policy_for_listing(
    new.listing_id, new.owner_id
  );
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

-- -------------------------------------------------------------------------
-- Non-secret authentication switches. Credentials remain in Supabase/provider
-- secret configuration and never in these rows.
-- -------------------------------------------------------------------------
create table if not exists public.auth_provider_config (
  provider_key text primary key check (
    provider_key in ('email','google','apple','facebook','sms','whatsapp')
  ),
  is_enabled boolean not null default false,
  labels jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(labels) = 'object'),
  check (jsonb_typeof(settings) = 'object')
);

insert into public.auth_provider_config(provider_key, is_enabled, labels) values
  ('email', true, '{"ar":"البريد الإلكتروني","ku":"E-name","en":"Email","de":"E-Mail"}'),
  ('google', false, '{"ar":"Google","ku":"Google","en":"Google","de":"Google"}'),
  ('apple', false, '{"ar":"Apple","ku":"Apple","en":"Apple","de":"Apple"}'),
  ('facebook', false, '{"ar":"Facebook","ku":"Facebook","en":"Facebook","de":"Facebook"}'),
  ('sms', false, '{"ar":"رمز SMS","ku":"Koda SMS","en":"SMS code","de":"SMS-Code"}'),
  ('whatsapp', false, '{"ar":"رمز WhatsApp","ku":"Koda WhatsApp","en":"WhatsApp code","de":"WhatsApp-Code"}')
on conflict (provider_key) do update set labels = excluded.labels;

alter table public.auth_provider_config enable row level security;
drop policy if exists "auth provider config public read" on public.auth_provider_config;
create policy "auth provider config public read" on public.auth_provider_config
for select using (true);
drop policy if exists "admins manage auth provider config" on public.auth_provider_config;
create policy "admins manage auth provider config" on public.auth_provider_config
for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.auth_provider_config to anon, authenticated;
grant insert, update, delete on public.auth_provider_config to authenticated;

create or replace function public.my_auth_providers()
returns text[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(array_agg(distinct identity.provider), array[]::text[])
  from auth.identities as identity where identity.user_id = auth.uid();
$$;
revoke all on function public.my_auth_providers() from public;
grant execute on function public.my_auth_providers() to authenticated;

-- -------------------------------------------------------------------------
-- Versioned legal content and explicit acceptance records.
-- No fake legal text is seeded; production content must use real operator data.
-- -------------------------------------------------------------------------
create table if not exists public.legal_operator_settings (
  id boolean primary key default true check (id),
  legal_name text not null default '',
  business_name text not null default '',
  postal_address text not null default '',
  country_code text not null default 'DE',
  contact_email text not null default '',
  contact_phone text not null default '',
  responsible_person text not null default '',
  registration_details text not null default '',
  tax_details text not null default '',
  is_published boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.legal_operator_settings(id) values (true)
on conflict (id) do nothing;

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (
    document_type in (
      'privacy','terms','community_rules','account_deletion',
      'impressum','payment_terms','cookie_policy','ad_privacy'
    )
  ),
  version text not null check (char_length(trim(version)) between 1 and 40),
  language text not null check (language in ('ar','ku','en','de')),
  title text not null check (char_length(trim(title)) between 2 and 160),
  content text not null default '',
  public_url text not null default '',
  effective_at timestamptz not null,
  is_active boolean not null default false,
  requires_acceptance boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_type, version, language),
  check (content <> '' or public_url <> '')
);

create unique index if not exists legal_documents_one_active_language
on public.legal_documents(document_type, language)
where is_active;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  language text not null check (language in ('ar','ku','en','de')),
  accepted_at timestamptz not null default now(),
  source text not null default 'app'
    check (source in ('app','web','admin_import')),
  app_version text,
  document_id uuid references public.legal_documents(id) on delete restrict,
  unique (user_id, document_type, document_version)
);

alter table public.legal_operator_settings enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;

drop policy if exists "published legal operator public read" on public.legal_operator_settings;
create policy "published legal operator public read" on public.legal_operator_settings
for select using (is_published or public.is_admin());
drop policy if exists "owner manages legal operator" on public.legal_operator_settings;
create policy "owner manages legal operator" on public.legal_operator_settings
for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

drop policy if exists "active legal documents public read" on public.legal_documents;
create policy "active legal documents public read" on public.legal_documents
for select using (is_active or public.is_admin());
drop policy if exists "admins manage legal documents" on public.legal_documents;
create policy "admins manage legal documents" on public.legal_documents
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users read own legal acceptances" on public.legal_acceptances;
create policy "users read own legal acceptances" on public.legal_acceptances
for select to authenticated using (user_id = auth.uid() or public.is_admin());

grant select on public.legal_operator_settings, public.legal_documents
to anon, authenticated;
grant insert, update, delete on public.legal_operator_settings,
  public.legal_documents to authenticated;
grant select on public.legal_acceptances to authenticated;

create or replace function public.accept_legal_document(
  target_document uuid,
  acceptance_source text default 'app',
  client_app_version text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare document_row public.legal_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into document_row from public.legal_documents
  where id = target_document and is_active and effective_at <= now();
  if not found then raise exception 'active_legal_document_not_found'; end if;
  if acceptance_source not in ('app','web') then raise exception 'invalid_acceptance_source'; end if;
  insert into public.legal_acceptances(
    user_id, document_type, document_version, language,
    source, app_version, document_id
  ) values (
    auth.uid(), document_row.document_type, document_row.version,
    document_row.language, acceptance_source,
    nullif(trim(client_app_version), ''), document_row.id
  ) on conflict (user_id, document_type, document_version) do nothing;
end;
$$;
revoke all on function public.accept_legal_document(uuid, text, text) from public;
grant execute on function public.accept_legal_document(uuid, text, text)
to authenticated;

create or replace function public.my_missing_legal_acceptances(target_language text)
returns table (
  document_id uuid,
  document_type text,
  version text,
  language text,
  title text,
  content text,
  public_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select document.id, document.document_type, document.version,
    document.language, document.title, document.content, document.public_url
  from public.legal_documents as document
  where document.is_active
    and document.requires_acceptance
    and document.effective_at <= now()
    and document.language = case
      when target_language in ('ar','ku','en','de') then target_language else 'en' end
    and not exists (
      select 1 from public.legal_acceptances as acceptance
      where acceptance.user_id = auth.uid()
        and acceptance.document_type = document.document_type
        and acceptance.document_version = document.version
    );
$$;
revoke all on function public.my_missing_legal_acceptances(text) from public;
grant execute on function public.my_missing_legal_acceptances(text) to authenticated;

commit;
