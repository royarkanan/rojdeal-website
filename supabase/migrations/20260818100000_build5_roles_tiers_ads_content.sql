-- RojDeal Build 5: scoped administration, editable tiers/payments, scheduled
-- platform media and provider-independent advertising.

begin;
-- -------------------------------------------------------------------------
-- Role catalog and scoped assignments. platform_owners remains the immutable
-- owner source of truth and is never represented by a client-editable role.
-- -------------------------------------------------------------------------
create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique check (role_key ~ '^[a-z0-9_]{2,80}$'),
  names jsonb not null default '{}'::jsonb,
  rank integer not null default 1000,
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(names) = 'object')
);
create table if not exists public.staff_role_permissions (
  role_id uuid not null references public.staff_roles(id) on delete cascade,
  permission_key text not null check (permission_key ~ '^[a-z0-9_.]{2,100}$'),
  primary key (role_id, permission_key)
);
create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.staff_roles(id) on delete restrict,
  market_id uuid references public.markets(id) on delete cascade,
  location_node_id bigint references public.location_nodes(id) on delete cascade,
  category_id uuid references public.listing_categories_config(id) on delete cascade,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assignment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);
create unique index if not exists staff_assignments_unique_scope
on public.staff_assignments(
  user_id, role_id,
  coalesce(market_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(location_node_id, -1),
  coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where is_active;
insert into public.staff_roles(role_key, names, rank) values
  ('general_manager', '{"ar":"مدير عام","ku":"Rêveberê giştî","en":"General manager","de":"Geschäftsleitung"}', 10),
  ('admin', '{"ar":"أدمن","ku":"Rêveber","en":"Administrator","de":"Administrator"}', 20),
  ('moderator', '{"ar":"مشرف محتوى","ku":"Çavdêr","en":"Moderator","de":"Moderator"}', 30),
  ('media_reviewer', '{"ar":"مراجع وسائط","ku":"Kontrolkerê medyayê","en":"Media reviewer","de":"Medienprüfung"}', 40),
  ('support_agent', '{"ar":"دعم المستخدمين","ku":"Piştgiriya bikarhêneran","en":"Support agent","de":"Support"}', 50),
  ('location_manager', '{"ar":"مدير المواقع","ku":"Rêveberê cihan","en":"Location manager","de":"Standortverwaltung"}', 60),
  ('catalog_manager', '{"ar":"مدير الأقسام","ku":"Rêveberê kategoriyan","en":"Catalog manager","de":"Katalogverwaltung"}', 70),
  ('legal_editor', '{"ar":"مدقق قانوني ولغوي","ku":"Edîtorê qanûnî û zimanî","en":"Legal/content editor","de":"Rechts-/Textredaktion"}', 80),
  ('advertising_manager', '{"ar":"مدير الإعلانات","ku":"Rêveberê reklamê","en":"Advertising manager","de":"Werbeverwaltung"}', 90),
  ('finance_manager', '{"ar":"مدير الترقيات والدفع","ku":"Rêveberê pere û pakêtan","en":"Finance manager","de":"Zahlungsverwaltung"}', 100)
on conflict (role_key) do update set
  names = excluded.names, rank = excluded.rank;
with role_permissions(role_key, permission_key) as (values
  ('general_manager','staff.assign'), ('general_manager','listings.manage'),
  ('general_manager','reports.manage'), ('general_manager','locations.manage'),
  ('general_manager','users.manage'), ('general_manager','media.review'),
  ('general_manager','support.manage'), ('general_manager','catalog.manage'),
  ('general_manager','legal.manage'), ('general_manager','ads.manage'),
  ('general_manager','tiers.manage'), ('general_manager','audit.read'),
  ('general_manager','platform_content.manage'),
  ('admin','listings.manage'), ('admin','reports.manage'),
  ('admin','locations.manage'), ('admin','users.manage'),
  ('admin','media.review'), ('admin','support.manage'),
  ('admin','catalog.manage'), ('admin','audit.read'),
  ('admin','platform_content.manage'),
  ('moderator','listings.manage'), ('moderator','reports.manage'),
  ('moderator','audit.read'),
  ('media_reviewer','media.review'), ('media_reviewer','platform_content.manage'),
  ('support_agent','support.manage'),
  ('location_manager','locations.manage'),
  ('catalog_manager','catalog.manage'), ('catalog_manager','listings.manage'),
  ('legal_editor','legal.manage'), ('legal_editor','platform_content.manage'),
  ('advertising_manager','ads.manage'), ('advertising_manager','platform_content.manage'),
  ('finance_manager','tiers.manage')
)
insert into public.staff_role_permissions(role_id, permission_key)
select role.id, mapping.permission_key
from role_permissions as mapping
join public.staff_roles as role on role.role_key = mapping.role_key
on conflict do nothing;
alter table public.staff_roles enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_assignments enable row level security;
create or replace function public.has_staff_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_owner() or exists (
    select 1
    from public.staff_assignments as assignment
    join public.staff_roles as role on role.id = assignment.role_id
    join public.staff_role_permissions as permission on permission.role_id = role.id
    where assignment.user_id = auth.uid()
      and assignment.is_active and role.is_active
      and assignment.starts_at <= now()
      and (assignment.expires_at is null or assignment.expires_at > now())
      and permission.permission_key = permission_name
  );
$$;
revoke all on function public.has_staff_permission(text) from public;
grant execute on function public.has_staff_permission(text) to authenticated;
create or replace function public.can_staff(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_owner()
  or public.has_staff_permission(case permission_name
    when 'listings' then 'listings.manage'
    when 'reports' then 'reports.manage'
    when 'locations' then 'locations.manage'
    when 'users' then 'users.manage'
    when 'media' then 'media.review'
    when 'support' then 'support.manage'
    when 'catalog' then 'catalog.manage'
    when 'legal' then 'legal.manage'
    when 'ads' then 'ads.manage'
    when 'tiers' then 'tiers.manage'
    else permission_name end)
  or exists (
    select 1
    from public.profiles as profile
    left join public.staff_permissions as legacy on legacy.user_id = profile.id
    where profile.id = auth.uid()
      and profile.role in ('moderator','admin')
      and coalesce(profile.is_suspended, false) = false
      and coalesce(legacy.is_suspended, false) = false
      and (
        profile.role = 'admin'
        or (permission_name = 'listings' and legacy.can_manage_listings)
        or (permission_name = 'reports' and legacy.can_manage_reports)
        or (permission_name = 'locations' and legacy.can_manage_locations)
        or (permission_name = 'users' and legacy.can_manage_users)
        or (permission_name = 'media' and legacy.can_review_media)
      )
  );
$$;
drop policy if exists "staff reads role catalog" on public.staff_roles;
create policy "staff reads role catalog" on public.staff_roles
for select to authenticated using (public.is_staff());
drop policy if exists "staff reads permission catalog" on public.staff_role_permissions;
create policy "staff reads permission catalog" on public.staff_role_permissions
for select to authenticated using (public.is_staff());
drop policy if exists "staff reads relevant assignments" on public.staff_assignments;
create policy "staff reads relevant assignments" on public.staff_assignments
for select to authenticated using (
  user_id = auth.uid() or public.has_staff_permission('staff.assign')
);
drop policy if exists "owner manages role catalog" on public.staff_roles;
create policy "owner manages role catalog" on public.staff_roles
for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
drop policy if exists "owner manages permission catalog" on public.staff_role_permissions;
create policy "owner manages permission catalog" on public.staff_role_permissions
for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
grant select on public.staff_roles, public.staff_role_permissions,
  public.staff_assignments to authenticated;
create or replace function public.assign_scoped_staff_role(
  target_user uuid,
  target_role_key text,
  target_market uuid default null,
  target_location bigint default null,
  target_category uuid default null,
  assignment_expires_at timestamptz default null,
  note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  role_row public.staff_roles%rowtype;
  assignment_id uuid;
  actor_is_owner boolean := public.is_platform_owner();
  actor_is_manager boolean := public.has_staff_permission('staff.assign');
begin
  if not actor_is_owner and not actor_is_manager then
    raise exception 'staff_assignment_permission_required' using errcode = '42501';
  end if;
  if exists (select 1 from public.platform_owners where user_id = target_user) then
    raise exception 'owner_account_cannot_be_modified' using errcode = '42501';
  end if;
  select * into role_row from public.staff_roles
  where role_key = target_role_key and is_active;
  if not found then raise exception 'staff_role_not_found'; end if;
  if role_row.role_key = 'general_manager' and not actor_is_owner then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;
  if assignment_expires_at is not null and assignment_expires_at <= now() then
    raise exception 'invalid_assignment_expiry';
  end if;

  insert into public.staff_assignments(
    user_id, role_id, market_id, location_node_id, category_id,
    expires_at, assigned_by, assignment_note
  ) values (
    target_user, role_row.id, target_market, target_location, target_category,
    assignment_expires_at, auth.uid(), nullif(trim(note), '')
  ) returning id into assignment_id;

  update public.profiles
  set role = case when role_row.rank <= 20 then 'admin'::public.user_role
                  else 'moderator'::public.user_role end
  where id = target_user and role = 'user';

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (
    auth.uid(), 'staff_role_assigned', 'staff_assignment', assignment_id::text,
    jsonb_build_object('user_id', target_user, 'role', target_role_key,
      'market_id', target_market, 'location_node_id', target_location,
      'category_id', target_category, 'expires_at', assignment_expires_at,
      'note', nullif(trim(note), ''))
  );
  return assignment_id;
end;
$$;
create or replace function public.remove_staff_assignment(
  target_assignment uuid,
  removal_note text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare assignment_row public.staff_assignments%rowtype;
declare role_key_value text;
begin
  if char_length(trim(coalesce(removal_note, ''))) < 3 then
    raise exception 'removal_reason_required';
  end if;
  select assignment.*
  into assignment_row
  from public.staff_assignments as assignment
  where assignment.id = target_assignment for update;
  if not found then raise exception 'staff_assignment_not_found'; end if;
  select role_key into role_key_value
  from public.staff_roles where id = assignment_row.role_id;
  if exists (select 1 from public.platform_owners where user_id = assignment_row.user_id) then
    raise exception 'owner_account_cannot_be_modified' using errcode = '42501';
  end if;
  if role_key_value = 'general_manager' and not public.is_platform_owner() then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;
  if not public.is_platform_owner() and not public.has_staff_permission('staff.assign') then
    raise exception 'staff_assignment_permission_required' using errcode = '42501';
  end if;

  update public.staff_assignments
  set is_active = false, updated_at = now(), assignment_note = concat_ws(
    E'\n', nullif(assignment_note, ''), 'Removed: ' || trim(removal_note)
  ) where id = target_assignment;

  if not exists (
    select 1 from public.staff_assignments
    where user_id = assignment_row.user_id and is_active
      and starts_at <= now() and (expires_at is null or expires_at > now())
  ) then
    update public.profiles set role = 'user'::public.user_role
    where id = assignment_row.user_id;
    delete from public.staff_permissions where user_id = assignment_row.user_id;
  end if;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (
    auth.uid(), 'staff_role_removed', 'staff_assignment', target_assignment::text,
    jsonb_build_object('user_id', assignment_row.user_id,
      'role', role_key_value, 'reason', trim(removal_note))
  );
end;
$$;
revoke all on function public.assign_scoped_staff_role(uuid,text,uuid,bigint,uuid,timestamptz,text) from public;
revoke all on function public.remove_staff_assignment(uuid,text) from public;
grant execute on function public.assign_scoped_staff_role(uuid,text,uuid,bigint,uuid,timestamptz,text) to authenticated;
grant execute on function public.remove_staff_assignment(uuid,text) to authenticated;
-- -------------------------------------------------------------------------
-- Editable tier catalog, subscriptions, managers and payment switches.
-- -------------------------------------------------------------------------
create table if not exists public.tier_plans (
  tier_key text primary key check (tier_key in ('standard','pro','gold')),
  names jsonb not null default '{}'::jsonb,
  descriptions jsonb not null default '{}'::jsonb,
  benefits jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  listing_limit integer,
  analytics_level text not null default 'basic'
    check (analytics_level in ('none','basic','advanced')),
  manager_channel text not null default 'none'
    check (manager_channel in ('none','messages','email','phone')),
  sort_order integer not null default 1000,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(names) = 'object'),
  check (jsonb_typeof(descriptions) = 'object'),
  check (jsonb_typeof(benefits) = 'array')
);
insert into public.tier_plans(
  tier_key, names, descriptions, benefits, is_active,
  listing_limit, analytics_level, manager_channel, sort_order
) values
  ('standard',
   '{"ar":"عادي","ku":"Standard","en":"Standard","de":"Standard"}',
   '{"ar":"الحساب الأساسي المجاني","ku":"Hesabê bingehîn","en":"Basic account","de":"Basiskonto"}',
   '["core_listings","favorites","chat"]', true, 5, 'basic', 'none', 10),
  ('pro',
   '{"ar":"برو","ku":"PRO","en":"PRO","de":"PRO"}',
   '{"ar":"أدوات إضافية وإحصائيات ودعم بالرسائل والبريد","ku":"Amûr, statîstîk û piştgirî bi peyam û e-name","en":"Additional tools, analytics and message/email support","de":"Zusätzliche Werkzeuge, Statistiken und Support per Nachricht/E-Mail"}',
   '["higher_listing_limit","basic_analytics","message_support","email_support"]', true, null, 'basic', 'email', 20),
  ('gold',
   '{"ar":"غولد","ku":"GOLD","en":"GOLD","de":"GOLD"}',
   '{"ar":"مزايا متقدمة وإحصائيات موسعة ومدير حساب","ku":"Taybetmendiyên pêşketî, statîstîk û rêveberê hesabê","en":"Advanced features, analytics and account manager","de":"Erweiterte Funktionen, Statistiken und Account-Manager"}',
   '["unlimited_listings","advanced_analytics","priority_support","account_manager"]', true, null, 'advanced', 'phone', 30)
on conflict (tier_key) do update set
  names = excluded.names,
  descriptions = excluded.descriptions,
  benefits = excluded.benefits,
  sort_order = excluded.sort_order;
create table if not exists public.payment_method_config (
  method_key text primary key check (method_key ~ '^[a-z0-9_]{2,80}$'),
  names jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default false,
  channel text not null check (channel in ('store','manual','external')),
  platform_scope text not null default 'all'
    check (platform_scope in ('all','android','ios','web','apk')),
  requires_admin_review boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 1000,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(names) = 'object'),
  check (jsonb_typeof(settings) = 'object')
);
insert into public.payment_method_config(
  method_key, names, is_enabled, channel, platform_scope,
  requires_admin_review, sort_order
) values
  ('apple_iap', '{"ar":"الدفع عبر App Store","ku":"Bi App Store","en":"App Store billing","de":"App-Store-Zahlung"}', false, 'store', 'ios', false, 10),
  ('google_play_billing', '{"ar":"الدفع عبر Google Play","ku":"Bi Google Play","en":"Google Play billing","de":"Google-Play-Zahlung"}', false, 'store', 'android', false, 20),
  ('cash_office', '{"ar":"نقدًا في مكتب RojDeal","ku":"Drav li ofîsa RojDeal","en":"Cash at RojDeal office","de":"Barzahlung im RojDeal-Büro"}', false, 'manual', 'web', true, 30),
  ('paypal', '{"ar":"PayPal","ku":"PayPal","en":"PayPal","de":"PayPal"}', false, 'external', 'web', true, 40),
  ('prepaid_code', '{"ar":"كود مسبق الدفع","ku":"Koda pêşdane","en":"Prepaid code","de":"Prepaid-Code"}', false, 'manual', 'all', true, 50)
on conflict (method_key) do update set
  names = excluded.names, channel = excluded.channel,
  platform_scope = excluded.platform_scope, sort_order = excluded.sort_order;
create table if not exists public.account_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_key text not null references public.tier_plans(tier_key),
  status text not null default 'pending'
    check (status in ('pending','active','paused','expired','cancelled','revoked')),
  starts_at timestamptz,
  expires_at timestamptz,
  source text not null default 'admin'
    check (source in ('admin','apple','google','manual','promo')),
  external_reference text,
  manager_user_id uuid references public.profiles(id) on delete set null,
  activated_by uuid references public.profiles(id) on delete set null,
  activation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);
create unique index if not exists account_subscriptions_one_active
on public.account_subscriptions(user_id)
where status = 'active';
alter table public.promotion_requests
  add column if not exists subscription_id uuid
    references public.account_subscriptions(id) on delete set null,
  add column if not exists payment_reference text,
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','pending','paid','refunded','waived'));
alter table public.tier_plans enable row level security;
alter table public.payment_method_config enable row level security;
alter table public.account_subscriptions enable row level security;
drop policy if exists "active tier plans public read" on public.tier_plans;
create policy "active tier plans public read" on public.tier_plans
for select using (is_active or public.can_staff('tiers'));
drop policy if exists "enabled payment methods public read" on public.payment_method_config;
create policy "enabled payment methods public read" on public.payment_method_config
for select using (is_enabled or public.can_staff('tiers'));
drop policy if exists "tier staff manages plans" on public.tier_plans;
create policy "tier staff manages plans" on public.tier_plans
for all to authenticated using (public.can_staff('tiers')) with check (public.can_staff('tiers'));
drop policy if exists "tier staff manages payment methods" on public.payment_method_config;
create policy "tier staff manages payment methods" on public.payment_method_config
for all to authenticated using (public.can_staff('tiers')) with check (public.can_staff('tiers'));
drop policy if exists "users read own subscriptions" on public.account_subscriptions;
create policy "users read own subscriptions" on public.account_subscriptions
for select to authenticated using (user_id = auth.uid() or public.can_staff('tiers'));
grant select on public.tier_plans, public.payment_method_config
to anon, authenticated;
grant insert, update, delete on public.tier_plans, public.payment_method_config
to authenticated;
grant select, insert, update on public.account_subscriptions to authenticated;
create or replace function public.activate_account_subscription(
  target_user uuid,
  target_tier text,
  duration_months integer,
  manager_user uuid default null,
  activation_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare subscription_id uuid;
declare start_time timestamptz := now();
begin
  if not public.can_staff('tiers') then
    raise exception 'tier_management_permission_required' using errcode = '42501';
  end if;
  if target_tier not in ('standard','pro','gold') then raise exception 'invalid_tier'; end if;
  if duration_months not between 1 and 36 then raise exception 'invalid_duration'; end if;
  if target_tier = 'standard' then
    update public.account_subscriptions set status = 'revoked', updated_at = now()
    where user_id = target_user and status = 'active';
    update public.profiles set account_tier = 'standard', promotion_location_node_id = null
    where id = target_user;
    insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
    values(auth.uid(),'account_tier_removed','profile',target_user::text,
      jsonb_build_object('reason',nullif(trim(activation_reason),'')));
    return null;
  end if;

  update public.account_subscriptions set status = 'revoked', updated_at = now()
  where user_id = target_user and status = 'active';

  insert into public.account_subscriptions(
    user_id, tier_key, status, starts_at, expires_at, source,
    manager_user_id, activated_by, activation_note
  ) values (
    target_user, target_tier, 'active', start_time,
    start_time + make_interval(months => duration_months), 'admin',
    manager_user, auth.uid(), nullif(trim(activation_reason), '')
  ) returning id into subscription_id;

  update public.profiles set account_tier = target_tier where id = target_user;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'account_tier_activated','profile',target_user::text,
    jsonb_build_object('tier',target_tier,'months',duration_months,
      'manager_user_id',manager_user,'subscription_id',subscription_id,
      'reason',nullif(trim(activation_reason),'')));
  return subscription_id;
end;
$$;
revoke all on function public.activate_account_subscription(uuid,text,integer,uuid,text) from public;
grant execute on function public.activate_account_subscription(uuid,text,integer,uuid,text) to authenticated;
-- -------------------------------------------------------------------------
-- Scheduled platform videos/images/PDFs. Visibility automatically follows
-- start_at/end_at. Styling makes video titles readable and admin-configurable.
-- -------------------------------------------------------------------------
create table if not exists public.platform_media_items (
  id uuid primary key default gen_random_uuid(),
  placement_key text not null default 'home_carousel',
  media_type text not null check (media_type in ('video','image','pdf')),
  titles jsonb not null default '{}'::jsonb,
  media_url text not null check (char_length(trim(media_url)) between 8 and 2000),
  destination_url text,
  is_active boolean not null default true,
  start_at timestamptz,
  end_at timestamptz,
  sort_order integer not null default 1000,
  display_style jsonb not null default
    '{"titlePlacement":"overlayTop","titleSize":"medium","titleTheme":"brand","titleAnimation":"static","autoAdvance":true,"loopPlaylist":true,"autoPlay":false,"controlsAutoHideSeconds":3}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(titles) = 'object'),
  check (jsonb_typeof(display_style) = 'object'),
  check (end_at is null or start_at is null or end_at > start_at)
);
alter table public.platform_content
  drop constraint if exists platform_content_welcome_videos_is_array;
alter table public.platform_content
  add constraint platform_content_welcome_videos_is_array check (
    jsonb_typeof(welcome_videos) = 'array'
    and jsonb_array_length(welcome_videos) <= 20
  );
alter table public.platform_media_items
  drop constraint if exists platform_media_items_display_style_valid;
alter table public.platform_media_items
  add constraint platform_media_items_display_style_valid check (
    coalesce(display_style->>'titlePlacement', 'overlayTop') in
      ('above','below','overlayTop','overlayBottom','hidden')
    and coalesce(display_style->>'titleSize', 'medium') in
      ('small','medium','large')
    and coalesce(display_style->>'titleTheme', 'brand') in
      ('brand','dark','light','red','yellow','green')
    and coalesce(display_style->>'titleAnimation', 'static') in
      ('static','fade','slide','appearThenHide')
    and coalesce(display_style->>'autoAdvance', 'true') in ('true','false')
    and coalesce(display_style->>'loopPlaylist', 'true') in ('true','false')
    and coalesce(display_style->>'autoPlay', 'false') in ('true','false')
    and coalesce((display_style->>'controlsAutoHideSeconds')::integer, 3)
      between 1 and 15
  );
insert into public.platform_media_items(
  placement_key, media_type, titles, media_url, sort_order, display_style
)
select
  'home_carousel', 'video',
  jsonb_build_object(
    'ar', trim(video.item->>'title'),
    'ku', trim(video.item->>'title'),
    'en', trim(video.item->>'title'),
    'de', trim(video.item->>'title')
  ),
  trim(video.item->>'url'), (video.position::integer - 1) * 10,
  '{"titlePlacement":"overlayTop","titleSize":"medium","titleTheme":"brand","titleAnimation":"static","autoAdvance":true,"loopPlaylist":true,"autoPlay":false,"controlsAutoHideSeconds":3}'::jsonb
from public.platform_content as content
cross join lateral jsonb_array_elements(content.welcome_videos)
  with ordinality as video(item, position)
where content.id = true
  and char_length(trim(coalesce(video.item->>'url',''))) between 8 and 2000
  and not exists (
    select 1 from public.platform_media_items
    where placement_key = 'home_carousel' and media_type = 'video'
  );
create index if not exists platform_media_schedule_idx
on public.platform_media_items(placement_key, is_active, start_at, end_at, sort_order);
alter table public.platform_media_items enable row level security;
drop policy if exists "scheduled platform media public read" on public.platform_media_items;
create policy "scheduled platform media public read" on public.platform_media_items
for select using (
  public.can_staff('platform_content.manage') or (
    is_active and (start_at is null or start_at <= now())
    and (end_at is null or end_at > now())
  )
);
drop policy if exists "admins manage platform media" on public.platform_media_items;
create policy "admins manage platform media" on public.platform_media_items
for all to authenticated using (public.can_staff('platform_content.manage'))
with check (public.can_staff('platform_content.manage'));
grant select on public.platform_media_items to anon, authenticated;
grant insert, update, delete on public.platform_media_items to authenticated;
create or replace function public.replace_home_platform_videos(items jsonb)
returns setof public.platform_media_items
language plpgsql
security definer
set search_path = public
as $$
declare item jsonb;
declare item_id uuid;
declare retained_ids uuid[] := '{}';
declare style jsonb;
begin
  if not public.can_staff('platform_content.manage') then
    raise exception 'platform_content_permission_required' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 20 then
    raise exception 'invalid_platform_video_list';
  end if;

  for item in select value from jsonb_array_elements(items)
  loop
    if char_length(trim(coalesce(item->>'media_url',''))) not between 8 and 2000
      or jsonb_typeof(coalesce(item->'titles','{}'::jsonb)) <> 'object' then
      raise exception 'invalid_platform_video';
    end if;
    style := coalesce(item->'display_style', '{}'::jsonb);
    item_id := nullif(item->>'id','')::uuid;
    if item_id is null then item_id := gen_random_uuid(); end if;
    retained_ids := array_append(retained_ids, item_id);
    insert into public.platform_media_items(
      id, placement_key, media_type, titles, media_url, is_active,
      start_at, end_at, sort_order, display_style, created_by, updated_by
    ) values (
      item_id, 'home_carousel', 'video', item->'titles', trim(item->>'media_url'),
      coalesce((item->>'is_active')::boolean, true),
      nullif(item->>'start_at','')::timestamptz,
      nullif(item->>'end_at','')::timestamptz,
      coalesce((item->>'sort_order')::integer, 1000),
      style, auth.uid(), auth.uid()
    ) on conflict (id) do update set
      titles = excluded.titles, media_url = excluded.media_url,
      is_active = excluded.is_active, start_at = excluded.start_at,
      end_at = excluded.end_at, sort_order = excluded.sort_order,
      display_style = excluded.display_style, updated_by = auth.uid(),
      updated_at = now()
    where public.platform_media_items.placement_key = 'home_carousel'
      and public.platform_media_items.media_type = 'video';
  end loop;

  delete from public.platform_media_items
  where placement_key = 'home_carousel' and media_type = 'video'
    and not (id = any(retained_ids));

  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'platform_videos_replaced','platform_media','home_carousel',
    jsonb_build_object('count',cardinality(retained_ids)));

  return query select * from public.platform_media_items
  where placement_key = 'home_carousel' and media_type = 'video'
  order by sort_order, created_at;
end;
$$;
revoke all on function public.replace_home_platform_videos(jsonb) from public;
grant execute on function public.replace_home_platform_videos(jsonb) to authenticated;
-- -------------------------------------------------------------------------
-- Provider-independent advertising. All placements are disabled by default.
-- -------------------------------------------------------------------------
alter table public.platform_content
  add column if not exists advertising_enabled boolean not null default false,
  add column if not exists direct_ads_enabled boolean not null default false,
  add column if not exists external_ads_enabled boolean not null default false,
  add column if not exists admob_enabled boolean not null default false,
  add column if not exists ad_consent_enabled boolean not null default false,
  add column if not exists ad_settings jsonb not null default '{}'::jsonb;
create table if not exists public.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  contact jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','paused','blocked','archived')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(contact) = 'object')
);
create table if not exists public.ad_placements (
  placement_key text primary key,
  is_enabled boolean not null default false,
  provider_mode text not null default 'direct'
    check (provider_mode in ('direct','external','mixed')),
  fallback_mode text not null default 'direct_or_none'
    check (fallback_mode in ('direct_or_none','none')),
  insert_after_count integer check (insert_after_count between 1 and 100),
  frequency_cap_count integer not null default 3 check (frequency_cap_count between 0 and 100),
  frequency_cap_minutes integer not null default 60 check (frequency_cap_minutes between 1 and 10080),
  external_config_key text,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(settings) = 'object')
);
insert into public.ad_placements(
  placement_key, is_enabled, provider_mode, insert_after_count
) values
  ('home_feed', false, 'mixed', 8),
  ('search_feed', false, 'mixed', 10),
  ('category_feed', false, 'mixed', 10),
  ('listing_detail', false, 'direct', null),
  ('interstitial', false, 'external', null)
