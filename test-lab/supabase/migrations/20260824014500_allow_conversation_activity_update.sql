-- Allow chat participants to update only the activity timestamp.
-- Buyer/seller/listing identifiers remain immutable to authenticated clients.
begin;

drop policy if exists "conversation participants update activity" on public.conversations;
create policy "conversation participants update activity"
on public.conversations
for update
to authenticated
using (
  auth.uid() is not null
  and auth.uid() in (buyer_id, seller_id)
)
with check (
  auth.uid() is not null
  and auth.uid() in (buyer_id, seller_id)
);

revoke update on public.conversations from authenticated;
grant update (last_message_at) on public.conversations to authenticated;

commit;
