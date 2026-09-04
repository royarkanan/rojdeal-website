-- Ensure conversation metadata is visible only to its buyer and seller.
-- Messages and attachments already have their own participant-only policies.
begin;

alter table public.conversations enable row level security;

drop policy if exists "conversation participants read" on public.conversations;
drop policy if exists "participants read conversations" on public.conversations;
create policy "conversation participants read"
on public.conversations
for select
to authenticated
using (
  auth.uid() is not null
  and auth.uid() in (buyer_id, seller_id)
);

-- Conversation rows are created by buyers through the existing guarded insert
-- policy. Clients must not rewrite or delete participant metadata directly.
revoke update, delete, truncate on public.conversations from authenticated;
grant select, insert on public.conversations to authenticated;

-- Tighten the existing insert policy without changing valid conversations.
drop policy if exists "buyers start conversations" on public.conversations;
create policy "buyers start conversations"
on public.conversations
for insert
to authenticated
with check (
  buyer_id = auth.uid()
  and buyer_id <> seller_id
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
