-- RojDeal 2026-08-16: remotely managed release controls, front-page
-- documents/images, optional automatic video approval, profile avatars and
-- administrator account suspension.

alter table public.platform_content
add column if not exists listing_video_review_required boolean not null default true;

alter table public.platform_content
add column if not exists featured_assets jsonb not null default '[]'::jsonb;

alter table public.platform_content
add column if not exists help_content jsonb not null default '{}'::jsonb;

alter table public.platform_content
add column if not exists force_update_enabled boolean not null default false;

alter table public.platform_content
add column if not exists minimum_supported_build integer not null default 0;

alter table public.platform_content
add column if not exists update_message jsonb not null default '{}'::jsonb;

alter table public.platform_content
add column if not exists android_store_url text not null default '';

alter table public.platform_content
add column if not exists ios_store_url text not null default '';

alter table public.platform_content
add column if not exists phone_auth_enabled boolean not null default false;

alter table public.platform_content
add column if not exists whatsapp_auth_enabled boolean not null default false;

-- Phone-only accounts must still be able to request support and upgrades.
alter table public.promotion_requests
alter column contact_email drop not null;

alter table public.promotion_requests
add column if not exists contact_phone text;

alter table public.promotion_requests
drop constraint if exists promotion_requests_contact_required;

alter table public.promotion_requests
add constraint promotion_requests_contact_required check (
  nullif(trim(coalesce(contact_email, '')), '') is not null
  or nullif(trim(coalesce(contact_phone, '')), '') is not null
);

alter table public.support_requests
alter column contact_email drop not null;

alter table public.support_requests
add column if not exists contact_phone text;

alter table public.support_requests
drop constraint if exists support_requests_contact_required;

alter table public.support_requests
add constraint support_requests_contact_required check (
  nullif(trim(coalesce(contact_email, '')), '') is not null
  or nullif(trim(coalesce(contact_phone, '')), '') is not null
);

alter table public.platform_content
drop constraint if exists platform_content_featured_assets_check;

alter table public.platform_content
add constraint platform_content_featured_assets_check check (
  jsonb_typeof(featured_assets) = 'array'
  and jsonb_array_length(featured_assets) <= 12
);

alter table public.platform_content
drop constraint if exists platform_content_help_content_check;

alter table public.platform_content
add constraint platform_content_help_content_check check (
  jsonb_typeof(help_content) = 'object'
);

alter table public.platform_content
drop constraint if exists platform_content_update_message_check;

alter table public.platform_content
add constraint platform_content_update_message_check check (
  jsonb_typeof(update_message) = 'object'
);

alter table public.platform_content
drop constraint if exists platform_content_minimum_supported_build_check;

alter table public.platform_content
add constraint platform_content_minimum_supported_build_check check (
  minimum_supported_build between 0 and 100000000
);

-- Keep a single BEFORE INSERT trigger for media review. PostgreSQL executes
-- same-event triggers alphabetically, so having a second trigger here could
-- let the legacy default overwrite the remotely managed setting.
create or replace function public.prepare_listing_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_required boolean := true;
begin
  select content.listing_video_review_required
  into review_required
  from public.platform_content as content
  where content.id = true;

  if new.kind::text = 'video' and coalesce(review_required, true) then
    new.review_status = 'pending'::public.review_state;
    new.reviewed_at = null;
    new.reviewed_by = null;
  else
    new.review_status = 'approved'::public.review_state;
    new.reviewed_at = now();
    new.reviewed_by = null;
  end if;

  return new;
end;
$$;

drop trigger if exists listing_media_apply_review_setting
on public.listing_media;

drop function if exists public.apply_listing_video_review_setting();

-- Public platform files can contain administrator videos, images and PDFs.
update storage.buckets
set file_size_limit = 157286400,
    allowed_mime_types = array[
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ]
where id = 'platform-content';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public profile avatars read" on storage.objects;
create policy "public profile avatars read"
on storage.objects for select
using (bucket_id = 'profile-avatars');

drop policy if exists "users upload own profile avatar" on storage.objects;
create policy "users upload own profile avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own profile avatar" on storage.objects;
create policy "users update own profile avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own profile avatar" on storage.objects;
create policy "users delete own profile avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Administrative suspension is separate from user-to-user blocking.
alter table public.profiles
add column if not exists is_suspended boolean not null default false;

alter table public.profiles
add column if not exists suspension_reason text;

alter table public.profiles
add column if not exists suspended_at timestamptz;

alter table public.profiles
add column if not exists suspended_by uuid references public.profiles(id)
on delete set null;

