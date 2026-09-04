-- RojDeal professional administration and scalable location hierarchy.
-- Run once in Supabase SQL Editor after schema.sql/city_upgrade.sql.

create table if not exists public.platform_owners (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  can_manage_listings boolean not null default false,
  can_manage_reports boolean not null default false,
  can_manage_locations boolean not null default false,
  can_manage_users boolean not null default false,
  can_review_media boolean not null default false,
  read_only boolean not null default false,
  is_suspended boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log(target_type, target_id, created_at desc);

create table if not exists public.location_nodes (
  id bigint generated always as identity primary key,
  parent_id bigint references public.location_nodes(id) on delete restrict,
  kind text not null check (kind in ('governorate', 'district', 'subdistrict', 'village')),
  slug text not null unique,
  names jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  check ((kind = 'governorate' and parent_id is null) or (kind <> 'governorate' and parent_id is not null))
);

create index if not exists location_nodes_parent_idx
  on public.location_nodes(parent_id, kind, is_active, sort_order, id);

create table if not exists public.location_proposals (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  parent_id bigint not null references public.location_nodes(id) on delete restrict,
  kind text not null check (kind in ('district', 'subdistrict', 'village')),
  proposed_name text not null check (char_length(trim(proposed_name)) between 2 and 100),
  normalized_name text generated always as (lower(trim(proposed_name))) stored,
  state text not null default 'pending' check (state in ('pending', 'approved', 'rejected', 'merged')),
  approved_node_id bigint references public.location_nodes(id),
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists location_proposals_open_unique
  on public.location_proposals(parent_id, kind, normalized_name)
  where state = 'pending';
create index if not exists location_proposals_review_idx
  on public.location_proposals(state, created_at);

alter table public.listings
  add column if not exists location_node_id bigint references public.location_nodes(id),
  add column if not exists location_proposal_id uuid references public.location_proposals(id),
  add column if not exists public_code text;

update public.listings
set public_code = 'RD-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where public_code is null;

create unique index if not exists listings_public_code_unique
  on public.listings(public_code);
create index if not exists listings_feed_cursor_idx
  on public.listings(state, published_at desc, id desc);
create index if not exists listings_owner_created_idx
  on public.listings(owner_id, created_at desc);

create or replace function public.assign_listing_public_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.public_code is null then
    new.public_code := 'RD-' || upper(substr(replace(new.id::text, '-', ''), 1, 10));
  end if;
  return new;
end;
$$;

drop trigger if exists listings_assign_public_code on public.listings;
create trigger listings_assign_public_code
before insert on public.listings
for each row execute function public.assign_listing_public_code();

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.platform_owners where user_id = auth.uid());
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_owner() or exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_owner() or exists(
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_staff(permission_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_owner() or exists (
    select 1
    from public.profiles p
    left join public.staff_permissions sp on sp.user_id = p.id
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin')
      and coalesce(sp.is_suspended, false) = false
      and (
        p.role = 'admin'
        or (permission_name = 'listings' and sp.can_manage_listings)
        or (permission_name = 'reports' and sp.can_manage_reports)
        or (permission_name = 'locations' and sp.can_manage_locations)
        or (permission_name = 'users' and sp.can_manage_users)
        or (permission_name = 'media' and sp.can_review_media)
      )
  );
$$;

create or replace function public.set_staff_role(target_user uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare old_role text;
begin
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if not public.is_platform_owner() and not (public.is_admin() and new_role <> 'admin') then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;
  if exists(select 1 from public.platform_owners where user_id = target_user) then
    raise exception 'owner_role_cannot_be_changed' using errcode = '42501';
  end if;
  select role::text into old_role from public.profiles where id = target_user for update;
  if old_role is null then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  if not public.is_platform_owner() and old_role = 'admin' then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;
  update public.profiles set role = new_role::public.user_role where id = target_user;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'staff_role_changed', 'profile', target_user::text,
    jsonb_build_object('old_role', old_role, 'new_role', new_role));
end;
$$;

revoke all on function public.set_staff_role(uuid, text) from public;
grant execute on function public.set_staff_role(uuid, text) to authenticated;

create or replace function public.set_staff_role_by_email(target_email text, new_role text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare target_user uuid;
begin
  select id into target_user from auth.users where lower(email) = lower(trim(target_email));
  if target_user is null then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  perform public.set_staff_role(target_user, new_role);
end;
$$;

create or replace function public.list_staff_accounts()
returns table(id uuid, email text, display_name text, role text, is_owner boolean, is_suspended boolean)
language sql stable security definer set search_path = public, auth as $$
  select p.id, u.email::text, p.display_name, p.role::text,
    exists(
      select 1 from public.platform_owners po where po.user_id = p.id
    ) as is_owner,
    coalesce(sp.is_suspended, false)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.staff_permissions sp on sp.user_id = p.id
  where (p.role in ('moderator', 'admin') or exists(
    select 1 from public.platform_owners po where po.user_id = p.id
  )) and (public.is_platform_owner() or public.is_admin())
  order by is_owner desc, p.display_name;
$$;

revoke all on function public.set_staff_role_by_email(text, text) from public;
revoke all on function public.list_staff_accounts() from public;
grant execute on function public.set_staff_role_by_email(text, text) to authenticated;
grant execute on function public.list_staff_accounts() to authenticated;

alter table public.platform_owners enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.location_nodes enable row level security;
alter table public.location_proposals enable row level security;

create policy "owner reads owners" on public.platform_owners
for select to authenticated using (public.is_platform_owner());
create policy "owner manages permissions" on public.staff_permissions
for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy "staff reads own permissions" on public.staff_permissions
for select to authenticated using (user_id = auth.uid() or public.is_platform_owner());
create policy "staff reads audit log" on public.admin_audit_log
for select to authenticated using (public.is_platform_owner() or public.is_admin());
create policy "active locations public read" on public.location_nodes
for select using (is_active or public.can_staff('locations'));
create policy "location staff write" on public.location_nodes
for all to authenticated using (public.can_staff('locations')) with check (public.can_staff('locations'));
create policy "users create location proposals" on public.location_proposals
for insert to authenticated with check (proposer_id = auth.uid() and state = 'pending');
create policy "proposal owner or location staff read" on public.location_proposals
for select to authenticated using (proposer_id = auth.uid() or public.can_staff('locations'));
create policy "location staff reviews proposals" on public.location_proposals
for update to authenticated using (public.can_staff('locations')) with check (public.can_staff('locations'));

insert into public.location_nodes(kind, slug, names, sort_order) values
 ('governorate','damascus','{"ar":"دمشق","ku":"Şam","en":"Damascus","de":"Damaskus"}',10),
 ('governorate','rif-dimashq','{"ar":"ريف دمشق","ku":"Gundê Şamê","en":"Rif Dimashq","de":"Rif Dimaschq"}',20),
 ('governorate','aleppo','{"ar":"حلب","ku":"Heleb","en":"Aleppo","de":"Aleppo"}',30),
 ('governorate','hasakah','{"ar":"الحسكة","ku":"Hesekê","en":"Al-Hasakah","de":"Al-Hasaka"}',40),
 ('governorate','raqqa','{"ar":"الرقة","ku":"Reqayê","en":"Raqqa","de":"Raqqa"}',50),
 ('governorate','deir-ez-zor','{"ar":"دير الزور","ku":"Dêrazor","en":"Deir ez-Zor","de":"Deir ez-Zor"}',60),
 ('governorate','idlib','{"ar":"إدلب","ku":"Idlib","en":"Idlib","de":"Idlib"}',70),
 ('governorate','hama','{"ar":"حماة","ku":"Hama","en":"Hama","de":"Hama"}',80),
 ('governorate','homs','{"ar":"حمص","ku":"Hims","en":"Homs","de":"Homs"}',90),
 ('governorate','latakia','{"ar":"اللاذقية","ku":"Lazqiyê","en":"Latakia","de":"Latakia"}',100),
 ('governorate','tartus','{"ar":"طرطوس","ku":"Tertûs","en":"Tartus","de":"Tartus"}',110),
 ('governorate','daraa','{"ar":"درعا","ku":"Dera","en":"Daraa","de":"Daraa"}',120),
 ('governorate','as-suwayda','{"ar":"السويداء","ku":"Siweyda","en":"As-Suwayda","de":"As-Suwaida"}',130),
 ('governorate','quneitra','{"ar":"القنيطرة","ku":"Quneitra","en":"Quneitra","de":"Quneitra"}',140)
on conflict (slug) do update set names = excluded.names, sort_order = excluded.sort_order;

-- First-time owner bootstrap (run manually once, replacing the email):
-- insert into public.platform_owners(user_id)
-- select id from public.profiles where id = (select id from auth.users where email = 'OWNER_EMAIL');
