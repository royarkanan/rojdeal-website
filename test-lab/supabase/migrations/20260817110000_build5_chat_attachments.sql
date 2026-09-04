-- RojDeal Build 5: private chat images/files/PDFs and safe message deletion.

begin;

alter table public.messages
  add column if not exists deleted_for_everyone_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id)
    on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists edited_at timestamptz;

alter table public.messages alter column body set default '';
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_message_type_check
    check (message_type in ('user', 'listing_status', 'attachment', 'mixed')),
  add constraint messages_body_check check (
    char_length(body) <= 2000
    and (
      char_length(trim(body)) > 0
      or message_type in ('attachment', 'listing_status')
      or deleted_for_everyone_at is not null
    )
  );

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('image', 'pdf', 'file')),
  storage_path text not null unique,
  original_name text not null check (char_length(trim(original_name)) between 1 and 255),
  mime_type text not null check (char_length(trim(mime_type)) between 3 and 150),
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  width integer,
  height integer,
  upload_state text not null default 'complete'
    check (upload_state in ('uploading', 'complete', 'failed', 'cancelled')),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists message_attachments_message_idx
on public.message_attachments(message_id, created_at);
create index if not exists message_attachments_conversation_idx
on public.message_attachments(conversation_id, created_at desc);

create table if not exists public.message_hidden_users (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_attachments enable row level security;
alter table public.message_hidden_users enable row level security;

create or replace function public.is_conversation_participant(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations as conversation
    where conversation.id = target_conversation
      and auth.uid() in (conversation.buyer_id, conversation.seller_id)
  );
$$;

revoke all on function public.is_conversation_participant(uuid) from public;
grant execute on function public.is_conversation_participant(uuid)
to authenticated;

drop policy if exists "message participants read" on public.messages;
create policy "message participants read" on public.messages
for select to authenticated using (
  public.is_conversation_participant(conversation_id)
  and not exists (
    select 1 from public.message_hidden_users as hidden
    where hidden.message_id = messages.id and hidden.user_id = auth.uid()
  )
);

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages
for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations as conversation
    where conversation.id = conversation_id
      and auth.uid() in (conversation.buyer_id, conversation.seller_id)
      and conversation.locked_at is null
      and not public.is_user_interaction_blocked(
        conversation.buyer_id, conversation.seller_id
      )
  )
);

drop policy if exists "recipient marks read" on public.messages;
create policy "recipient marks read" on public.messages
for update to authenticated using (
  public.is_conversation_participant(conversation_id)
);

drop policy if exists "participants read message attachments" on public.message_attachments;
create policy "participants read message attachments" on public.message_attachments
for select to authenticated using (
  deleted_at is null
  and public.is_conversation_participant(conversation_id)
  and not exists (
    select 1 from public.message_hidden_users as hidden
    where hidden.message_id = message_attachments.message_id
      and hidden.user_id = auth.uid()
  )
);

drop policy if exists "participants create message attachments" on public.message_attachments;
create policy "participants create message attachments" on public.message_attachments
for insert to authenticated with check (
  uploader_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
  and exists (
    select 1 from public.messages as message
    where message.id = message_id
      and message.conversation_id = conversation_id
      and message.sender_id = auth.uid()
      and message.deleted_for_everyone_at is null
  )
);

drop policy if exists "users hide messages for themselves" on public.message_hidden_users;
create policy "users hide messages for themselves" on public.message_hidden_users
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages as message
    where message.id = message_id
      and public.is_conversation_participant(message.conversation_id)
  )
);

drop policy if exists "users read own hidden messages" on public.message_hidden_users;
create policy "users read own hidden messages" on public.message_hidden_users
for select to authenticated using (user_id = auth.uid());

grant select, insert on public.message_attachments to authenticated;
grant select, insert on public.message_hidden_users to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'chat-attachments', 'chat-attachments', false, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat participants upload attachments" on storage.objects;
create policy "chat participants upload attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and exists (
    select 1 from public.conversations as conversation
    where conversation.id::text = (storage.foldername(name))[1]
      and auth.uid() in (conversation.buyer_id, conversation.seller_id)
      and conversation.locked_at is null
  )
);

