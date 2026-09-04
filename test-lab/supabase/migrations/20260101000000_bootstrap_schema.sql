-- RojDeal production schema
-- Run once in a new Supabase project's SQL editor.

create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.listing_category as enum ('property', 'vehicle');
create type public.listing_purpose as enum ('sale', 'rent');
create type public.listing_state as enum (
  'draft', 'published', 'hidden', 'reserved', 'sold', 'rented', 'removed', 'rejected'
);
create type public.media_kind as enum ('image', 'video');
create type public.review_state as enum ('approved', 'pending', 'rejected');
create type public.report_state as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  phone text,
  avatar_url text,
  account_type text not null default 'individual'
    check (account_type in ('individual', 'agency')),
  business_name text,
  office_address text,
  office_latitude numeric(9,6),
  office_longitude numeric(9,6),
  preferred_language text not null default 'ar'
    check (preferred_language in ('ar', 'ku', 'en', 'de')),
  role public.user_role not null default 'user',
  is_phone_verified boolean not null default false,
  is_identity_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_agency_details_check check (
    account_type <> 'agency'
    or coalesce((
      char_length(trim(business_name)) between 2 and 80
      and char_length(trim(office_address)) between 5 and 200
      and office_latitude between 32 and 38.5
      and office_longitude between 35 and 42.5
    ), false)
  )
);

create table public.regions (
  id bigint generated always as identity primary key,
  country_code text not null default 'SY',
  slug text not null unique,
  names jsonb not null,
  is_active boolean not null default true,
  is_main_city boolean not null default true,
  sort_order integer not null default 0
);

