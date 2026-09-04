-- Additive: apply to staging first. Requires existing RojDeal Build5/Build8 schema.
begin;
create table if not exists public.web_support_messages (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.support_requests(id) on delete cascade,
 sender_id uuid references public.profiles(id) on delete set null,
 is_staff boolean not null,
 body text not null check(char_length(body) between 2 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists web_support_messages_request_time on public.web_support_messages(request_id,created_at);
alter table public.web_support_messages enable row level security;
revoke all on public.web_support_messages from anon,authenticated;
grant select on public.web_support_messages to authenticated;
drop policy if exists web_support_read on public.web_support_messages;
create policy web_support_read on public.web_support_messages for select to authenticated using (
 public.can_staff('support') or exists(select 1 from public.support_requests r where r.id=request_id and r.requester_id=auth.uid())
);
drop policy if exists web_staff_support_read on public.support_requests;
create policy web_staff_support_read on public.support_requests for select to authenticated using(public.can_staff('support'));

create or replace function public.web_notify_support_staff(target_request uuid,notification_body text)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(user_id,type,title,body,payload)
 select distinct p.id,'support_request','RojDeal Support',left(notification_body,2000),jsonb_build_object('support_request_id',target_request,'web_section','support')
 from public.profiles p where coalesce(p.is_suspended,false)=false and (
 exists(select 1 from public.platform_owners o where o.user_id=p.id) or p.role='admin'
 or exists(select 1 from public.staff_assignments a join public.staff_roles r on r.id=a.role_id join public.staff_role_permissions rp on rp.role_id=r.id
 where a.user_id=p.id and a.is_active and r.is_active and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) and rp.permission_key='support.manage')
 ) and p.id is distinct from auth.uid();
end; $$;
revoke all on function public.web_notify_support_staff(uuid,text) from public,anon,authenticated;
create or replace function public.web_new_support_notification()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.web_notify_support_staff(new.id,new.subject); return new; end; $$;
revoke all on function public.web_new_support_notification() from public,anon,authenticated;
drop trigger if exists web_new_support_notification on public.support_requests;
create trigger web_new_support_notification after insert on public.support_requests for each row execute function public.web_new_support_notification();

create or replace function public.web_reply_support(target_request uuid,message_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare ticket public.support_requests; staff boolean; result uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if exists(select 1 from public.profiles where id=auth.uid() and is_suspended) then raise exception 'account_suspended' using errcode='42501'; end if;
 select * into ticket from public.support_requests where id=target_request for update;
 if not found then raise exception 'request_not_found'; end if;
 staff := public.can_staff('support');
 if not staff and ticket.requester_id is distinct from auth.uid() then raise exception 'permission_denied' using errcode='42501'; end if;
 if char_length(trim(coalesce(message_body,''))) not between 2 and 2000 then raise exception 'invalid_message'; end if;
 if (select count(*) from public.web_support_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=10 then raise exception 'rate_limit'; end if;
 insert into public.web_support_messages(request_id,sender_id,is_staff,body) values(target_request,auth.uid(),staff,trim(message_body)) returning id into result;
 if staff then
  if ticket.requester_id is not null then
   insert into public.notifications(user_id,type,title,body,payload) values(ticket.requester_id,'support_reply','RojDeal Support',trim(message_body),jsonb_build_object('support_request_id',target_request));
  end if;
  update public.support_requests set state='reviewing',handled_by=auth.uid(),handled_at=now() where id=target_request;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details) values(auth.uid(),'support_replied','support_request',target_request::text,jsonb_build_object('message_id',result));
 else
  update public.support_requests set state='open' where id=target_request;
  perform public.web_notify_support_staff(target_request,ticket.subject);
 end if;
 return result;
end; $$;
revoke all on function public.web_reply_support(uuid,text) from public,anon;
grant execute on function public.web_reply_support(uuid,text) to authenticated;

-- Narrow RPC rather than granting support staff unrestricted UPDATE on tickets.
-- Existing application policies remain unchanged.
create or replace function public.web_update_support_request(
 target_request uuid, next_state text, decision_note text
) returns void language plpgsql security definer set search_path=public as $$
declare ticket public.support_requests;
begin
 if auth.uid() is null or not public.can_staff('support') then
  raise exception 'support_permission_required' using errcode='42501';
 end if;
 if exists(select 1 from public.profiles where id=auth.uid() and is_suspended) then
  raise exception 'account_suspended' using errcode='42501';
 end if;
 if next_state is null or next_state not in ('open','reviewing','resolved','closed') then
  raise exception 'invalid_support_state';
 end if;
 if char_length(trim(coalesce(decision_note,''))) not between 5 and 2000 then
  raise exception 'decision_note_required';
 end if;
 select * into ticket from public.support_requests where id=target_request for update;
 if not found then raise exception 'request_not_found'; end if;
 if ticket.state=next_state and coalesce(ticket.admin_note,'')=trim(decision_note) then return; end if;
 update public.support_requests set state=next_state,admin_note=trim(decision_note),
 handled_by=auth.uid(),handled_at=now() where id=target_request;
 insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
 values(auth.uid(),'support_state_changed','support_request',target_request::text,
 jsonb_build_object('previous_state',ticket.state,'state',next_state));
 if ticket.requester_id is not null and ticket.state is distinct from next_state then
  -- Do not expose the internal decision note to the requester.
  insert into public.notifications(user_id,type,title,body,payload)
  values(ticket.requester_id,'support_status','RojDeal Support',ticket.subject,
   jsonb_build_object('support_request_id',target_request,'state',next_state));
 end if;
end; $$;
revoke all on function public.web_update_support_request(uuid,text,text) from public,anon;
grant execute on function public.web_update_support_request(uuid,text,text) to authenticated;
commit;
