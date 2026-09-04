-- RojDeal security hardening
-- Generated from the linked project's SECURITY DEFINER privilege audit.

begin;
-- Start from least privilege for every SECURITY DEFINER function. PostgreSQL
-- grants EXECUTE to PUBLIC by default, which also includes anon/authenticated.
do $migration$
declare
  target_function record;
begin
  for target_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      target_function.signature
    );
    execute format(
      'grant execute on function %s to service_role',
      target_function.signature
    );
  end loop;
end
$migration$;
-- Trigger functions and background-worker helpers must never be callable
-- directly through the Data API. All other current SECURITY DEFINER RPCs
-- remain available to signed-in users; their existing authorization checks
-- continue to decide whether a normal user or staff member may proceed.
do $migration$
declare
  target_function record;
begin
  for target_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname not in (
        'assign_listing_location_from_city',
        'attach_listing_location_proposal',
        'claim_broadcast_recipients',
        'claim_due_account_deletions',
        'enforce_listing_contact_visibility',
        'enforce_standard_listing_limit',
        'find_or_create_city',
        'handle_new_user',
        'notify_listing_status_in_chat',
        'notify_message_recipient',
        'notify_pending_listing_video',
        'prepare_listing_media',
        'prevent_suspended_account_writes',
        'refresh_listing_search_document',
        'refresh_owner_listing_search_documents',
        'sync_listing_favorite_count',
        'validate_listing_dynamic_configuration'
      )
  loop
    execute format(
      'grant execute on function %s to authenticated',
      target_function.signature
    );
  end loop;
end
$migration$;
-- These RPCs intentionally support signed-out marketplace browsing/metrics.
-- Anonymous access to every other SECURITY DEFINER function stays revoked.
do $migration$
declare
  target_function record;
begin
  for target_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'get_active_direct_ad',
        'get_visible_profile',
        'record_ad_event',
        'record_listing_event',
        'search_public_profiles'
      )
  loop
    execute format(
      'grant execute on function %s to anon',
      target_function.signature
    );
  end loop;
end
$migration$;
-- Pin the search path of the four functions reported by Security Advisor.
do $migration$
declare
  target_function record;
begin
  for target_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'protect_conversation_participants',
        'normalize_city_name',
        'normalize_marketplace_search'
      )
  loop
    execute format(
      'alter function %s set search_path to pg_catalog, public',
      target_function.signature
    );
  end loop;
end
$migration$;
-- Public buckets can serve known public URLs without a broad SELECT policy.
-- Removing these policies prevents anonymous enumeration of every object.
drop policy if exists "public listing images" on storage.objects;
drop policy if exists "public platform content read" on storage.objects;
drop policy if exists "public profile avatars read" on storage.objects;
-- Safety assertion: only the five explicitly public RPC groups may remain
-- executable by anon after this migration.
do $migration$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in (
        'get_active_direct_ad',
        'get_visible_profile',
        'record_ad_event',
        'record_listing_event',
        'search_public_profiles'
      )
  ) then
    raise exception 'Unexpected anonymous SECURITY DEFINER privilege remains';
  end if;
end
$migration$;
commit;