create or replace function public.set_account_suspension(
  target_user uuid,
  suspend_account boolean,
  reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_staff('users') then
    raise exception 'user_management_permission_required' using errcode = '42501';
  end if;

  if target_user = auth.uid() then
    raise exception 'cannot_suspend_own_account' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.platform_owners as owner
    where owner.user_id = target_user
  ) then
    raise exception 'owner_account_cannot_be_suspended' using errcode = '42501';
  end if;

  update public.profiles
  set is_suspended = suspend_account,
      suspension_reason = case
        when suspend_account then nullif(trim(reason), '')
        else null
      end,
      suspended_at = case when suspend_account then now() else null end,
      suspended_by = case when suspend_account then auth.uid() else null end
  where id = target_user;

  if not found then
    raise exception 'user_not_found';
  end if;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    details
  ) values (
    auth.uid(),
    case when suspend_account then 'account_suspended' else 'account_restored' end,
    'profile',
    target_user::text,
    jsonb_build_object('reason', nullif(trim(reason), ''))
  );
end;
$$;

revoke all on function public.set_account_suspension(uuid, boolean, text)
from public;
grant execute on function public.set_account_suspension(uuid, boolean, text)
to authenticated;

create or replace function public.list_admin_user_accounts_v2(
  search_term text default '',
  result_limit integer default 100
) returns table (
  id uuid,
  email text,
  display_name text,
  phone text,
  business_name text,
  role text,
  account_type text,
  account_tier text,
  is_suspended boolean,
  suspension_reason text,
  suspended_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.can_staff('users') then
    raise exception 'user_management_permission_required' using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    account.email::text,
    profile.display_name,
    profile.phone,
    profile.business_name,
    profile.role::text,
    profile.account_type::text,
    profile.account_tier::text,
    profile.is_suspended,
    profile.suspension_reason,
    profile.suspended_at
  from public.profiles as profile
  join auth.users as account on account.id = profile.id
  where trim(coalesce(search_term, '')) = ''
     or account.email ilike '%' || trim(search_term) || '%'
     or profile.display_name ilike '%' || trim(search_term) || '%'
     or coalesce(profile.business_name, '') ilike '%' || trim(search_term) || '%'
     or coalesce(profile.phone, '') ilike '%' || trim(search_term) || '%'
  order by profile.created_at desc
  limit least(greatest(coalesce(result_limit, 100), 1), 500);
end;
$$;

revoke all on function public.list_admin_user_accounts_v2(text, integer)
from public;
grant execute on function public.list_admin_user_accounts_v2(text, integer)
to authenticated;

-- Users cannot remove their own suspension or alter its audit fields.
create or replace function public.protect_profile_suspension()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    new.is_suspended = old.is_suspended;
    new.suspension_reason = old.suspension_reason;
    new.suspended_at = old.suspended_at;
    new.suspended_by = old.suspended_by;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_suspension on public.profiles;
create trigger profiles_protect_suspension
before update on public.profiles
for each row execute function public.protect_profile_suspension();

-- Suspended accounts and their listings are invisible to ordinary users.
create or replace function public.is_profile_suspended(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select profile.is_suspended from public.profiles as profile
     where profile.id = target_user),
    false
  );
$$;

revoke all on function public.is_profile_suspended(uuid) from public;
grant execute on function public.is_profile_suspended(uuid)
to anon, authenticated;

drop policy if exists "public active seller profiles read" on public.profiles;
create policy "public active seller profiles read"
on public.profiles for select
using (
  not is_suspended
  and exists (
    select 1 from public.listings as listing
    where listing.owner_id = profiles.id
      and listing.state::text in ('published', 'reserved')
  )
);

drop policy if exists "chat participants read profiles" on public.profiles;
create policy "chat participants read profiles"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_staff()
  or (
    not is_suspended
    and exists (
      select 1
      from public.conversations as conversation
      where
        (conversation.buyer_id = auth.uid()
          and conversation.seller_id = profiles.id)
        or
        (conversation.seller_id = auth.uid()
          and conversation.buyer_id = profiles.id)
    )
  )
);

drop policy if exists "published listings read" on public.listings;
create policy "published listings read"
on public.listings for select
using (
  (
    (
      state::text in ('published', 'reserved')
      or exists (
        select 1 from public.conversations as conversation
        where conversation.listing_id = listings.id
          and auth.uid() in (conversation.buyer_id, conversation.seller_id)
      )
    )
    and not public.is_profile_suspended(owner_id)
  )
  or owner_id = auth.uid()
  or public.can_staff('listings')
  or public.can_staff('reports')
  or public.can_staff('media')
);

create or replace function public.prevent_suspended_account_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and is_suspended
  ) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_prevent_suspended_writes on public.listings;
create trigger listings_prevent_suspended_writes
before insert or update on public.listings
for each row execute function public.prevent_suspended_account_writes();

drop trigger if exists conversations_prevent_suspended_writes
on public.conversations;
create trigger conversations_prevent_suspended_writes
before insert or update on public.conversations
for each row execute function public.prevent_suspended_account_writes();

drop trigger if exists messages_prevent_suspended_writes on public.messages;
create trigger messages_prevent_suspended_writes
before insert or update on public.messages
for each row execute function public.prevent_suspended_account_writes();