drop policy if exists "chat participants read attachments" on storage.objects;
create policy "chat participants read attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and exists (
    select 1 from public.message_attachments as attachment
    join public.conversations as conversation
      on conversation.id = attachment.conversation_id
    where attachment.storage_path = name
      and attachment.deleted_at is null
      and auth.uid() in (conversation.buyer_id, conversation.seller_id)
      and not exists (
        select 1 from public.message_hidden_users as hidden
        where hidden.message_id = attachment.message_id
          and hidden.user_id = auth.uid()
      )
  )
);

drop policy if exists "chat uploaders delete failed attachments" on storage.objects;
create policy "chat uploaders delete failed attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create or replace function public.delete_message_for_me(target_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_conversation uuid;
begin
  select conversation_id into target_conversation
  from public.messages where id = target_message;
  if target_conversation is null then raise exception 'message_not_found'; end if;
  if not public.is_conversation_participant(target_conversation) then
    raise exception 'conversation_participant_required' using errcode = '42501';
  end if;
  insert into public.message_hidden_users(message_id, user_id)
  values (target_message, auth.uid()) on conflict do nothing;
end;
$$;

revoke all on function public.delete_message_for_me(uuid) from public;
grant execute on function public.delete_message_for_me(uuid) to authenticated;

create or replace function public.delete_message_for_everyone(
  target_message uuid,
  deletion_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  message_row public.messages%rowtype;
  delete_window integer := 1440;
  staff_override boolean := false;
begin
  select * into message_row from public.messages
  where id = target_message for update;
  if not found then raise exception 'message_not_found'; end if;

  staff_override := public.can_staff('users');
  if message_row.sender_id <> auth.uid() and not staff_override then
    raise exception 'message_sender_required' using errcode = '42501';
  end if;
  if staff_override and message_row.sender_id <> auth.uid()
     and char_length(trim(coalesce(deletion_note, ''))) < 3 then
    raise exception 'moderation_reason_required';
  end if;

  select coalesce(message_delete_window_minutes, 1440)
  into delete_window from public.platform_content where id = true;
  if not staff_override
     and message_row.created_at < now() - make_interval(mins => delete_window) then
    raise exception 'message_delete_window_expired';
  end if;

  update public.messages set
    body = '',
    deleted_for_everyone_at = now(),
    deleted_by = auth.uid(),
    deletion_reason = nullif(trim(deletion_note), '')
  where id = target_message;

  update public.message_attachments set
    deleted_at = now(), deleted_by = auth.uid()
  where message_id = target_message and deleted_at is null;

  insert into public.retention_jobs(
    target_type, target_id, execute_after, created_by
  )
  select 'message_attachment', attachment.id, now() + interval '7 days', auth.uid()
  from public.message_attachments as attachment
  where attachment.message_id = target_message
  on conflict (target_type, target_id) do update set
    execute_after = excluded.execute_after, state = 'queued', attempts = 0;

  if staff_override and message_row.sender_id <> auth.uid() then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (
      auth.uid(), 'message_removed_by_staff', 'message', target_message::text,
      jsonb_build_object('reason', trim(deletion_note))
    );
  end if;
end;
$$;

revoke all on function public.delete_message_for_everyone(uuid, text) from public;
grant execute on function public.delete_message_for_everyone(uuid, text)
to authenticated;

create or replace function public.abandon_message_upload(target_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.messages
  where id = target_message
    and sender_id = auth.uid()
    and message_type in ('attachment', 'mixed')
    and created_at > now() - interval '1 hour'
    and not exists (
      select 1 from public.message_attachments
      where message_id = target_message and upload_state = 'complete'
    );
end;
$$;

revoke all on function public.abandon_message_upload(uuid) from public;
grant execute on function public.abandon_message_upload(uuid) to authenticated;

commit;