create table public.cities (
  id bigint generated always as identity primary key,
  region_id bigint references public.regions(id),
  slug text not null unique,
  names jsonb not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  is_main_city boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index cities_created_by_idx
  on public.cities(created_by, created_at desc);
create index cities_main_idx
  on public.cities(is_main_city, is_active, sort_order, id);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  city_id bigint not null references public.cities(id),
  category public.listing_category not null,
  purpose public.listing_purpose not null,
  state public.listing_state not null default 'published',
  title text not null check (char_length(title) between 8 and 120),
  description text not null check (char_length(description) between 20 and 5000),
  seller_name text not null check (char_length(seller_name) between 2 and 80),
  area_label text not null check (char_length(area_label) between 2 and 100),
  latitude numeric(9,6),
  longitude numeric(9,6),
  price numeric(16,2) not null check (price >= 0),
  currency text not null check (currency in ('USD', 'EUR', 'SYP')),
  contact_phone text not null,
  attributes jsonb not null default '{}'::jsonb,
  is_featured boolean not null default false,
  view_count bigint not null default 0,
  favorite_count bigint not null default 0,
  published_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind public.media_kind not null,
  storage_path text not null unique,
  thumbnail_path text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  duration_seconds integer check (
    (kind = 'image' and duration_seconds is null)
    or (kind = 'video' and duration_seconds between 1 and 300)
  ),
  width integer,
  height integer,
  sort_order smallint not null default 0 check (sort_order between 0 and 11),
  review_status public.review_state not null default 'approved',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_video_per_listing
  on public.listing_media(listing_id)
  where kind = 'video';
create index listing_media_listing_idx
  on public.listing_media(listing_id, sort_order);
create index listings_feed_idx
  on public.listings(city_id, state, category, published_at desc);
create index listings_owner_idx
  on public.listings(owner_id, created_at desc);
create index listings_price_idx on public.listings(price);

create table public.favorites (
  user_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique (listing_id, buyer_id, seller_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message_type text not null default 'user'
    check (message_type in ('user', 'listing_status')),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx
  on public.messages(conversation_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 100),
  details text check (char_length(details) <= 1000),
  state public.report_state not null default 'open',
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  filters jsonb not null,
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx
  on public.notifications(user_id, created_at desc);

create table public.moderation_log (
  id bigint generated always as identity primary key,
  moderator_id uuid not null references public.profiles(id),
  listing_id uuid references public.listings(id) on delete set null,
  media_id uuid references public.listing_media(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role = old.role;
    new.is_phone_verified = old.is_phone_verified;
    new.is_identity_verified = old.is_identity_verified;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();

create trigger listings_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create or replace function public.protect_listing_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    new.owner_id = old.owner_id;
    new.is_featured = old.is_featured;
    if new.state is distinct from old.state
       and (
         new.state = 'rejected'
         or (old.state = 'rejected' and new.state <> 'removed')
       ) then
      raise exception 'Only staff can change rejected listings';
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_protect_privileges
before update on public.listings
for each row execute function public.protect_listing_privileges();

create or replace function public.protect_conversation_participants()
returns trigger language plpgsql as $$
begin
  new.listing_id = old.listing_id;
  new.buyer_id = old.buyer_id;
  new.seller_id = old.seller_id;
  new.created_at = old.created_at;
  return new;
end;
$$;

create trigger conversations_protect_participants
before update on public.conversations
for each row execute function public.protect_conversation_participants();

create or replace function public.protect_message_content()
returns trigger language plpgsql as $$
begin
  new.conversation_id = old.conversation_id;
  new.sender_id = old.sender_id;
  new.message_type = old.message_type;
  new.body = old.body;
  new.created_at = old.created_at;
  return new;
end;
$$;

create trigger messages_protect_content
before update on public.messages
for each row execute function public.protect_message_content();

create or replace function public.notify_listing_status_in_chat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
begin
  if new.state is distinct from old.state
     and new.state::text in ('sold', 'rented') then
    insert into public.messages (
      conversation_id,
      sender_id,
      message_type,
      body,
      created_at
    )
    select
      c.id,
      new.owner_id,
      'listing_status',
      case
        when new.state::text = 'sold' then 'listing_sold'
        else 'listing_rented'
      end,
      v_now
    from public.conversations c
    where c.listing_id = new.id;

    update public.conversations
    set last_message_at = v_now
    where listing_id = new.id;
  end if;

  return new;
end;
$$;

create trigger listings_notify_status_in_chat
after update of state on public.listings
for each row execute function public.notify_listing_status_in_chat();

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient_id uuid;
  v_listing_id uuid;
begin
  select
    case
      when new.sender_id = c.buyer_id then c.seller_id
      else c.buyer_id
    end,
    c.listing_id
  into v_recipient_id, v_listing_id
  from public.conversations c
  where c.id = new.conversation_id;

  if v_recipient_id is not null then
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      payload
    )
    values (
      v_recipient_id,
      case
        when new.message_type = 'listing_status' then 'listing_status'
        else 'message'
      end,
      case
        when new.message_type = 'listing_status' then new.body
        else 'new_message'
      end,
      new.body,
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'listing_id', v_listing_id
      )
    );
  end if;

  return new;
end;
$$;

create trigger messages_notify_recipient
after insert on public.messages
for each row execute function public.notify_message_recipient();

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles
    where id = v_user_id and role in ('moderator', 'admin')
  ) then
    raise exception 'staff_account_requires_admin' using errcode = 'P0001';
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

create or replace function public.prepare_listing_media()
returns trigger language plpgsql as $$
begin
  if new.kind = 'video' then
    new.review_status = 'pending';
  else
    new.review_status = 'approved';
  end if;
  return new;
end;
$$;

create trigger listing_media_review_default
before insert on public.listing_media
for each row execute function public.prepare_listing_media();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    phone,
    account_type,
    business_name,
    office_address,
    office_latitude,
    office_longitude
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(split_part(new.email, '@', 1)), ''),
      'RojDeal'
    ),
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    case
      when new.raw_user_meta_data->>'account_type' = 'agency' then 'agency'
      else 'individual'
    end,
    nullif(trim(new.raw_user_meta_data->>'business_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'office_address'), ''),
    case
      when coalesce(new.raw_user_meta_data->>'office_latitude', '')
        ~ '^-?[0-9]+([.][0-9]+)?$'
      then (new.raw_user_meta_data->>'office_latitude')::numeric
      else null
    end,
    case
      when coalesce(new.raw_user_meta_data->>'office_longitude', '')
        ~ '^-?[0-9]+([.][0-9]+)?$'
      then (new.raw_user_meta_data->>'office_longitude')::numeric
      else null
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.normalize_city_name(value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    trim(
      both '-' from regexp_replace(
        lower(trim(coalesce(value, ''))),
        '[^[:alnum:]]+',
        '-',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.find_or_create_city(
  p_name text,
  p_latitude double precision,
  p_longitude double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_normalized text;
  v_slug text;
  v_region_id bigint;
  v_city public.cities%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'invalid_city_name' using errcode = 'P0001';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < 32 or p_latitude > 38.5
     or p_longitude < 35 or p_longitude > 42.5 then
    raise exception 'invalid_city_location' using errcode = 'P0001';
  end if;

  v_normalized := public.normalize_city_name(v_name);
  if v_normalized is null then
    v_normalized := 'city-' || substr(md5(lower(v_name)), 1, 12);
  end if;

  select c.*
  into v_city
  from public.cities c
  where c.is_active
    and (
      exists (
        select 1
        from jsonb_each_text(c.names) as translated(language_code, city_name)
        where public.normalize_city_name(translated.city_name) = v_normalized
      )
      or (
        c.is_main_city
        and
        c.latitude is not null
        and c.longitude is not null
        and 6371000 * 2 * asin(
          sqrt(
            least(
              1.0,
              power(sin(radians((c.latitude::double precision - p_latitude) / 2)), 2)
              + cos(radians(p_latitude))
              * cos(radians(c.latitude::double precision))
              * power(sin(radians((c.longitude::double precision - p_longitude) / 2)), 2)
            )
          )
        ) <= 3000
      )
    )
  order by
    case when exists (
      select 1
      from jsonb_each_text(c.names) as translated(language_code, city_name)
      where public.normalize_city_name(translated.city_name) = v_normalized
    ) then 0 else 1 end,
    c.sort_order,
    c.id
  limit 1;

  if found then
    update public.cities
    set is_main_city = true
    where id = v_city.id
    returning * into v_city;
    return to_jsonb(v_city);
  end if;

  if (
    select count(*)
    from public.cities
    where created_by = auth.uid()
      and created_at >= now() - interval '1 day'
  ) >= 25 then
    raise exception 'city_creation_limit' using errcode = 'P0001';
  end if;

  select c.region_id
  into v_region_id
  from public.cities c
  where c.is_active
    and c.region_id is not null
    and c.latitude is not null
    and c.longitude is not null
  order by
    power(c.latitude::double precision - p_latitude, 2)
    + power(c.longitude::double precision - p_longitude, 2)
  limit 1;

  v_slug := left(v_normalized, 60);
  if exists (select 1 from public.cities where slug = v_slug) then
    v_slug := left(v_slug, 51) || '-' || substr(
      md5(v_name || ':' || p_latitude::text || ':' || p_longitude::text),
      1,
      8
    );
  end if;

  insert into public.cities (
    region_id,
    slug,
    names,
    latitude,
    longitude,
    is_active,
    sort_order,
    created_by,
    is_main_city
  )
  values (
    v_region_id,
    v_slug,
    jsonb_build_object(
      'ar', v_name,
      'ku', v_name,
      'en', v_name,
      'de', v_name
    ),
    p_latitude,
    p_longitude,
    true,
    (
      select coalesce(max(sort_order), 0) + 1
      from public.cities
      where sort_order < 900
    ),
    auth.uid(),
    true
  )
  returning * into v_city;

  return to_jsonb(v_city);
end;
$$;

revoke all on function public.find_or_create_city(
  text,
  double precision,
  double precision
) from public;

grant execute on function public.find_or_create_city(
  text,
  double precision,
  double precision
) to authenticated;

alter table public.profiles enable row level security;
alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.listings enable row level security;
alter table public.listing_media enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.saved_searches enable row level security;
alter table public.notifications enable row level security;
alter table public.moderation_log enable row level security;

create policy "profile owner or staff read" on public.profiles
for select using (id = auth.uid() or public.is_staff());
create policy "public active seller profiles read" on public.profiles
for select using (
  exists (
    select 1
    from public.listings l
    where l.owner_id = profiles.id
      and l.state in ('published', 'reserved')
  )
);
create policy "chat participants read profiles" on public.profiles
for select to authenticated using (
  id = auth.uid()
  or public.is_staff()
  or exists (
    select 1
    from public.conversations c
    where
      (c.buyer_id = auth.uid() and c.seller_id = profiles.id)
      or
      (c.seller_id = auth.uid() and c.buyer_id = profiles.id)
  )
);
create policy "profile owner update" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "regions public read" on public.regions
for select using (is_active or public.is_staff());
create policy "cities public read" on public.cities
for select using (is_active or public.is_staff());
create policy "regions admin write" on public.regions
for all using (public.is_admin()) with check (public.is_admin());
create policy "cities admin write" on public.cities
for all using (public.is_admin()) with check (public.is_admin());

create policy "published listings read" on public.listings
for select using (
  state in ('published', 'reserved')
  or owner_id = auth.uid()
  or public.is_staff()
  or exists (
    select 1 from public.conversations c
    where c.listing_id = listings.id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);
create policy "owners create listings" on public.listings
for insert to authenticated
with check (owner_id = auth.uid());
create policy "owners update listings" on public.listings
for update to authenticated
using (owner_id = auth.uid() or public.is_staff())
with check (owner_id = auth.uid() or public.is_staff());
create policy "admins delete listings" on public.listings
for delete to authenticated
using (public.is_admin());

create policy "approved media read" on public.listing_media
for select using (
  (
    kind = 'image'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.state in ('published', 'reserved')
    )
  )
  or (
    review_status = 'approved'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.state in ('published', 'reserved')
    )
  )
  or owner_id = auth.uid()
  or public.is_staff()
  or exists (
    select 1 from public.conversations c
    where c.listing_id = listing_media.listing_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);
create policy "owners add media" on public.listing_media
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = auth.uid()
  )
);
create policy "staff review media" on public.listing_media
for update to authenticated
using (public.is_staff())
with check (public.is_staff());
create policy "owner or staff delete media" on public.listing_media
for delete to authenticated
using (owner_id = auth.uid() or public.is_staff());

create policy "own favorites" on public.favorites
for select using (user_id = auth.uid());
create policy "add own favorites" on public.favorites
for insert with check (user_id = auth.uid());
create policy "remove own favorites" on public.favorites
for delete using (user_id = auth.uid());

create policy "conversation participants read" on public.conversations
for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "buyers start conversations" on public.conversations
for insert with check (
  buyer_id = auth.uid()
  and exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.owner_id = seller_id
      and l.state::text in ('published', 'reserved')
  )
);
create policy "participants update conversation" on public.conversations
for update using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "message participants read" on public.messages
for select using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);
create policy "participants send messages" on public.messages
for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);
create policy "recipient marks read" on public.messages
for update using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

create policy "user creates report" on public.reports
for insert with check (reporter_id = auth.uid());
create policy "user or staff reads report" on public.reports
for select using (reporter_id = auth.uid() or public.is_staff());
create policy "staff handles report" on public.reports
for update using (public.is_staff()) with check (public.is_staff());

create policy "own saved searches" on public.saved_searches
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications read" on public.notifications
for select using (user_id = auth.uid());
create policy "own notifications update" on public.notifications
for update using (user_id = auth.uid());
create policy "staff creates notifications" on public.notifications
for insert with check (public.is_staff());
create policy "staff moderation log" on public.moderation_log
for select using (public.is_staff());
create policy "staff adds moderation log" on public.moderation_log
for insert with check (public.is_staff() and moderator_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'listing-images',
    'listing-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'listing-videos',
    'listing-videos',
    false,
    104857600,
    array['video/mp4', 'video/quicktime', 'video/webm']
  )
on conflict (id) do nothing;

create policy "public listing images" on storage.objects
for select using (bucket_id = 'listing-images');
create policy "users upload own images" on storage.objects
for insert to authenticated with check (
  bucket_id = 'listing-images'
  and split_part(name, '/', 1) = auth.uid()::text
);
create policy "users upload own videos" on storage.objects
for insert to authenticated with check (
  bucket_id = 'listing-videos'
  and split_part(name, '/', 1) = auth.uid()::text
);
create policy "owner or staff reads videos" on storage.objects
for select to authenticated using (
  bucket_id = 'listing-videos'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_staff()
    or exists (
      select 1
      from public.listing_media lm
      where lm.storage_path = name
        and lm.kind = 'video'
        and lm.review_status = 'approved'
    )
  )
);
create policy "owner or staff deletes media files" on storage.objects
for delete to authenticated using (
  bucket_id in ('listing-images', 'listing-videos')
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_staff()
  )
);