on conflict (placement_key) do nothing;
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 160),
  status text not null default 'draft'
    check (status in ('draft','scheduled','active','paused','ended','cancelled')),
  start_at timestamptz,
  end_at timestamptz,
  campaign_type text not null default 'direct'
    check (campaign_type in ('direct','sponsored_listing','internal')),
  destination_type text not null default 'url'
    check (destination_type in ('url','listing','internal_route','none')),
  destination_url text,
  listing_id uuid references public.listings(id) on delete set null,
  internal_route text,
  target_market_ids uuid[] not null default '{}',
  target_location_ids bigint[] not null default '{}',
  target_category_ids uuid[] not null default '{}',
  supported_languages text[] not null default array['ar','ku','en','de'],
  placement_keys text[] not null default '{}',
  priority integer not null default 100,
  impression_limit bigint,
  click_limit bigint,
  revenue_amount numeric(16,2),
  revenue_currency text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at),
  check (impression_limit is null or impression_limit > 0),
  check (click_limit is null or click_limit > 0)
);
create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  creative_type text not null check (creative_type in ('image','native','banner','video')),
  media_url text not null default '',
  headline text not null default '',
  body text not null default '',
  call_to_action text not null default '',
  language text not null check (language in ('ar','ku','en','de')),
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_url <> '' or headline <> '')
);
create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  creative_id uuid references public.ad_creatives(id) on delete set null,
  placement_key text not null references public.ad_placements(placement_key),
  event_type text not null check (event_type in ('impression','click')),
  actor_key text not null,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (campaign_id, placement_key, event_type, actor_key, occurred_on)
);
create index if not exists ad_campaigns_schedule_idx
on public.ad_campaigns(status, start_at, end_at, priority);
create index if not exists ad_events_campaign_idx
on public.ad_events(campaign_id, event_type, created_at desc);
alter table public.advertisers enable row level security;
alter table public.ad_placements enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_events enable row level security;
drop policy if exists "public reads enabled ad placements" on public.ad_placements;
create policy "public reads enabled ad placements" on public.ad_placements
for select using (is_enabled or public.can_staff('ads'));
drop policy if exists "public reads active ad campaigns" on public.ad_campaigns;
create policy "public reads active ad campaigns" on public.ad_campaigns
for select using (
  public.can_staff('ads') or (
    status in ('scheduled','active')
    and (start_at is null or start_at <= now())
    and (end_at is null or end_at > now())
  )
);
drop policy if exists "public reads active ad creatives" on public.ad_creatives;
create policy "public reads active ad creatives" on public.ad_creatives
for select using (
  is_active and exists (
    select 1 from public.ad_campaigns as campaign
    where campaign.id = campaign_id
      and campaign.status in ('scheduled','active')
      and (campaign.start_at is null or campaign.start_at <= now())
      and (campaign.end_at is null or campaign.end_at > now())
  ) or public.can_staff('ads')
);
drop policy if exists "ad staff manages advertisers" on public.advertisers;
create policy "ad staff manages advertisers" on public.advertisers
for all to authenticated using (public.can_staff('ads')) with check (public.can_staff('ads'));
drop policy if exists "ad staff manages placements" on public.ad_placements;
create policy "ad staff manages placements" on public.ad_placements
for all to authenticated using (public.can_staff('ads')) with check (public.can_staff('ads'));
drop policy if exists "ad staff manages campaigns" on public.ad_campaigns;
create policy "ad staff manages campaigns" on public.ad_campaigns
for all to authenticated using (public.can_staff('ads')) with check (public.can_staff('ads'));
drop policy if exists "ad staff manages creatives" on public.ad_creatives;
create policy "ad staff manages creatives" on public.ad_creatives
for all to authenticated using (public.can_staff('ads')) with check (public.can_staff('ads'));
drop policy if exists "ad staff reads events" on public.ad_events;
create policy "ad staff reads events" on public.ad_events
for select to authenticated using (public.can_staff('ads'));
grant select on public.ad_placements, public.ad_campaigns, public.ad_creatives
to anon, authenticated;
grant select, insert, update, delete on public.advertisers,
  public.ad_placements, public.ad_campaigns, public.ad_creatives
