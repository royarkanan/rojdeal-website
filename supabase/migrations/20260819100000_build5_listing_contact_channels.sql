-- Per-listing contact channels. Login email is never copied automatically.
-- The public values below are only stored when the listing owner explicitly
-- enables the corresponding channel in the publish/edit form.

begin;
alter table public.listings
  add column if not exists contact_email text,
  add column if not exists chat_enabled boolean not null default true,
  add column if not exists whatsapp_enabled boolean not null default false;
alter table public.listings
  drop constraint if exists listings_contact_email_format_check;
alter table public.listings
  add constraint listings_contact_email_format_check check (
    contact_email is null or (
      char_length(contact_email) between 5 and 320
      and contact_email = lower(trim(contact_email))
      and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );
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

  new.direct_call_override :=
    coalesce(profile_call_enabled, true)
    and coalesce(new.direct_call_override, true);
  new.chat_enabled := coalesce(new.chat_enabled, true);
  new.whatsapp_enabled := coalesce(new.whatsapp_enabled, false);

  if not new.direct_call_override and not new.whatsapp_enabled then
    new.contact_phone := null;
  else
    new.contact_phone := nullif(trim(coalesce(new.contact_phone, '')), '');
  end if;

  new.contact_email := nullif(lower(trim(coalesce(new.contact_email, ''))), '');
  return new;
end;
$$;
drop trigger if exists listings_enforce_contact_visibility on public.listings;
create trigger listings_enforce_contact_visibility
before insert or update of owner_id, contact_phone, direct_call_override,
  contact_email, chat_enabled, whatsapp_enabled
on public.listings
for each row execute function public.enforce_listing_contact_visibility();
drop policy if exists "buyers start conversations" on public.conversations;
create policy "buyers start conversations"
on public.conversations for insert to authenticated
with check (
  buyer_id = auth.uid()
  and not public.is_user_interaction_blocked(buyer_id, seller_id)
  and exists (
    select 1
    from public.listings as listing
    where listing.id = listing_id
      and listing.owner_id = seller_id
      and listing.state::text in ('published', 'reserved')
      and listing.chat_enabled
  )
);
commit;
