-- RojDeal 2026-08-15: administrator video carousel, account-upgrade
-- requests, and in-app support requests.

alter table public.platform_content
add column if not exists welcome_videos jsonb not null default '[]'::jsonb;
alter table public.platform_content
drop constraint if exists platform_content_welcome_videos_is_array;
alter table public.platform_content
add constraint platform_content_welcome_videos_is_array
check (
  jsonb_typeof(welcome_videos) = 'array'
  and jsonb_array_length(welcome_videos) <= 8
);
update public.platform_content
set welcome_videos = jsonb_build_array(
  jsonb_build_object('title', 'RojDeal', 'url', welcome_video_url)
)
where welcome_video_url <> ''
  and jsonb_array_length(welcome_videos) = 0;
create table if not exists public.promotion_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  contact_email text not null check (
    char_length(contact_email) between 5 and 320
  ),
  requested_tier text not null check (requested_tier in ('pro', 'gold')),
  location_node_ids bigint[] not null,
  duration_months integer not null check (duration_months in (1, 3, 6, 12)),
  payment_method text not null check (
    payment_method in ('cash', 'paypal', 'prepaid_code')
  ),
  note text check (note is null or char_length(note) <= 500),
  state text not null default 'pending' check (
    state in ('pending', 'contacted', 'approved', 'rejected', 'cancelled')
  ),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint promotion_requests_locations_required check (
    cardinality(location_node_ids) between 1 and 20
  )
);
create index if not exists promotion_requests_state_created_idx
on public.promotion_requests(state, created_at desc);
create index if not exists promotion_requests_requester_created_idx
on public.promotion_requests(requester_id, created_at desc);
alter table public.promotion_requests enable row level security;
drop policy if exists "users create own promotion requests"
on public.promotion_requests;
create policy "users create own promotion requests"
on public.promotion_requests for insert to authenticated
with check (requester_id = auth.uid() and state = 'pending');
drop policy if exists "users read own promotion requests"
on public.promotion_requests;
create policy "users read own promotion requests"
on public.promotion_requests for select to authenticated
using (requester_id = auth.uid() or public.is_admin());
drop policy if exists "admins update promotion requests"
on public.promotion_requests;
create policy "admins update promotion requests"
on public.promotion_requests for update to authenticated
using (public.is_admin())
with check (public.is_admin());
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  contact_email text not null check (
    char_length(contact_email) between 5 and 320
  ),
  category text not null check (
    category in ('login', 'listing', 'payment', 'safety', 'other')
  ),
  subject text not null check (char_length(subject) between 4 and 120),
  message text not null check (char_length(message) between 15 and 2000),
  state text not null default 'open' check (
    state in ('open', 'reviewing', 'resolved', 'closed')
  ),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_requests_state_created_idx
on public.support_requests(state, created_at desc);
create index if not exists support_requests_requester_created_idx
on public.support_requests(requester_id, created_at desc);
alter table public.support_requests enable row level security;
drop policy if exists "anyone creates support requests"
on public.support_requests;
create policy "anyone creates support requests"
on public.support_requests for insert to anon, authenticated
with check (
  state = 'open'
  and (requester_id is null or requester_id = auth.uid())
);
drop policy if exists "users read own support requests"
on public.support_requests;
create policy "users read own support requests"
on public.support_requests for select to authenticated
using (requester_id = auth.uid() or public.is_admin());
drop policy if exists "admins update support requests"
on public.support_requests;
create policy "admins update support requests"
on public.support_requests for update to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select, insert on public.promotion_requests to authenticated;
grant update on public.promotion_requests to authenticated;
grant insert on public.support_requests to anon, authenticated;
grant select, update on public.support_requests to authenticated;