to authenticated;
grant select on public.ad_events to authenticated;
create or replace function public.record_ad_event(
  target_campaign uuid,
  target_creative uuid,
  target_placement text,
  event_name text,
  anonymous_session text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare key_value text;
declare inserted boolean := false;
begin
  if event_name not in ('impression','click') then raise exception 'invalid_ad_event'; end if;
  if not exists (
    select 1 from public.ad_campaigns as campaign
    join public.ad_placements as placement
      on placement.placement_key = target_placement
    where campaign.id = target_campaign and placement.is_enabled
      and campaign.status in ('scheduled','active')
      and target_placement = any(campaign.placement_keys)
      and (campaign.start_at is null or campaign.start_at <= now())
      and (campaign.end_at is null or campaign.end_at > now())
  ) then return false; end if;
  key_value := case when auth.uid() is not null then 'u:' || auth.uid()::text
    when nullif(trim(anonymous_session),'') is not null
      then 'a:' || encode(digest(trim(anonymous_session),'sha256'),'hex')
    else 'a:' || encode(digest(coalesce(current_setting('request.headers',true),'') || current_date::text,'sha256'),'hex') end;
  insert into public.ad_events(campaign_id,creative_id,placement_key,event_type,actor_key)
  values(target_campaign,target_creative,target_placement,event_name,key_value)
  on conflict do nothing;
  inserted := found;
  return inserted;
end;
$$;
revoke all on function public.record_ad_event(uuid,uuid,text,text,text) from public;
grant execute on function public.record_ad_event(uuid,uuid,text,text,text)
to anon, authenticated;
commit;
