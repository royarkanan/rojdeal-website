-- RojDeal Build 5: generalized safety reports, recoverable account-deletion
-- requests and cleanup of abandoned listing uploads.

begin;
alter table public.platform_content
  add column if not exists account_deletion_grace_days integer not null default 7,
  add column if not exists require_legal_acceptance_on_publish boolean not null default true;
alter table public.platform_content
  drop constraint if exists platform_content_account_deletion_grace_days_check;
alter table public.platform_content
  add constraint platform_content_account_deletion_grace_days_check
  check (account_deletion_grace_days between 0 and 30);
create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing','user','message')),
  target_id uuid not null,
  reason_key text not null check (reason_key in (
    'spam','fraud','illegal','harassment','hate','sexual','violence',
    'privacy','misleading','duplicate','wrong_category','other'
  )),
  details text check (char_length(trim(details)) between 3 and 1500),
  state text not null default 'open'
    check (state in ('open','reviewing','resolved','dismissed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution_note text,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists safety_reports_one_open_per_target
on public.safety_reports(reporter_id,target_type,target_id)
where state in ('open','reviewing');
create index if not exists safety_reports_queue_idx
on public.safety_reports(state,created_at desc);
alter table public.safety_reports enable row level security;
drop policy if exists "reporters read own safety reports" on public.safety_reports;
create policy "reporters read own safety reports" on public.safety_reports
for select to authenticated using (
  reporter_id = auth.uid() or public.can_staff('reports')
);
drop policy if exists "report staff updates safety reports" on public.safety_reports;
create policy "report staff updates safety reports" on public.safety_reports
for update to authenticated using (public.can_staff('reports'))
with check (public.can_staff('reports'));
grant select, update on public.safety_reports to authenticated;
create or replace function public.submit_safety_report(
  report_target_type text,
  report_target_id uuid,
  report_reason text,
  report_details text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare report_id uuid;
declare target_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if report_target_type not in ('listing','user','message') then
    raise exception 'invalid_report_target';
  end if;
  if report_reason not in (
    'spam','fraud','illegal','harassment','hate','sexual','violence',
    'privacy','misleading','duplicate','wrong_category','other'
  ) then raise exception 'invalid_report_reason'; end if;
  if report_reason = 'other'
     and char_length(trim(coalesce(report_details,''))) < 3 then
    raise exception 'report_details_required';
  end if;

  if report_target_type = 'listing' then
    select owner_id into target_owner from public.listings
    where id = report_target_id and deleted_at is null;
  elsif report_target_type = 'user' then
    select id into target_owner from public.profiles where id = report_target_id;
  else
    select sender_id into target_owner from public.messages where id = report_target_id;
  end if;
  if target_owner is null then raise exception 'report_target_not_found'; end if;
  if target_owner = auth.uid() then raise exception 'cannot_report_own_content'; end if;

  insert into public.safety_reports(
    reporter_id,target_type,target_id,reason_key,details
  ) values (
    auth.uid(),report_target_type,report_target_id,report_reason,
    nullif(trim(report_details),'')
  ) returning id into report_id;
  return report_id;
end;
$$;
create or replace function public.resolve_safety_report(
  target_report uuid,
  new_state text,
  resolution_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_staff('reports') then
    raise exception 'report_permission_required' using errcode = '42501';
  end if;
  if new_state not in ('reviewing','resolved','dismissed') then
    raise exception 'invalid_report_state';
  end if;
  if new_state in ('resolved','dismissed')
     and char_length(trim(coalesce(resolution_reason,''))) < 3 then
    raise exception 'resolution_reason_required';
  end if;
  update public.safety_reports set
    state = new_state,
    resolution_note = nullif(trim(resolution_reason),''),
    handled_by = auth.uid(),
    handled_at = case when new_state in ('resolved','dismissed') then now() else null end,
    updated_at = now()
  where id = target_report;
  if not found then raise exception 'report_not_found'; end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'safety_report_' || new_state,'safety_report',target_report::text,
    jsonb_build_object('reason',nullif(trim(resolution_reason),'')));
end;
$$;
revoke all on function public.submit_safety_report(text,uuid,text,text) from public;
revoke all on function public.resolve_safety_report(uuid,text,text) from public;
grant execute on function public.submit_safety_report(text,uuid,text,text) to authenticated;
grant execute on function public.resolve_safety_report(uuid,text,text) to authenticated;
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  state text not null default 'pending'
    check (state in ('pending','cancelled','held','processing','completed','failed')),
  reason text,
  requested_at timestamptz not null default now(),
  execute_after timestamptz not null,
  cancelled_at timestamptz,
  legal_hold boolean not null default false,
  legal_hold_reason text,
  held_by uuid references public.profiles(id) on delete set null,
  held_at timestamptz,
  processed_at timestamptz,
  last_error text
);
create unique index if not exists account_deletion_one_pending
on public.account_deletion_requests(user_id)
where state in ('pending','held','processing');
create index if not exists account_deletion_due_idx
on public.account_deletion_requests(state,execute_after)
where state = 'pending';
alter table public.profiles
  add column if not exists account_deletion_pending boolean not null default false,
  add column if not exists account_deletion_requested_at timestamptz;
alter table public.account_deletion_requests enable row level security;
drop policy if exists "users read own deletion request" on public.account_deletion_requests;
create policy "users read own deletion request" on public.account_deletion_requests
for select to authenticated using (
  user_id = auth.uid() or public.has_staff_permission('legal.manage')
);
grant select on public.account_deletion_requests to authenticated;
create or replace function public.request_own_account_deletion(
  deletion_reason text default null
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare target_user uuid := auth.uid();
declare grace_days integer := 7;
declare due_at timestamptz;
begin
  if target_user is null then raise exception 'authentication_required'; end if;
  if exists(select 1 from public.platform_owners where user_id = target_user)
     or public.is_staff() then
    raise exception 'staff_account_requires_owner_review' using errcode = '42501';
  end if;
  select account_deletion_grace_days into grace_days
  from public.platform_content where id = true;
  due_at := now() + make_interval(days => coalesce(grace_days,7));
  insert into public.account_deletion_requests(
    user_id,state,reason,requested_at,execute_after
  ) values (
    target_user,'pending',nullif(trim(deletion_reason),''),now(),due_at
  );
  update public.profiles set
    account_deletion_pending = true,
    account_deletion_requested_at = now()
  where id = target_user;
  update public.listings set state = 'hidden'::public.listing_state,
    updated_at = now()
  where owner_id = target_user and state::text in ('published','reserved');
  return due_at;
end;
$$;
create or replace function public.cancel_own_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.account_deletion_requests
  set state = 'cancelled', cancelled_at = now()
  where user_id = auth.uid() and state = 'pending' and execute_after > now();
  if not found then raise exception 'no_cancellable_deletion_request'; end if;
  update public.profiles set account_deletion_pending = false,
    account_deletion_requested_at = null where id = auth.uid();
end;
$$;
create or replace function public.set_account_deletion_legal_hold(
  target_request uuid,
  hold_enabled boolean,
  hold_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_staff_permission('legal.manage') and not public.is_platform_owner() then
    raise exception 'legal_permission_required' using errcode = '42501';
  end if;
  if hold_enabled and char_length(trim(coalesce(hold_reason,''))) < 3 then
    raise exception 'legal_hold_reason_required';
  end if;
  update public.account_deletion_requests set
    state = case when hold_enabled then 'held' else 'pending' end,
    legal_hold = hold_enabled,
    legal_hold_reason = case when hold_enabled then trim(hold_reason) else null end,
    held_by = case when hold_enabled then auth.uid() else null end,
    held_at = case when hold_enabled then now() else null end
  where id = target_request and state in ('pending','held');
  if not found then raise exception 'deletion_request_not_found'; end if;
end;
$$;
revoke all on function public.request_own_account_deletion(text) from public;
revoke all on function public.cancel_own_account_deletion() from public;
revoke all on function public.set_account_deletion_legal_hold(uuid,boolean,text) from public;
grant execute on function public.request_own_account_deletion(text) to authenticated;
grant execute on function public.cancel_own_account_deletion() to authenticated;
grant execute on function public.set_account_deletion_legal_hold(uuid,boolean,text) to authenticated;
create or replace function public.discard_incomplete_listing(target_listing uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare target_owner uuid;
begin
  select owner_id into target_owner from public.listings
  where id = target_listing and state::text = 'draft' for update;
  if target_owner is null then return; end if;
  if target_owner <> auth.uid() and not public.can_staff('listings') then
    raise exception 'listing_owner_required' using errcode = '42501';
  end if;
  delete from storage.objects
  where bucket_id in ('listing-images','listing-videos')
    and name like target_owner::text || '/' || target_listing::text || '/%';
  delete from public.listings where id = target_listing;
end;
$$;
revoke all on function public.discard_incomplete_listing(uuid) from public;
grant execute on function public.discard_incomplete_listing(uuid) to authenticated;
commit;
