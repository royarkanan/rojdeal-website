-- User-to-user blocking for marketplace and chat safety.
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_different_users check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx
on public.user_blocks(blocked_id, blocker_id);
alter table public.user_blocks enable row level security;
drop policy if exists "users read own blocks" on public.user_blocks;
create policy "users read own blocks"
on public.user_blocks for select to authenticated
using (blocker_id = auth.uid());
drop policy if exists "users create own blocks" on public.user_blocks;
create policy "users create own blocks"
on public.user_blocks for insert to authenticated
with check (blocker_id = auth.uid() and blocked_id <> auth.uid());
drop policy if exists "users remove own blocks" on public.user_blocks;
create policy "users remove own blocks"
on public.user_blocks for delete to authenticated
using (blocker_id = auth.uid());
grant select, insert, delete on public.user_blocks to authenticated;
create or replace function public.is_user_interaction_blocked(
  first_user uuid,
  second_user uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and auth.uid() in (first_user, second_user)
    and exists (
      select 1
      from public.user_blocks as block
      where (block.blocker_id = first_user and block.blocked_id = second_user)
         or (block.blocker_id = second_user and block.blocked_id = first_user)
    );
$$;
revoke all on function public.is_user_interaction_blocked(uuid, uuid)
from public;
grant execute on function public.is_user_interaction_blocked(uuid, uuid)
to authenticated;
create or replace function public.list_my_blocked_users()
returns table(
  id uuid,
  display_name text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.id,
    profile.display_name,
    block.created_at
  from public.user_blocks as block
  join public.profiles as profile on profile.id = block.blocked_id
  where block.blocker_id = auth.uid()
  order by block.created_at desc;
$$;
revoke all on function public.list_my_blocked_users() from public;
grant execute on function public.list_my_blocked_users() to authenticated;
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
  )
);
drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages"
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations as conversation
    where conversation.id = conversation_id
      and (
        conversation.buyer_id = auth.uid()
        or conversation.seller_id = auth.uid()
      )
      and not public.is_user_interaction_blocked(
        conversation.buyer_id,
        conversation.seller_id
      )
  )
);
