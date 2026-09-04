-- RojDeal Build 5: searchable marketplace, anonymous-safe metrics and
-- recoverable deletion/archiving with audit and legal hold.

begin;
-- -------------------------------------------------------------------------
-- Listing/conversation lifecycle.
-- -------------------------------------------------------------------------
alter table public.conversations
  add column if not exists archived_at timestamptz,
  add column if not exists archive_delete_after timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists lock_reason text,
  add column if not exists legal_hold boolean not null default false;
create index if not exists conversations_archive_cleanup_idx
on public.conversations(archive_delete_after)
where archived_at is not null and legal_hold = false;
create or replace function public.protect_listing_lifecycle_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('rojdeal.lifecycle_rpc', true), '') <> '1'
     and not public.can_staff('listings') then
    new.archived_at = old.archived_at;
    new.archive_delete_after = old.archive_delete_after;
    new.deleted_at = old.deleted_at;
    new.deleted_by = old.deleted_by;
    new.deletion_reason = old.deletion_reason;
    new.legal_hold = old.legal_hold;
    new.legal_hold_reason = old.legal_hold_reason;
    new.legal_hold_by = old.legal_hold_by;
    new.legal_hold_at = old.legal_hold_at;
  end if;
  return new;
end;
$$;
drop trigger if exists listings_protect_lifecycle_fields on public.listings;
create trigger listings_protect_lifecycle_fields
before update on public.listings
for each row execute function public.protect_listing_lifecycle_fields();
create table if not exists public.retention_jobs (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing', 'conversation', 'message_attachment')),
  target_id uuid not null,
  execute_after timestamptz not null,
  state text not null default 'queued'
    check (state in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 100),
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (target_type, target_id)
);
create index if not exists retention_jobs_due_idx
on public.retention_jobs(state, execute_after)
where state in ('queued', 'failed');
alter table public.retention_jobs enable row level security;
drop policy if exists "retention jobs staff read" on public.retention_jobs;
create policy "retention jobs staff read" on public.retention_jobs
for select to authenticated using (public.is_admin());
grant select on public.retention_jobs to authenticated;
create or replace function public.require_destructive_reason()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.action in (
    'listing_deleted', 'listing_removed', 'account_deleted',
    'media_deleted', 'staff_role_removed', 'message_removed_by_staff'
  ) and char_length(trim(coalesce(new.note, ''))) < 3 then
    raise exception 'moderation_reason_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists moderation_log_require_reason on public.moderation_log;
create trigger moderation_log_require_reason
before insert or update on public.moderation_log
for each row execute function public.require_destructive_reason();
create or replace function public.request_listing_deletion(
  target_listing uuid,
  deletion_note text
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  listing_owner uuid;
  retention_days integer := 60;
  delete_after timestamptz;
  actor_is_staff boolean := false;
begin
  if actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(deletion_note, ''))) < 3 then
    raise exception 'deletion_reason_required' using errcode = 'P0001';
  end if;

  select owner_id into listing_owner
  from public.listings where id = target_listing for update;
  if listing_owner is null then raise exception 'listing_not_found'; end if;

  actor_is_staff := public.can_staff('listings');
  if listing_owner <> actor and not actor_is_staff then
    raise exception 'listing_owner_or_staff_required' using errcode = '42501';
  end if;

  select coalesce(listing_archive_days, 60)
  into retention_days
  from public.platform_content where id = true;
  delete_after := now() + make_interval(days => retention_days);

  perform set_config('rojdeal.lifecycle_rpc', '1', true);

  update public.listings
  set state = 'removed'::public.listing_state,
      archived_at = now(),
      archive_delete_after = delete_after,
      deleted_at = now(),
      deleted_by = actor,
      deletion_reason = trim(deletion_note),
      updated_at = now()
  where id = target_listing;

  update public.conversations
  set archived_at = now(),
      archive_delete_after = delete_after,
      locked_at = now(),
      lock_reason = 'listing_deleted'
  where listing_id = target_listing;

  insert into public.retention_jobs(
    target_type, target_id, execute_after, created_by
  ) values ('listing', target_listing, delete_after, actor)
  on conflict (target_type, target_id) do update set
    execute_after = excluded.execute_after,
    state = 'queued',
    attempts = 0,
    last_error = null,
    created_by = excluded.created_by;

  insert into public.moderation_log(
    moderator_id, listing_id, action, note
  ) values (
    actor, target_listing,
    case when actor_is_staff then 'listing_deleted' else 'owner_listing_deleted' end,
    trim(deletion_note)
  );

  insert into public.admin_audit_log(
    actor_id, action, target_type, target_id, details
  ) values (
    actor,
    case when actor_is_staff then 'listing_deleted' else 'owner_listing_deleted' end,
    'listing', target_listing::text,
    jsonb_build_object(
      'reason', trim(deletion_note),
      'archive_delete_after', delete_after,
      'retention_days', retention_days
    )
  );

  return delete_after;
