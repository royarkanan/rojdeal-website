-- RojDeal: einmal im Supabase SQL Editor ausführen.
-- Fügt die fehlenden Hauptstädte hinzu oder aktualisiert sie.

alter type public.listing_state add value if not exists 'hidden';
alter type public.listing_state add value if not exists 'rented';

alter table public.cities
  add column if not exists is_main_city boolean not null default false;

insert into public.regions (slug, names, sort_order)
values (
  'latakia',
  '{"ar":"اللاذقية","ku":"Lazqiyê","en":"Latakia","de":"Latakia"}',
  50
)
on conflict (slug) do update set
  names = excluded.names,
  is_active = true,
  sort_order = excluded.sort_order;

create index if not exists cities_main_idx
  on public.cities(is_main_city, is_active, sort_order, id);

insert into public.cities (
  region_id,
  slug,
  names,
  latitude,
  longitude,
  is_active,
  is_main_city,
  sort_order
)
select
  r.id,
  v.slug,
  v.names::jsonb,
  v.latitude,
  v.longitude,
  true,
  true,
  v.sort_order
from (
  values
    ('aleppo', 'kobani', '{"ar":"كوباني","ku":"Kobanî","en":"Kobani","de":"Kobani"}', 36.890000, 38.353500, 1),
    ('damascus', 'damascus', '{"ar":"دمشق","ku":"Şam","en":"Damascus","de":"Damaskus"}', 33.513800, 36.276500, 2),
    ('aleppo', 'aleppo-city', '{"ar":"حلب","ku":"Heleb","en":"Aleppo","de":"Aleppo"}', 36.202100, 37.134300, 3),
    ('hasakah', 'qamishli', '{"ar":"القامشلي","ku":"Qamişlo","en":"Qamishli","de":"Qamischli"}', 37.052100, 41.231400, 4),
    ('hasakah', 'hasakah-city', '{"ar":"الحسكة","ku":"Hesekê","en":"Hasakah","de":"Hasaka"}', 36.502400, 40.747700, 5),
    ('raqqa', 'raqqa-city', '{"ar":"الرقة","ku":"Reqayê","en":"Raqqa","de":"Raqqa"}', 35.959400, 39.006400, 6),
    ('aleppo', 'afrin', '{"ar":"عفرين","ku":"Efrîn","en":"Afrin","de":"Afrin"}', 36.512278, 36.865389, 7),
    ('hasakah', 'amuda', '{"ar":"عامودا","ku":"Amûdê","en":"Amuda","de":"Amuda"}', 37.104170, 40.930000, 8),
    ('aleppo', 'manbij', '{"ar":"منبج","ku":"Minbic","en":"Manbij","de":"Manbidsch"}', 36.528100, 37.954900, 9),
    ('aleppo', 'al-bab', '{"ar":"الباب","ku":"El-Bab","en":"Al-Bab","de":"Al-Bab"}', 36.370510, 37.515700, 10),
    ('raqqa', 'tabqa', '{"ar":"الطبقة","ku":"Tebqa","en":"Tabqa","de":"Tabqa"}', 35.837100, 38.548300, 11),
    ('latakia', 'latakia-city', '{"ar":"اللاذقية","ku":"Lazqiyê","en":"Latakia","de":"Latakia"}', 35.531700, 35.791500, 12)
) as v(region_slug, slug, names, latitude, longitude, sort_order)
join public.regions r on r.slug = v.region_slug
on conflict (slug) do update set
  region_id = excluded.region_id,
  names = excluded.names,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_active = true,
  is_main_city = true,
  sort_order = excluded.sort_order;

-- Frühere Schreibweise "amude" mit dem einheitlichen Datensatz "amuda"
-- zusammenführen, damit die Stadt nicht doppelt im Filter erscheint.
update public.listings
set city_id = (select id from public.cities where slug = 'amuda')
where city_id = (select id from public.cities where slug = 'amude')
  and exists (select 1 from public.cities where slug = 'amuda')
  and exists (select 1 from public.cities where slug = 'amude');

update public.cities
set is_active = false,
    is_main_city = false
where slug = 'amude';

-- Benutzer dürfen fehlende offizielle Städte sicher über eine RPC-Funktion
-- ergänzen. Direkte Schreibrechte auf public.cities bleiben gesperrt.
alter table public.cities
  add column if not exists created_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create index if not exists cities_created_by_idx
  on public.cities(created_by, created_at desc);

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

  -- RojDeal ist derzeit nur für Syrien aktiv.
  if p_latitude is null or p_longitude is null
     or p_latitude < 32 or p_latitude > 38.5
     or p_longitude < 35 or p_longitude > 42.5 then
    raise exception 'invalid_city_location' using errcode = 'P0001';
  end if;

  v_normalized := public.normalize_city_name(v_name);
  if v_normalized is null then
    v_normalized := 'city-' || substr(md5(lower(v_name)), 1, 12);
  end if;

  -- Gleicher Name oder ein Stadtpunkt im Umkreis von drei Kilometern:
  -- vorhandenen Datensatz verwenden statt eine Dublette anzulegen.
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

drop policy if exists "published listings read" on public.listings;
create policy "published listings read" on public.listings
for select using (
  state::text in ('published', 'reserved')
  or owner_id = auth.uid()
  or public.is_staff()
);

