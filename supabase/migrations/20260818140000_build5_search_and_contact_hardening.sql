-- Build 5: keep marketplace search current after profile edits and enforce
-- direct-call privacy for old or modified clients.

begin;
-- Suspension notes are private and are returned only by get_visible_profile
-- to the account owner or authorized staff.
revoke select (suspension_reason) on public.profiles from anon, authenticated;
create or replace function public.refresh_owner_listing_search_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.display_name is distinct from new.display_name
     or old.business_name is distinct from new.business_name
     or old.office_address is distinct from new.office_address then
    -- seller_name participates in the existing listing search trigger. A
    -- no-op assignment intentionally refreshes the derived document.
    update public.listings
    set seller_name = seller_name
    where owner_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_refresh_listing_search on public.profiles;
create trigger profiles_refresh_listing_search
after update of display_name, business_name, office_address
on public.profiles
for each row execute function public.refresh_owner_listing_search_documents();
create or replace function public.enforce_listing_contact_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_call_enabled boolean := true;
begin
  select coalesce(profile.direct_call_enabled, true)
  into profile_call_enabled
  from public.profiles as profile
  where profile.id = new.owner_id;

  if not (
    coalesce(profile_call_enabled, true)
    and coalesce(new.direct_call_override, true)
  ) then
    new.contact_phone := null;
  end if;
  return new;
end;
$$;
drop trigger if exists listings_enforce_contact_visibility on public.listings;
create trigger listings_enforce_contact_visibility
before insert or update of owner_id, contact_phone, direct_call_override
on public.listings
for each row execute function public.enforce_listing_contact_visibility();
update public.listings as listing
set contact_phone = null
from public.profiles as profile
where profile.id = listing.owner_id
  and not (
    coalesce(profile.direct_call_enabled, true)
    and coalesce(listing.direct_call_override, true)
  )
  and listing.contact_phone is not null;
commit;
