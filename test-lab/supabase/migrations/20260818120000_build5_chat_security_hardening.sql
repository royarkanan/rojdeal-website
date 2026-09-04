-- RojDeal Build 5: prevent chat participants from directly rewriting messages.
-- Read receipts and deletion must go through narrowly scoped RPC functions.

begin;

drop policy if exists "recipient marks read" on public.messages;

revoke update, delete on public.messages from authenticated;
grant select, insert on public.messages to authenticated;

create or replace function public.mark_conversation_read(
  target_conversation uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  changed integer := 0;
begin
  if actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not public.is_conversation_participant(target_conversation) then
    raise exception 'conversation_participant_required' using errcode = '42501';
  end if;

  update public.messages
  set read_at = coalesce(read_at, now())
  where conversation_id = target_conversation
    and sender_id <> actor
    and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Keep attachment metadata immutable to clients after creation. Deletion is
-- performed by the audited message-deletion RPC and retention worker.
revoke update, delete on public.message_attachments from authenticated;
grant select, insert on public.message_attachments to authenticated;

commit;
