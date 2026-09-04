-- Build 5: make account-deletion requests safely reversible during the grace
-- period and expose a service-role-only queue for the final Auth deletion job.

begin;

create table if not exists public.account_deletion_listing_states (
  request_id uuid not null references public.account_deletion_requests(id)
    on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  previous_state text not null,
  primary key (request_id, listing_id)
);

alter table public.account_deletion_listing_states enable row level security;

drop policy if exists "owners read deletion listing snapshot"
on public.account_deletion_listing_states;
create policy "owners read deletion listing snapshot"
on public.account_deletion_listing_states
for select to authenticated using (
  exists (
    select 1 from public.account_deletion_requests request
    where request.id = request_id
      and (request.user_id = auth.uid() or public.has_staff_permission('legal.manage'))
  )
);
grant select on public.account_deletion_listing_states to authenticated;

create or replace function public.request_own_account_deletion(
  deletion_reason text default null
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare target_user uuid := auth.uid();
declare grace_days integer := 7;
declare due_at timestamptz;
declare target_request uuid;
begin
  if target_user is null then raise exception 'authentication_required'; end if;
  if exists(select 1 from public.platform_owners where user_id = target_user)
     or public.is_staff() then
    raise exception 'staff_account_requires_owner_review' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.account_deletion_requests
    where user_id = target_user and state in ('pending','held','processing')
  ) then
    raise exception 'deletion_request_already_pending';
  end if;
  select account_deletion_grace_days into grace_days
  from public.platform_content where id = true;
  due_at := now() + make_interval(days => coalesce(grace_days, 7));
  insert into public.account_deletion_requests(
    user_id,state,reason,requested_at,execute_after
  ) values (
    target_user,'pending',nullif(trim(deletion_reason),''),now(),due_at
  ) returning id into target_request;

  insert into public.account_deletion_listing_states(
    request_id, listing_id, previous_state
  )
  select target_request, listing.id, listing.state::text
  from public.listings listing
  where listing.owner_id = target_user
    and listing.deleted_at is null
    and listing.state::text in ('published','reserved');

  update public.profiles set
    account_deletion_pending = true,
    account_deletion_requested_at = now()
  where id = target_user;

  update public.listings listing set
    state = 'hidden'::public.listing_state,
    updated_at = now()
  where listing.owner_id = target_user
    and listing.deleted_at is null
    and listing.state::text in ('published','reserved');
  return due_at;
end;
$$;

create or replace function public.cancel_own_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_request uuid;
begin
  select request.id into target_request
  from public.account_deletion_requests
  where user_id = auth.uid()
    and state = 'pending'
    and execute_after > now()
  order by requested_at desc
  limit 1
  for update;
  if target_request is null then
    raise exception 'no_cancellable_deletion_request';
  end if;

  update public.listings listing
  set state = snapshot.previous_state::public.listing_state,
      updated_at = now()
  from public.account_deletion_listing_states snapshot
  where snapshot.request_id = target_request
    and snapshot.listing_id = listing.id
    -- Do not overwrite a moderation action made after the deletion request.
    and listing.state::text = 'hidden'
    and listing.deleted_at is null;

  update public.account_deletion_requests
  set state = 'cancelled', cancelled_at = now()
  where id = target_request;
  update public.profiles set
    account_deletion_pending = false,
    account_deletion_requested_at = null
  where id = auth.uid();
end;
$$;

create or replace function public.get_my_account_deletion_request()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object(
      'id', request.id,
      'state', request.state,
      'requested_at', request.requested_at,
      'execute_after', request.execute_after,
      'legal_hold', request.legal_hold
    )
    from public.account_deletion_requests request
    where request.user_id = auth.uid()
      and request.state in ('pending','held','processing')
    order by request.requested_at desc
    limit 1
  ) end;
$$;

-- The Edge Function/secure server uses this to claim due requests, then calls
-- the Supabase Admin Auth API. It is deliberately unavailable to app users.
create or replace function public.claim_due_account_deletions(batch_size integer default 25)
returns table(request_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  return query
  with due as (
    select request.id
    from public.account_deletion_requests request
    where request.state = 'pending'
      and request.execute_after <= now()
      and not request.legal_hold
    order by request.execute_after
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 25), 100))
  ), claimed as (
    update public.account_deletion_requests request
    set state = 'processing', last_error = null
    from due
    where request.id = due.id
    returning request.id, request.user_id
  )
  select claimed.id, claimed.user_id from claimed;
end;
$$;

revoke all on function public.get_my_account_deletion_request() from public;
revoke all on function public.claim_due_account_deletions(integer) from public;
grant execute on function public.get_my_account_deletion_request() to authenticated;
grant execute on function public.claim_due_account_deletions(integer) to service_role;

commit;