end;
$$;
revoke all on function public.request_listing_deletion(uuid, text) from public;
grant execute on function public.request_listing_deletion(uuid, text)
to authenticated;
create or replace function public.restore_archived_listing(target_listing uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  listing_owner uuid;
  held boolean;
begin
  select owner_id, legal_hold into listing_owner, held
  from public.listings where id = target_listing for update;
  if listing_owner is null then raise exception 'listing_not_found'; end if;
  if listing_owner <> actor and not public.can_staff('listings') then
    raise exception 'listing_owner_or_staff_required' using errcode = '42501';
  end if;
  if held then raise exception 'listing_under_legal_hold' using errcode = '42501'; end if;

  perform set_config('rojdeal.lifecycle_rpc', '1', true);

  update public.listings
  set state = 'draft'::public.listing_state,
      archived_at = null,
      archive_delete_after = null,
      deleted_at = null,
      deleted_by = null,
      deletion_reason = null,
      updated_at = now()
  where id = target_listing;

  update public.conversations
  set archived_at = null,
      archive_delete_after = null,
      locked_at = null,
      lock_reason = null
  where listing_id = target_listing and legal_hold = false;

  update public.retention_jobs
  set state = 'cancelled', processed_at = now()
  where target_type = 'listing' and target_id = target_listing
    and state in ('queued', 'failed');

  insert into public.admin_audit_log(actor_id, action, target_type, target_id)
  values (actor, 'listing_restored_as_draft', 'listing', target_listing::text);
end;
$$;
revoke all on function public.restore_archived_listing(uuid) from public;
grant execute on function public.restore_archived_listing(uuid) to authenticated;
create or replace function public.set_listing_legal_hold(
  target_listing uuid,
  hold_enabled boolean,
  hold_note text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;
  if hold_enabled and char_length(trim(coalesce(hold_note, ''))) < 3 then
    raise exception 'legal_hold_reason_required';
  end if;

  perform set_config('rojdeal.lifecycle_rpc', '1', true);

  update public.listings set
    legal_hold = hold_enabled,
    legal_hold_reason = case when hold_enabled then trim(hold_note) else null end,
    legal_hold_by = case when hold_enabled then auth.uid() else null end,
    legal_hold_at = case when hold_enabled then now() else null end
  where id = target_listing;
  if not found then raise exception 'listing_not_found'; end if;

  update public.conversations
  set legal_hold = hold_enabled
  where listing_id = target_listing;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    case when hold_enabled then 'legal_hold_enabled' else 'legal_hold_disabled' end,
    'listing', target_listing::text,
    jsonb_build_object('reason', nullif(trim(hold_note), ''))
  );
end;
$$;
revoke all on function public.set_listing_legal_hold(uuid, boolean, text) from public;
grant execute on function public.set_listing_legal_hold(uuid, boolean, text)
to authenticated;
-- Public reads exclude deleted/suspended/blocked owners. Participants retain
-- access to an archived conversation only during the retention period.
drop policy if exists "published listings read" on public.listings;
create policy "published listings read" on public.listings
for select using (
  (
    deleted_at is null
    and not public.is_profile_suspended(owner_id)
    and not public.is_user_interaction_blocked(auth.uid(), owner_id)
    and (
      state::text in ('published', 'reserved')
      or owner_id = auth.uid()
      or exists (
        select 1 from public.conversations as conversation
        where conversation.listing_id = listings.id
          and auth.uid() in (conversation.buyer_id, conversation.seller_id)
      )
    )
  )
  or public.can_staff('listings')
  or public.can_staff('reports')
  or public.can_staff('media')
);
drop policy if exists "public active seller profiles read" on public.profiles;
create policy "public active seller profiles read" on public.profiles
for select using (
  not is_suspended
  and not public.is_user_interaction_blocked(auth.uid(), id)
  and exists (
    select 1 from public.listings as listing
    where listing.owner_id = profiles.id
      and listing.deleted_at is null
      and listing.state::text in ('published', 'reserved')
  )
);
-- -------------------------------------------------------------------------
-- Privacy-safe aggregate metrics. No viewer identity is returned to owners.
-- -------------------------------------------------------------------------
create table if not exists public.listing_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'favorite', 'call', 'share', 'message')),
  actor_key text not null,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (listing_id, event_type, actor_key, occurred_on),
  check (jsonb_typeof(metadata) = 'object')
);
create index if not exists listing_events_owner_metrics_idx
on public.listing_events(listing_id, event_type, created_at desc);
alter table public.listing_events enable row level security;
drop policy if exists "listing events staff read" on public.listing_events;
create policy "listing events staff read" on public.listing_events
for select to authenticated using (public.can_staff('listings'));
create or replace function public.record_listing_event(
  target_listing uuid,
  event_name text,
  anonymous_session text default null,
  event_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  key_value text;
  inserted boolean := false;
begin
  if event_name not in ('view', 'call', 'share', 'message') then
    raise exception 'invalid_listing_event';
  end if;
  if not exists (
    select 1 from public.listings
    where id = target_listing and deleted_at is null
      and state::text in ('published', 'reserved')
  ) then return false; end if;

  key_value := case
    when auth.uid() is not null then 'u:' || auth.uid()::text
    when nullif(trim(anonymous_session), '') is not null
      then 'a:' || encode(digest(trim(anonymous_session), 'sha256'), 'hex')
    else 'a:' || encode(digest(coalesce(current_setting('request.headers', true), '') || current_date::text, 'sha256'), 'hex')
  end;

  insert into public.listing_events(
    listing_id, event_type, actor_key, metadata
  ) values (
    target_listing, event_name, key_value, coalesce(event_metadata, '{}'::jsonb)
  ) on conflict do nothing;
  inserted := found;

  if inserted and event_name = 'view' then
    update public.listings
    set view_count = view_count + 1
    where id = target_listing;
  end if;
  return inserted;
end;
$$;
revoke all on function public.record_listing_event(uuid, text, text, jsonb)
from public;
grant execute on function public.record_listing_event(uuid, text, text, jsonb)
to anon, authenticated;
create or replace function public.sync_listing_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid := coalesce(new.listing_id, old.listing_id);
begin
  update public.listings
  set favorite_count = (
    select count(*) from public.favorites where listing_id = target
  )
  where id = target;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists favorites_sync_listing_count on public.favorites;
create trigger favorites_sync_listing_count
after insert or delete on public.favorites
for each row execute function public.sync_listing_favorite_count();
update public.listings as listing
set favorite_count = (
  select count(*) from public.favorites as favorite
  where favorite.listing_id = listing.id
);
create or replace function public.get_my_listing_metrics()
returns table (
  listing_id uuid,
  view_count bigint,
  favorite_count bigint,
  call_count bigint,
  share_count bigint,
  message_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    listing.id,
    listing.view_count,
    listing.favorite_count,
    count(event.id) filter (where event.event_type = 'call')::bigint,
    count(event.id) filter (where event.event_type = 'share')::bigint,
    count(event.id) filter (where event.event_type = 'message')::bigint
  from public.listings as listing
  left join public.listing_events as event on event.listing_id = listing.id
  where listing.owner_id = auth.uid()
  group by listing.id;
$$;
revoke all on function public.get_my_listing_metrics() from public;
grant execute on function public.get_my_listing_metrics() to authenticated;
-- -------------------------------------------------------------------------
-- Multilingual/fuzzy marketplace search. The RPC returns matching IDs and a
-- score; normal listing reads still pass through RLS.
-- -------------------------------------------------------------------------
create or replace function public.normalize_marketplace_search(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(
    lower(public.unaccent(coalesce(value, ''))),
    '[^[:alnum:]ء-ي]+', ' ', 'g'
  ));
$$;
alter table public.listings
  add column if not exists search_document text not null default '';
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
begin
  select concat_ws(' ', display_name, business_name, office_address)
  into owner_text from public.profiles where id = new.owner_id;

  select concat_ws(' ', slug, names::text)
  into city_text from public.cities where id = new.city_id;

  if new.location_node_id is not null then
    select concat_ws(' ', slug, names::text)
    into node_text from public.location_nodes where id = new.location_node_id;
  end if;

  new.search_document := public.normalize_marketplace_search(concat_ws(' ',
    new.title, new.description, new.seller_name, new.area_label,
    new.contact_phone, new.public_code, new.attributes::text,
    owner_text, city_text, node_text
  ));
  return new;
end;
$$;
drop trigger if exists listings_refresh_search_document on public.listings;
create trigger listings_refresh_search_document
before insert or update of title, description, seller_name, area_label,
  contact_phone, public_code, attributes, owner_id, city_id, location_node_id
on public.listings
for each row execute function public.refresh_listing_search_document();
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
  with query as (
    select public.normalize_marketplace_search(search_term) as value
  )
  select listing.id,
    greatest(
      similarity(listing.search_document, query.value),
      case when listing.search_document like '%' || query.value || '%' then 0.85 else 0 end
    )::real as relevance
  from public.listings as listing
  cross join query
  where query.value <> ''
    and listing.deleted_at is null
    and listing.state::text in ('published', 'reserved')
    and (target_market is null or listing.market_id = target_market)
    and (
      listing.search_document like '%' || query.value || '%'
      or similarity(listing.search_document, query.value) >= 0.18
    )
  order by relevance desc, listing.is_featured desc, listing.published_at desc
  limit least(greatest(coalesce(result_limit, 100), 1), 500);
$$;
grant execute on function public.search_marketplace_ids(text, uuid, integer)
to anon, authenticated;
commit;
