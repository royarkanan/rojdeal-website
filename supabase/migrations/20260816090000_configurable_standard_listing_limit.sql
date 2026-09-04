-- Configurable active-listing limit for Standard accounts.
-- It is intentionally disabled by default and can be enabled from the
-- administrator dashboard without publishing a new mobile-app version.

alter table public.platform_content
add column if not exists standard_listing_limit_enabled boolean not null default false;
alter table public.platform_content
add column if not exists standard_active_listing_limit integer not null default 5;
alter table public.platform_content
drop constraint if exists platform_content_standard_active_listing_limit_check;
alter table public.platform_content
add constraint platform_content_standard_active_listing_limit_check
check (standard_active_listing_limit between 1 and 1000);
create or replace function public.enforce_standard_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_enabled boolean := false;
  active_limit integer := 5;
  owner_tier text := 'standard';
  occupied_slots integer := 0;
begin
  -- States outside the publishing flow do not occupy a listing slot.
  if new.state::text not in ('draft', 'published', 'reserved') then
    return new;
  end if;

  select
    content.standard_listing_limit_enabled,
    content.standard_active_listing_limit
  into limit_enabled, active_limit
  from public.platform_content as content
  where content.id = true;

  if not coalesce(limit_enabled, false) then
    return new;
  end if;

  select coalesce(profile.account_tier, 'standard')
  into owner_tier
  from public.profiles as profile
  where profile.id = new.owner_id;

  -- PRO and GOLD accounts are not restricted by the Standard-account limit.
  if owner_tier <> 'standard' then
    return new;
  end if;

  -- Serialize slot reservations for the same owner to prevent simultaneous
  -- publication requests from exceeding the configured limit.
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));

  select count(*)::integer
  into occupied_slots
  from public.listings as listing
  where listing.owner_id = new.owner_id
    and listing.id <> new.id
    and (
      listing.state::text in ('published', 'reserved')
      or (
        listing.state::text = 'draft'
        and listing.created_at > now() - interval '30 minutes'
      )
    );

  if occupied_slots >= active_limit then
    raise exception 'standard_active_listing_limit'
      using
        errcode = 'P0001',
        detail = format('limit=%s', active_limit),
        hint = 'Archive, sell, rent, or remove an active listing before publishing another.';
  end if;

  return new;
end;
$$;
drop trigger if exists listings_enforce_standard_limit on public.listings;
create trigger listings_enforce_standard_limit
before insert or update of owner_id, state on public.listings
for each row execute function public.enforce_standard_listing_limit();
