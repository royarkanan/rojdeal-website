-- RojDeal multilingual ranked marketplace search.
-- Keeps search inside Postgres/Supabase and remains compatible with existing
-- clients because the RPC name and return columns do not change.

begin;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create or replace function public.normalize_marketplace_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(regexp_replace(
    translate(
      regexp_replace(
        lower(public.unaccent(coalesce(value, ''))),
        '[ًٌٍَُِّْـ]', '', 'g'
      ),
      'أإآٱؤئىة',
      'ااااوييه'
    ),
    '[^[:alnum:]ء-ي]+', ' ', 'g'
  ));
$$;
create table if not exists public.marketplace_search_aliases (
  concept_key text not null,
  alias_term text not null,
  language_code text not null default 'und',
  created_at timestamptz not null default now(),
  primary key (concept_key, alias_term),
  check (concept_key ~ '^[a-z0-9_]{2,60}$'),
  check (alias_term = public.normalize_marketplace_search(alias_term)),
  check (length(alias_term) between 1 and 100)
);
alter table public.marketplace_search_aliases enable row level security;
drop policy if exists "public reads marketplace search aliases"
on public.marketplace_search_aliases;
create policy "public reads marketplace search aliases"
on public.marketplace_search_aliases for select
to anon, authenticated
using (true);
grant select on public.marketplace_search_aliases to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
on public.marketplace_search_aliases from anon, authenticated;
with seeds(concept_key, language_code, aliases) as (
  values
    ('vehicle', 'ar', array[
      'سيارة','سيارات','سياره','مركبة','مركبات','آلية','آليات','اليات'
    ]::text[]),
    ('vehicle', 'ku', array[
      'erebe','erebeyan','wesayît','wesayit','wesayîtan'
    ]::text[]),
    ('vehicle', 'en', array[
      'car','cars','auto','autos','automobile','vehicle','vehicles'
    ]::text[]),
    ('vehicle', 'de', array[
      'auto','autos','fahrzeug','fahrzeuge','pkw'
    ]::text[]),
    ('machinery', 'ar', array[
      'آلة','آلات','آلية','آليات','اليات','معدات','مكنة','مكنات','جرار','جرارات'
    ]::text[]),
    ('machinery', 'ku', array[
      'makîne','makine','makîneyan','alav','traktor'
    ]::text[]),
    ('machinery', 'en', array[
      'machine','machines','machinery','equipment','tractor','tractors'
    ]::text[]),
    ('machinery', 'de', array[
      'maschine','maschinen','gerät','geräte','traktor','traktoren'
    ]::text[]),
    ('property', 'ar', array[
      'عقار','عقارات','منزل','منازل','بيت','بيوت','شقة','شقق','أرض','ارض',
      'أراضي','اراضي','فيلا','فلل','محل','مكتب','مزرعة','مزارع'
    ]::text[]),
    ('property', 'ku', array[
      'emlak','xanî','xani','mal','avahî','avahi','erd','apartman'
    ]::text[]),
    ('property', 'en', array[
      'property','properties','real','estate','apartment','apartments','house',
      'houses','home','homes','land','villa','farm','office','shop'
    ]::text[]),
    ('property', 'de', array[
      'immobilie','immobilien','wohnung','wohnungen','haus','häuser','grundstück',
      'villa','büro','laden','bauernhof'
    ]::text[]),
    ('miscellaneous', 'ar', array[
      'أغراض','اغراض','متنوعة','منوعات','أشياء','اشياء','أخرى','اخرى'
    ]::text[]),
    ('miscellaneous', 'ku', array[
      'tişt','tiştên','tisht','tishten','cûrbecûr','curbecur'
    ]::text[]),
    ('miscellaneous', 'en', array[
      'miscellaneous','other','others','various','items'
    ]::text[]),
    ('miscellaneous', 'de', array[
      'verschiedenes','sonstiges','andere','artikel'
    ]::text[]),
    ('sale', 'ar', array['بيع','للبيع','مبيع']::text[]),
    ('sale', 'ku', array['firotin','firotan']::text[]),
    ('sale', 'en', array['sale','sell','selling']::text[]),
    ('sale', 'de', array['verkauf','verkaufen']::text[]),
    ('rent', 'ar', array['إيجار','ايجار','للإيجار','للايجار','آجار','اجار']::text[]),
    ('rent', 'ku', array['kirê','kire','kirêkirin']::text[]),
    ('rent', 'en', array['rent','rental','lease']::text[]),
    ('rent', 'de', array['miete','mieten','vermietung']::text[])
), normalized_seeds as (
  select
    seed.concept_key,
    public.normalize_marketplace_search(alias_value) as alias_term,
    min(seed.language_code) as language_code
  from seeds as seed
  cross join lateral unnest(seed.aliases) as alias_value
  group by seed.concept_key,
    public.normalize_marketplace_search(alias_value)
)
insert into public.marketplace_search_aliases(
  concept_key, alias_term, language_code
)
select concept_key, alias_term, language_code
from normalized_seeds
where alias_term <> ''
on conflict (concept_key, alias_term) do update
set language_code = excluded.language_code;
create index if not exists marketplace_search_alias_term_idx
on public.marketplace_search_aliases(alias_term);
create or replace function public.refresh_listing_search_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_text text := '';
  city_text text := '';
  node_text text := '';
  category_text text := '';
  type_text text := '';