drop policy if exists "approved media read" on public.listing_media;
create policy "approved media read" on public.listing_media
for select using (
  (
    kind = 'image'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.state::text in ('published', 'reserved')
    )
  )
  or (
    review_status = 'approved'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.state::text in ('published', 'reserved')
    )
  )
  or owner_id = auth.uid()
  or public.is_staff()
);

-- Öffentliche Verkäufer- und Büroprofile.
-- Private Wohnadressen werden nicht gespeichert oder veröffentlicht.
alter table public.profiles
  add column if not exists account_type text not null default 'individual',
  add column if not exists business_name text,
  add column if not exists office_address text,
  add column if not exists office_latitude numeric(9,6),
  add column if not exists office_longitude numeric(9,6);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type in ('individual', 'agency'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_agency_details_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_agency_details_check
      check (
        account_type <> 'agency'
        or coalesce((
          char_length(trim(business_name)) between 2 and 80
          and char_length(trim(office_address)) between 5 and 200
          and office_latitude between 32 and 38.5
          and office_longitude between 35 and 42.5
        ), false)
      );
  end if;
end;
$$;

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

drop policy if exists "public active seller profiles read"
on public.profiles;

create policy "public active seller profiles read"
on public.profiles
for select
using (
  exists (
    select 1
    from public.listings l
    where l.owner_id = profiles.id
      and l.state::text in ('published', 'reserved')
  )
);

-- Verkäufer dürfen ihre Anzeige selbst weich löschen und später erneut
-- veröffentlichen. Nur "rejected" bleibt eine reine Moderationsentscheidung.
create or replace function public.protect_listing_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_staff() then
    new.owner_id = old.owner_id;
    new.is_featured = old.is_featured;
    if new.state is distinct from old.state
       and (
         new.state::text = 'rejected'
         or (old.state::text = 'rejected' and new.state::text <> 'removed')
       ) then
      raise exception 'Only staff can change rejected listings';
    end if;
  end if;
  return new;
end;
$$;

-- Käufer dürfen eine Unterhaltung zu allen öffentlich sichtbaren Anzeigen
-- beginnen. Reservierte Anzeigen bleiben öffentlich, daher muss Chat dort
-- ebenfalls möglich sein.
drop policy if exists "buyers start conversations"
on public.conversations;

create policy "buyers start conversations"
on public.conversations
for insert
to authenticated
with check (
  buyer_id = auth.uid()
  and exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.owner_id = seller_id
      and l.state::text in ('published', 'reserved')
  )
);

-- Alle bestehenden und neuen Chat-Teilnehmer können ihre Unterhaltungen
-- zuverlässig lesen, Nachrichten senden und empfangene Nachrichten als
-- gelesen markieren.
drop policy if exists "conversation participants read" on public.conversations;
create policy "conversation participants read" on public.conversations
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "participants update conversation" on public.conversations;
create policy "participants update conversation" on public.conversations
for update to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid())
with check (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "message participants read" on public.messages;
create policy "message participants read" on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "recipient marks read" on public.messages;
create policy "recipient marks read" on public.messages
for update to authenticated
using (
  sender_id <> auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
)
with check (
  sender_id <> auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

-- Verkaufte oder vermietete Anzeigen bleiben für frühere Chat-Teilnehmer
-- sichtbar. Beim Statuswechsel erscheint automatisch eine Systemnachricht,
-- statt dass die Unterhaltung oder Anzeige kommentarlos verschwindet.
alter table public.messages
  add column if not exists message_type text not null default 'user';

create or replace function public.protect_message_content()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.conversation_id = old.conversation_id;
  new.sender_id = old.sender_id;
  new.message_type = old.message_type;
  new.body = old.body;
  new.created_at = old.created_at;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_message_type_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_message_type_check
      check (message_type in ('user', 'listing_status'));
  end if;
end;
$$;

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

drop trigger if exists listings_notify_status_in_chat on public.listings;
create trigger listings_notify_status_in_chat
after update of state on public.listings
for each row execute function public.notify_listing_status_in_chat();

-- Jede neue Chatnachricht erzeugt zusätzlich eine persönliche
-- In-App-Benachrichtigung für den anderen Gesprächsteilnehmer.
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

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
after insert on public.messages
for each row execute function public.notify_message_recipient();

drop policy if exists "published listings read" on public.listings;
create policy "published listings read" on public.listings
for select using (
  state::text in ('published', 'reserved')
  or owner_id = auth.uid()
  or public.is_staff()
  or exists (
    select 1 from public.conversations c
    where c.listing_id = listings.id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "approved media read" on public.listing_media;
create policy "approved media read" on public.listing_media
for select using (
  (
    kind = 'image'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.state::text in ('published', 'reserved')
    )
  )
  or (
    review_status = 'approved'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.state::text in ('published', 'reserved')
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

-- Kontolöschung direkt aus der App. Die Funktion kann ausschließlich den
-- aktuell angemeldeten normalen Benutzer löschen. Mitarbeiterkonten müssen
-- aus Sicherheitsgründen durch einen Administrator entfernt werden.
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

-- Beide Chatteilnehmer dürfen den öffentlichen Namen des Gegenübers laden,
-- auch wenn die zugehörige Anzeige später verkauft oder vermietet wurde.
drop policy if exists "chat participants read profiles" on public.profiles;
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