insert into public.regions (slug, names, sort_order) values
  ('aleppo', '{"ar":"حلب","ku":"Heleb","en":"Aleppo","de":"Aleppo"}', 10),
  ('damascus', '{"ar":"دمشق","ku":"Şam","en":"Damascus","de":"Damaskus"}', 20),
  ('hasakah', '{"ar":"الحسكة","ku":"Hesekê","en":"Hasakah","de":"Hasaka"}', 30),
  ('raqqa', '{"ar":"الرقة","ku":"Reqayê","en":"Raqqa","de":"Raqqa"}', 40),
  ('latakia', '{"ar":"اللاذقية","ku":"Lazqiyê","en":"Latakia","de":"Latakia"}', 50)
on conflict (slug) do nothing;

insert into public.cities (region_id, slug, names, latitude, longitude, sort_order)
select r.id, v.slug, v.names::jsonb, v.lat, v.lng, v.sort_order
from (
  values
    ('aleppo', 'kobani', '{"ar":"كوباني","ku":"Kobanî","en":"Kobani","de":"Kobani"}', 36.8900, 38.3535, 1),
    ('damascus', 'damascus', '{"ar":"دمشق","ku":"Şam","en":"Damascus","de":"Damaskus"}', 33.5138, 36.2765, 2),
    ('aleppo', 'aleppo-city', '{"ar":"حلب","ku":"Heleb","en":"Aleppo","de":"Aleppo"}', 36.2021, 37.1343, 3),
    ('hasakah', 'qamishli', '{"ar":"القامشلي","ku":"Qamişlo","en":"Qamishli","de":"Qamischli"}', 37.0521, 41.2314, 4),
    ('hasakah', 'hasakah-city', '{"ar":"الحسكة","ku":"Hesekê","en":"Hasakah","de":"Hasaka"}', 36.5024, 40.7477, 5),
    ('raqqa', 'raqqa-city', '{"ar":"الرقة","ku":"Reqayê","en":"Raqqa","de":"Raqqa"}', 35.9594, 39.0064, 6),
    ('latakia', 'latakia-city', '{"ar":"اللاذقية","ku":"Lazqiyê","en":"Latakia","de":"Latakia"}', 35.5317, 35.7915, 12),
    ('aleppo', 'afrin', '{"ar":"عفرين","ku":"Efrîn","en":"Afrin","de":"Afrin"}', 36.512278, 36.865389, 7),
    ('hasakah', 'amuda', '{"ar":"عامودا","ku":"Amûdê","en":"Amuda","de":"Amuda"}', 37.104170, 40.930000, 8),
    ('aleppo', 'manbij', '{"ar":"منبج","ku":"Minbic","en":"Manbij","de":"Manbidsch"}', 36.528100, 37.954900, 9),
    ('aleppo', 'al-bab', '{"ar":"الباب","ku":"El-Bab","en":"Al-Bab","de":"Al-Bab"}', 36.370510, 37.515700, 10),
    ('raqqa', 'tabqa', '{"ar":"الطبقة","ku":"Tebqa","en":"Tabqa","de":"Tabqa"}', 35.837100, 38.548300, 11)
) as v(region_slug, slug, names, lat, lng, sort_order)
join public.regions r on r.slug = v.region_slug
on conflict (slug) do nothing;