begin
  select concat_ws(' ', display_name, business_name, office_address)
  into owner_text from public.profiles where id = new.owner_id;

  select concat_ws(' ', slug, names::text)
  into city_text from public.cities where id = new.city_id;

  if new.location_node_id is not null then
    select concat_ws(' ', slug, names::text)
    into node_text from public.location_nodes where id = new.location_node_id;
  end if;

  if new.category_config_id is not null then
    select concat_ws(' ', category_key, names::text)
    into category_text
    from public.listing_categories_config
    where id = new.category_config_id;
  end if;

  if new.category_type_id is not null then
    select concat_ws(' ', type_key, names::text)
    into type_text
    from public.listing_category_types
    where id = new.category_type_id;
  end if;

  new.search_document := public.normalize_marketplace_search(concat_ws(' ',
    new.title, new.description, new.seller_name, new.area_label,
    new.contact_phone, new.public_code, new.attributes::text,
    new.category_key, new.purpose_key,
    owner_text, city_text, node_text, category_text, type_text
  ));
  return new;
end;
$$;
drop trigger if exists listings_refresh_search_document on public.listings;
create trigger listings_refresh_search_document
before insert or update of title, description, seller_name, area_label,
  contact_phone, public_code, attributes, owner_id, city_id, location_node_id,
  category_config_id, category_type_id, category_key, purpose_key
on public.listings
for each row execute function public.refresh_listing_search_document();
create or replace function public.refresh_category_listing_search_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings set title = title
  where category_config_id = new.id;
  return new;
end;
$$;
create or replace function public.refresh_type_listing_search_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings set title = title
  where category_type_id = new.id;
  return new;
end;
$$;
revoke all on function public.refresh_category_listing_search_documents()
from public;
revoke all on function public.refresh_type_listing_search_documents()
from public;
drop trigger if exists listing_categories_refresh_search_documents
on public.listing_categories_config;
create trigger listing_categories_refresh_search_documents
after update of category_key, names
on public.listing_categories_config
for each row
when (old.category_key is distinct from new.category_key
  or old.names is distinct from new.names)
execute function public.refresh_category_listing_search_documents();
drop trigger if exists listing_types_refresh_search_documents
on public.listing_category_types;
create trigger listing_types_refresh_search_documents
after update of type_key, names
on public.listing_category_types
for each row
when (old.type_key is distinct from new.type_key
  or old.names is distinct from new.names)
execute function public.refresh_type_listing_search_documents();
-- Rebuild existing search documents so catalog/type names become searchable.
update public.listings set title = title;
create index if not exists listings_search_document_trgm_idx
on public.listings using gin (search_document gin_trgm_ops);
create or replace function public.search_marketplace_ids(
  search_term text,
  target_market uuid default null,
  result_limit integer default 100
) returns table (listing_id uuid, relevance real)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized_query as (
    select public.normalize_marketplace_search(search_term) as value
  ), input_tokens as (
    select distinct token
    from normalized_query,
      lateral regexp_split_to_table(normalized_query.value, '\s+') as token
    where token <> ''
  ), search_options as (
    select token as source_token, token as option
    from input_tokens
    union
    select input.token, candidate.alias_term
    from input_tokens as input
    join public.marketplace_search_aliases as matched
      on matched.alias_term = input.token
    join public.marketplace_search_aliases as candidate
      on candidate.concept_key = matched.concept_key
  ), candidate_documents as (
    select listing.id,
      listing.search_document as document,
      public.normalize_marketplace_search(listing.title) as title_document,
      listing.is_featured,
      listing.published_at
    from public.listings as listing
    where listing.deleted_at is null
      and listing.state::text in ('published', 'reserved')
      and (target_market is null or listing.market_id = target_market)
  ), token_scores as (
    select candidate.id as listing_id,
      option.source_token,
      max(greatest(
        case when position(
          ' ' || option.option || ' ' in ' ' || candidate.document || ' '
        ) > 0 then 1.0 else 0 end,
        case when candidate.document like '%' || option.option || '%'
          then 0.92 else 0 end,
        word_similarity(option.option, candidate.document),
        least(1.0,
          word_similarity(option.option, candidate.title_document) * 1.12
        )
      )) as token_score
    from candidate_documents as candidate
    cross join search_options as option
    where candidate.document like '%' || option.option || '%'
      or (
        length(option.option) >= 3
        and option.option <% candidate.document
      )
    group by candidate.id, option.source_token
  ), ranked as (
    select score.listing_id,
      (
        avg(score.token_score)
        + case when candidate.document like '%' || query.value || '%'
            then 0.25 else 0 end
        + case when candidate.title_document like '%' || query.value || '%'
            then 0.20 else 0 end
      )::real as relevance,
      candidate.is_featured,
      candidate.published_at
    from token_scores as score
    join candidate_documents as candidate on candidate.id = score.listing_id
    cross join normalized_query as query
    group by score.listing_id, candidate.document, candidate.title_document,
      candidate.is_featured, candidate.published_at, query.value
    having count(distinct score.source_token) =
      (select count(*) from input_tokens)
  )
  select ranked.listing_id, ranked.relevance
  from ranked
  cross join normalized_query as query
  where query.value <> ''
  order by ranked.relevance desc, ranked.is_featured desc,
    ranked.published_at desc
  limit least(greatest(coalesce(result_limit, 100), 1), 500);
$$;
grant execute on function public.search_marketplace_ids(text, uuid, integer)
to anon, authenticated;
commit;
