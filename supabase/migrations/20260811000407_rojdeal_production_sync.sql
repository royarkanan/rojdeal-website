-- RojDeal final release upgrade. Safe to run after schema.sql,
-- city_upgrade.sql and professional_admin_upgrade.sql.
begin;
alter table public.location_proposals
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='location_proposals_coordinates_check'
      and conrelid='public.location_proposals'::regclass
  ) then
    alter table public.location_proposals
      add constraint location_proposals_coordinates_check check (
        (latitude is null and longitude is null) or
        (latitude between -90 and 90 and longitude between -180 and 180)
      );
  end if;
end $$;
create or replace function public.validate_location_parent()
returns trigger language plpgsql set search_path = public as $$
declare parent_kind text;
begin
  if new.kind = 'governorate' then
    if new.parent_id is not null then raise exception 'governorate_has_no_parent'; end if;
    return new;
  end if;
  select kind into parent_kind from public.location_nodes where id = new.parent_id;
  if parent_kind is null then raise exception 'location_parent_not_found'; end if;
  if (new.kind = 'district' and parent_kind <> 'governorate') or
     (new.kind = 'subdistrict' and parent_kind <> 'district') or
     (new.kind = 'village' and parent_kind <> 'subdistrict') then
    raise exception 'invalid_location_hierarchy';
  end if;
  return new;
end;
$$;
drop trigger if exists location_nodes_validate_parent on public.location_nodes;
create trigger location_nodes_validate_parent
before insert or update of parent_id, kind on public.location_nodes
for each row execute function public.validate_location_parent();
create table if not exists public.platform_content (
  id boolean primary key default true check (id),
  banner_text text not null default '' check (char_length(banner_text) <= 500),
  welcome_video_url text not null default '' check (char_length(welcome_video_url) <= 1000),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.platform_content(id) values (true) on conflict (id) do nothing;
create table if not exists public.broadcast_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 2 and 120),
  body text not null check (char_length(trim(body)) between 2 and 2000),
  channel text not null check (channel in ('notification','email','both')),
  state text not null default 'queued' check (state in ('queued','processing','sent','failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);
create or replace function public.queue_admin_broadcast(
  message_title text, message_body text, delivery_channel text
) returns uuid language plpgsql security definer set search_path = public as $$
declare job_id uuid;
begin
  if not public.can_staff('users') then raise exception 'permission_denied' using errcode='42501'; end if;
  if delivery_channel not in ('notification','email','both') then raise exception 'invalid_channel'; end if;
  insert into public.broadcast_jobs(created_by,title,body,channel)
  values(auth.uid(),trim(message_title),trim(message_body),delivery_channel)
  returning id into job_id;
  if delivery_channel in ('notification','both') then
    insert into public.notifications(user_id,type,title,body,payload)
    select id,'admin_broadcast',trim(message_title),trim(message_body),jsonb_build_object('job_id',job_id)
    from public.profiles;
  end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'broadcast_queued','broadcast_job',job_id::text,jsonb_build_object('channel',delivery_channel));
  return job_id;
end;
$$;
revoke all on function public.queue_admin_broadcast(text,text,text) from public;
grant execute on function public.queue_admin_broadcast(text,text,text) to authenticated;
create or replace function public.moderate_listing(
  target_listing uuid, new_state text, moderation_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare owner_user uuid;
begin
  if not public.can_staff('listings') then raise exception 'permission_denied' using errcode='42501'; end if;
  if new_state not in ('draft','published','hidden','removed','rejected') then
    raise exception 'invalid_listing_state';
  end if;
  update public.listings set state=new_state::public.listing_state, updated_at=now()
  where id=target_listing returning owner_id into owner_user;
  if owner_user is null then raise exception 'listing_not_found'; end if;
  insert into public.moderation_log(moderator_id,listing_id,action,note)
  values(auth.uid(),target_listing,'set_state_'||new_state,nullif(trim(moderation_note),''));
  insert into public.notifications(user_id,type,title,body,payload)
  values(owner_user,'listing_moderated','Listing update',coalesce(nullif(trim(moderation_note),''),new_state),
    jsonb_build_object('listing_id',target_listing,'state',new_state));
end;
$$;
revoke all on function public.moderate_listing(uuid,text,text) from public;
grant execute on function public.moderate_listing(uuid,text,text) to authenticated;
create or replace function public.set_staff_permissions_by_email(
  target_email text,
  manage_listings boolean,
  manage_reports boolean,
  manage_locations boolean,
  manage_users boolean,
  review_media boolean
) returns void language plpgsql security definer set search_path = public, auth as $$
declare target_user uuid;
begin
  if not public.is_platform_owner() then raise exception 'owner_permission_required' using errcode='42501'; end if;
  select id into target_user from auth.users where lower(email)=lower(trim(target_email));
  if target_user is null then raise exception 'user_not_found'; end if;
  if exists(select 1 from public.platform_owners where user_id=target_user) then
    raise exception 'owner_permissions_cannot_be_restricted';
  end if;
  insert into public.staff_permissions(
    user_id,can_manage_listings,can_manage_reports,can_manage_locations,
    can_manage_users,can_review_media,updated_by,updated_at
  ) values(
    target_user,manage_listings,manage_reports,manage_locations,
    manage_users,review_media,auth.uid(),now()
  ) on conflict(user_id) do update set
    can_manage_listings=excluded.can_manage_listings,
    can_manage_reports=excluded.can_manage_reports,
    can_manage_locations=excluded.can_manage_locations,
    can_manage_users=excluded.can_manage_users,
    can_review_media=excluded.can_review_media,
    updated_by=excluded.updated_by,updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.set_staff_permissions_by_email(text,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.set_staff_permissions_by_email(text,boolean,boolean,boolean,boolean,boolean) to authenticated;
alter table public.platform_content enable row level security;
alter table public.broadcast_jobs enable row level security;
drop policy if exists "platform content public read" on public.platform_content;
create policy "platform content public read" on public.platform_content for select using (true);
drop policy if exists "admin edits platform content" on public.platform_content;
create policy "admin edits platform content" on public.platform_content
for all to authenticated using (public.can_staff('users')) with check (public.can_staff('users'));
drop policy if exists "admin reads broadcast jobs" on public.broadcast_jobs;
create policy "admin reads broadcast jobs" on public.broadcast_jobs
for select to authenticated using (public.can_staff('users'));
commit;
-- RojDeal production release upgrade (2026-08-10).
-- Run after schema.sql, city_upgrade.sql, professional_admin_upgrade.sql,
-- marketplace_features_upgrade.sql and final_release_upgrade.sql.
begin;
-- -------------------------------------------------------------------------
-- Verified hierarchical locations
-- -------------------------------------------------------------------------
alter table public.location_nodes
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists city_id bigint references public.cities(id);
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'location_nodes_coordinates_check'
      and conrelid = 'public.location_nodes'::regclass
  ) then
    alter table public.location_nodes
      add constraint location_nodes_coordinates_check check (
        (latitude is null and longitude is null)
        or (latitude between -90 and 90 and longitude between -180 and 180)
      );
  end if;
end $$;
alter table public.location_proposals
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);
-- Proposal writes go through the validated RPC below. Users cannot bypass the
-- required hierarchy and coordinates with a direct table insert.
drop policy if exists "users create location proposals" on public.location_proposals;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'location_proposals_coordinates_check'
      and conrelid = 'public.location_proposals'::regclass
  ) then
    alter table public.location_proposals
      add constraint location_proposals_coordinates_check check (
        latitude between 32 and 38.5
        and longitude between 35 and 42.5
      );
  end if;
end $$;
create or replace function public.validate_location_parent()
returns trigger language plpgsql set search_path = public as $$
declare parent_kind text;
begin
  if new.kind = 'governorate' then
    if new.parent_id is not null then
      raise exception 'governorate_has_no_parent';
    end if;
    return new;
  end if;
  select kind into parent_kind
  from public.location_nodes
  where id = new.parent_id and is_active;
  if parent_kind is null then raise exception 'location_parent_not_found'; end if;
  if (new.kind = 'district' and parent_kind <> 'governorate')
     or (new.kind = 'subdistrict' and parent_kind <> 'district')
     or (new.kind = 'village' and parent_kind <> 'subdistrict') then
    raise exception 'invalid_location_hierarchy';
  end if;
  return new;
end;
$$;
drop trigger if exists location_nodes_validate_parent on public.location_nodes;
create trigger location_nodes_validate_parent
before insert or update of parent_id, kind on public.location_nodes
for each row execute function public.validate_location_parent();
-- Main approved cities are represented inside the verified hierarchy.
with city_nodes(parent_slug, node_slug, city_slug, names, latitude, longitude, sort_order) as (
  values
    ('aleppo','kobani','kobani','{"ar":"كوباني","ku":"Kobanî","en":"Kobani","de":"Kobani"}'::jsonb,36.890000,38.353500,10),
    ('damascus','damascus-city','damascus','{"ar":"مدينة دمشق","ku":"Bajarê Şamê","en":"Damascus City","de":"Stadt Damaskus"}'::jsonb,33.513800,36.276500,10),
    ('aleppo','aleppo-city','aleppo-city','{"ar":"مدينة حلب","ku":"Bajarê Helebê","en":"Aleppo City","de":"Stadt Aleppo"}'::jsonb,36.202100,37.134300,20),
    ('hasakah','qamishli','qamishli','{"ar":"القامشلي","ku":"Qamişlo","en":"Qamishli","de":"Qamischli"}'::jsonb,37.052100,41.231400,10),
    ('hasakah','hasakah-city','hasakah-city','{"ar":"مدينة الحسكة","ku":"Bajarê Hesekê","en":"Hasakah City","de":"Stadt Hasaka"}'::jsonb,36.502400,40.747700,20),
    ('raqqa','raqqa-city','raqqa-city','{"ar":"مدينة الرقة","ku":"Bajarê Reqayê","en":"Raqqa City","de":"Stadt Raqqa"}'::jsonb,35.959400,39.006400,10),
    ('aleppo','afrin','afrin','{"ar":"عفرين","ku":"Efrîn","en":"Afrin","de":"Afrin"}'::jsonb,36.512278,36.865389,30),
    ('aleppo','manbij','manbij','{"ar":"منبج","ku":"Minbic","en":"Manbij","de":"Manbidsch"}'::jsonb,36.528100,37.954900,40),
    ('aleppo','al-bab','al-bab','{"ar":"الباب","ku":"El-Bab","en":"Al-Bab","de":"Al-Bab"}'::jsonb,36.370510,37.515700,50),
    ('raqqa','tabqa','tabqa','{"ar":"الطبقة","ku":"Tebqa","en":"Tabqa","de":"Tabqa"}'::jsonb,35.837100,38.548300,20),
    ('latakia','latakia-city','latakia-city','{"ar":"مدينة اللاذقية","ku":"Bajarê Lazqiyê","en":"Latakia City","de":"Stadt Latakia"}'::jsonb,35.531700,35.791500,10)
)
insert into public.location_nodes(
  parent_id, kind, slug, names, latitude, longitude, city_id, sort_order, is_active
)
select parent.id, 'district', value.node_slug, value.names,
       value.latitude, value.longitude, city.id, value.sort_order, true
from city_nodes value
join public.location_nodes parent
  on parent.slug = value.parent_slug and parent.kind = 'governorate'
join public.cities city on city.slug = value.city_slug
on conflict (slug) do update set
  parent_id = excluded.parent_id,
  kind = excluded.kind,
  names = excluded.names,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  city_id = excluded.city_id,
  sort_order = excluded.sort_order,
  is_active = true;
insert into public.location_nodes(
  parent_id, kind, slug, names, latitude, longitude, city_id, sort_order, is_active
)
select parent.id, 'subdistrict', 'amuda',
       '{"ar":"عامودا","ku":"Amûdê","en":"Amuda","de":"Amuda"}'::jsonb,
       37.104170, 40.930000, city.id, 10, true
from public.location_nodes parent
join public.cities city on city.slug = 'amuda'
where parent.slug = 'qamishli'
on conflict (slug) do update set
  parent_id = excluded.parent_id,
  kind = excluded.kind,
  names = excluded.names,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  city_id = excluded.city_id,
  sort_order = excluded.sort_order,
  is_active = true;
update public.listings listing
set location_node_id = node.id
from public.cities city
join public.location_nodes node on node.city_id = city.id
where listing.city_id = city.id and listing.location_node_id is null;
create index if not exists location_nodes_city_idx
  on public.location_nodes(city_id) where city_id is not null;
create index if not exists location_nodes_coordinates_idx
  on public.location_nodes(latitude, longitude)
  where latitude is not null and longitude is not null;
update public.location_nodes node
set latitude=value.latitude, longitude=value.longitude
from (values
  ('damascus',33.5138,36.2765),('rif-dimashq',33.5000,36.3000),
  ('aleppo',36.2021,37.1343),('hasakah',36.5024,40.7477),
  ('raqqa',35.9594,39.0064),('deir-ez-zor',35.3333,40.1500),
  ('idlib',35.9306,36.6339),('hama',35.1318,36.7578),
  ('homs',34.7308,36.7094),('latakia',35.5317,35.7915),
  ('tartus',34.8890,35.8866),('daraa',32.6189,36.1021),
  ('as-suwayda',32.7089,36.5695),('quneitra',33.1259,35.8246)
) as value(slug,latitude,longitude)
where node.kind='governorate' and node.slug=value.slug;
create or replace function public.location_path_label(target_node bigint)
returns text language sql stable set search_path = public as $$
  with recursive path as (
    select id, parent_id, names, 0 as depth
    from public.location_nodes where id = target_node
    union all
    select parent.id, parent.parent_id, parent.names, path.depth + 1
    from public.location_nodes parent
    join path on path.parent_id = parent.id
  )
  select string_agg(
    coalesce(names->>'ar', names->>'en', names->>'ku', names->>'de', ''),
    ' ← ' order by depth desc
  ) from path;
$$;
create or replace function public.resolve_listing_city(
  selected_location_node bigint,
  selected_latitude double precision,
  selected_longitude double precision
) returns bigint language plpgsql stable security definer set search_path = public as $$
declare resolved_city bigint;
begin
  if selected_location_node is not null then
    with recursive ancestors as (
      select id, parent_id, city_id, 0 as depth
      from public.location_nodes where id = selected_location_node and is_active
      union all
      select parent.id, parent.parent_id, parent.city_id, ancestors.depth + 1
      from public.location_nodes parent
      join ancestors on ancestors.parent_id = parent.id
    )
    select city_id into resolved_city
    from ancestors where city_id is not null
    order by depth limit 1;
  end if;
  if resolved_city is null and selected_latitude is not null
     and selected_longitude is not null then
    select id into resolved_city
    from public.cities
    where is_active and latitude is not null and longitude is not null
    order by power(latitude::double precision - selected_latitude, 2)
           + power(longitude::double precision - selected_longitude, 2)
    limit 1;
  end if;
  return resolved_city;
end;
$$;
revoke all on function public.resolve_listing_city(bigint,double precision,double precision) from public;
grant execute on function public.resolve_listing_city(bigint,double precision,double precision) to authenticated;
create or replace function public.submit_location_proposal(
  proposal_parent_id bigint,
  proposal_kind text,
  proposal_name text,
  proposal_latitude double precision,
  proposal_longitude double precision
) returns uuid language plpgsql security definer set search_path = public as $$
declare parent_kind text; proposal_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if proposal_kind not in ('district','subdistrict','village') then
    raise exception 'invalid_location_kind';
  end if;
  if char_length(trim(proposal_name)) not between 2 and 100 then
    raise exception 'invalid_location_name';
  end if;
  if proposal_latitude is null or proposal_longitude is null
     or proposal_latitude not between 32 and 38.5
     or proposal_longitude not between 35 and 42.5 then
    raise exception 'invalid_location_coordinates';
  end if;
  select kind into parent_kind from public.location_nodes
  where id = proposal_parent_id and is_active;
  if (proposal_kind = 'district' and parent_kind <> 'governorate')
     or (proposal_kind = 'subdistrict' and parent_kind <> 'district')
     or (proposal_kind = 'village' and parent_kind <> 'subdistrict') then
    raise exception 'invalid_location_hierarchy';
  end if;
  if (select count(*) from public.location_proposals
      where proposer_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'location_proposal_limit';
  end if;
  insert into public.location_proposals(
    proposer_id,parent_id,kind,proposed_name,latitude,longitude,state
  ) values(
    auth.uid(),proposal_parent_id,proposal_kind,
    trim(regexp_replace(proposal_name,'\s+',' ','g')),
    proposal_latitude,proposal_longitude,'pending'
  ) returning id into proposal_id;
  return proposal_id;
end;
$$;
revoke all on function public.submit_location_proposal(bigint,text,text,double precision,double precision) from public;
grant execute on function public.submit_location_proposal(bigint,text,text,double precision,double precision) to authenticated;
create or replace function public.attach_listing_location_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.location_proposal_id is not null then
    update public.location_proposals
    set listing_id = new.id
    where id = new.location_proposal_id
      and proposer_id = new.owner_id
      and state = 'pending';
    if not found then raise exception 'invalid_location_proposal'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists listings_attach_location_proposal on public.listings;
create trigger listings_attach_location_proposal
after insert on public.listings
for each row execute function public.attach_listing_location_proposal();
create or replace function public.list_pending_location_proposals()
returns table(
  id uuid, kind text, proposed_name text, parent_id bigint,
  parent_path text, proposer_name text, latitude numeric,
  longitude numeric, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_staff('locations') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return query
  select proposal.id, proposal.kind, proposal.proposed_name,
         proposal.parent_id, public.location_path_label(proposal.parent_id),
         profile.display_name, proposal.latitude, proposal.longitude,
         proposal.created_at
  from public.location_proposals proposal
  join public.profiles profile on profile.id = proposal.proposer_id
  where proposal.state = 'pending'
  order by proposal.created_at;
end;
$$;
revoke all on function public.list_pending_location_proposals() from public;
grant execute on function public.list_pending_location_proposals() to authenticated;
create or replace function public.review_location_proposal(
  target_proposal uuid,
  approve_proposal boolean,
  review_note text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare proposal public.location_proposals%rowtype;
declare approved_id bigint;
declare new_slug text;
declare resolved_city bigint;
declare attribute_key text;
begin
  if not public.can_staff('locations') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into proposal from public.location_proposals
  where id = target_proposal and state = 'pending' for update;
  if not found then raise exception 'proposal_not_found_or_reviewed'; end if;

  if approve_proposal then
    new_slug := left(coalesce(public.normalize_city_name(proposal.proposed_name), 'place'), 48)
      || '-' || left(replace(proposal.id::text, '-', ''), 8);
    resolved_city := public.resolve_listing_city(
      proposal.parent_id, proposal.latitude, proposal.longitude
    );
    insert into public.location_nodes(
      parent_id,kind,slug,names,latitude,longitude,city_id,is_active,sort_order
    ) values(
      proposal.parent_id,proposal.kind,new_slug,
      jsonb_build_object('ar',proposal.proposed_name,'ku',proposal.proposed_name,
                         'en',proposal.proposed_name,'de',proposal.proposed_name),
      proposal.latitude,proposal.longitude,resolved_city,true,1000
    ) returning id into approved_id;
    update public.location_proposals set
      state='approved',approved_node_id=approved_id,
      review_note=nullif(trim(review_note),''),reviewed_by=auth.uid(),reviewed_at=now()
    where id=target_proposal;
    attribute_key := case when proposal.kind='village' then 'village' else 'district' end;
    update public.listings set
      location_node_id=approved_id,
      attributes=(attributes - 'pendingLocationName' - 'pendingLocationKind')
        || jsonb_build_object(attribute_key, proposal.proposed_name)
    where location_proposal_id=target_proposal;
  else
    update public.location_proposals set
      state='rejected',review_note=nullif(trim(review_note),''),
      reviewed_by=auth.uid(),reviewed_at=now()
    where id=target_proposal;
    update public.listings set
      attributes=attributes - 'pendingLocationName' - 'pendingLocationKind',
      area_label=coalesce(
        (select coalesce(node.names->>'ar',node.names->>'en',node.slug)
         from public.location_nodes node where node.id=proposal.parent_id),
        area_label
      )
    where location_proposal_id=target_proposal;
  end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),case when approve_proposal then 'location_approved' else 'location_rejected' end,
         'location_proposal',target_proposal::text,
         jsonb_build_object('approved_node_id',approved_id,'note',review_note));
  return approved_id;
end;
$$;
revoke all on function public.review_location_proposal(uuid,boolean,text) from public;
grant execute on function public.review_location_proposal(uuid,boolean,text) to authenticated;
-- Users may only propose places. The old direct city-creation endpoint is disabled.
revoke execute on function public.find_or_create_city(text,double precision,double precision)
  from authenticated;
-- -------------------------------------------------------------------------
-- Pro / Gold accounts scoped to an approved location
-- -------------------------------------------------------------------------
alter table public.profiles
  add column if not exists account_tier text not null default 'standard',
  add column if not exists promotion_location_node_id bigint
    references public.location_nodes(id) on delete set null;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_account_tier_check'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_account_tier_check
      check (account_tier in ('standard','pro','gold'));
  end if;
end $$;
create index if not exists profiles_promotion_location_idx
  on public.profiles(promotion_location_node_id, account_tier)
  where account_tier in ('pro','gold');
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role = old.role;
    new.is_phone_verified = old.is_phone_verified;
    new.is_identity_verified = old.is_identity_verified;
    new.account_tier = old.account_tier;
    new.promotion_location_node_id = old.promotion_location_node_id;
  end if;
  return new;
end;
$$;
create or replace function public.set_account_tier_by_email(
  target_email text,
  new_tier text,
  target_location_node bigint default null
) returns void language plpgsql security definer set search_path = public, auth as $$
declare target_user uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_permission_required' using errcode='42501';
  end if;
  if new_tier not in ('standard','pro','gold') then raise exception 'invalid_tier'; end if;
  if new_tier <> 'standard' and not exists(
    select 1 from public.location_nodes
    where id=target_location_node and is_active and kind in ('district','subdistrict','village')
  ) then raise exception 'approved_promotion_location_required'; end if;
  select id into target_user from auth.users
  where lower(email)=lower(trim(target_email));
  if target_user is null then raise exception 'user_not_found'; end if;
  update public.profiles set
    account_tier=new_tier,
    promotion_location_node_id=case when new_tier='standard' then null else target_location_node end
  where id=target_user;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'account_tier_changed','profile',target_user::text,
         jsonb_build_object('tier',new_tier,'location_node_id',target_location_node));
end;
$$;
revoke all on function public.set_account_tier_by_email(text,text,bigint) from public;
grant execute on function public.set_account_tier_by_email(text,text,bigint) to authenticated;
-- Repair legacy placeholder names from authenticated user metadata/email.
update public.profiles profile
set display_name = left(coalesce(
  nullif(trim(account.raw_user_meta_data->>'display_name'), ''),
  nullif(trim(split_part(account.email, '@', 1)), ''),
  'RojDeal'
), 80)
from auth.users account
where profile.id = account.id
  and (trim(profile.display_name) = '' or profile.display_name = 'RojDeal User');
update public.listings listing
set seller_name = case
  when profile.account_type='agency' and trim(coalesce(profile.business_name,''))<>''
    then profile.business_name
  else profile.display_name
end
from public.profiles profile
where listing.owner_id=profile.id
  and (listing.seller_name='RojDeal User' or trim(listing.seller_name)='');
-- -------------------------------------------------------------------------
-- Admin banner / uploaded welcome video
-- -------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('platform-content','platform-content',true,157286400,
       array['video/mp4','video/quicktime','video/webm'])
on conflict(id) do update set
  public=true,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "public platform content read" on storage.objects;
create policy "public platform content read" on storage.objects
for select using(bucket_id='platform-content');
drop policy if exists "admin uploads platform content" on storage.objects;
create policy "admin uploads platform content" on storage.objects
for insert to authenticated with check(
  bucket_id='platform-content' and public.is_admin()
  and split_part(name,'/',1)=auth.uid()::text
);
drop policy if exists "admin deletes platform content" on storage.objects;
create policy "admin deletes platform content" on storage.objects
for delete to authenticated using(bucket_id='platform-content' and public.is_admin());
-- -------------------------------------------------------------------------
-- Durable in-app and email broadcasts
-- -------------------------------------------------------------------------
alter table public.broadcast_jobs
  add column if not exists recipient_count integer not null default 0,
  add column if not exists sent_count integer not null default 0,
  add column if not exists failed_count integer not null default 0;
create table if not exists public.broadcast_recipients(
  id bigint generated always as identity primary key,
  job_id uuid not null references public.broadcast_jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  state text not null default 'queued' check(state in ('queued','processing','sent','failed')),
  attempts integer not null default 0,
  provider_message_id text,
  error_message text,
  processed_at timestamptz,
  unique(job_id,user_id)
);
create index if not exists broadcast_recipients_queue_idx
  on public.broadcast_recipients(job_id,state,id);
alter table public.broadcast_recipients enable row level security;
drop policy if exists "admin reads broadcast recipients" on public.broadcast_recipients;
create policy "admin reads broadcast recipients" on public.broadcast_recipients
for select to authenticated using(public.is_admin());
create or replace function public.queue_admin_broadcast(
  message_title text, message_body text, delivery_channel text
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare job_id uuid; total integer := 0;
begin
  if not public.can_staff('users') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if char_length(trim(message_title)) not between 2 and 120
     or char_length(trim(message_body)) not between 2 and 2000 then
    raise exception 'invalid_broadcast_content';
  end if;
  if delivery_channel not in ('notification','email','both') then
    raise exception 'invalid_channel';
  end if;
  insert into public.broadcast_jobs(created_by,title,body,channel)
  values(auth.uid(),trim(message_title),trim(message_body),delivery_channel)
  returning id into job_id;
  if delivery_channel in ('notification','both') then
    insert into public.notifications(user_id,type,title,body,payload)
    select id,'admin_broadcast',trim(message_title),trim(message_body),
           jsonb_build_object('job_id',job_id)
    from public.profiles;
  end if;
  if delivery_channel in ('email','both') then
    insert into public.broadcast_recipients(job_id,user_id,email)
    select job_id, account.id, lower(account.email)
    from auth.users account
    join public.profiles profile on profile.id=account.id
    where account.email is not null and account.email_confirmed_at is not null;
    get diagnostics total = row_count;
    update public.broadcast_jobs set recipient_count=total where id=job_id;
  else
    update public.broadcast_jobs set state='sent',processed_at=now() where id=job_id;
  end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'broadcast_queued','broadcast_job',job_id::text,
         jsonb_build_object('channel',delivery_channel,'email_recipients',total));
  return job_id;
end;
$$;
revoke all on function public.queue_admin_broadcast(text,text,text) from public;
grant execute on function public.queue_admin_broadcast(text,text,text) to authenticated;
-- Moderation states used by the final admin controls.
create or replace function public.moderate_listing(
  target_listing uuid, new_state text, moderation_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare owner_user uuid;
begin
  if not public.can_staff('listings') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if new_state not in ('draft','published','hidden','removed','rejected') then
    raise exception 'invalid_listing_state';
  end if;
  update public.listings set state=new_state::public.listing_state,updated_at=now()
  where id=target_listing returning owner_id into owner_user;
  if owner_user is null then raise exception 'listing_not_found'; end if;
  insert into public.moderation_log(moderator_id,listing_id,action,note)
  values(auth.uid(),target_listing,'set_state_'||new_state,nullif(trim(moderation_note),''));
  insert into public.notifications(user_id,type,title,body,payload)
  values(owner_user,'listing_moderated','RojDeal',
         coalesce(nullif(trim(moderation_note),''),new_state),
         jsonb_build_object('listing_id',target_listing,'state',new_state));
end;
$$;
-- -------------------------------------------------------------------------
-- Enforced staff permissions and direct account communication
-- -------------------------------------------------------------------------
create or replace function public.get_my_staff_permissions()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'listings', public.can_staff('listings'),
    'reports', public.can_staff('reports'),
    'locations', public.can_staff('locations'),
    'users', public.can_staff('users'),
    'media', public.can_staff('media')
  );
$$;
revoke all on function public.get_my_staff_permissions() from public;
grant execute on function public.get_my_staff_permissions() to authenticated;
create or replace function public.set_staff_role(target_user uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare old_role text;
begin
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if not public.is_platform_owner()
     and not (public.is_admin() and new_role <> 'admin') then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;
  if exists(select 1 from public.platform_owners where user_id = target_user) then
    raise exception 'owner_role_cannot_be_changed' using errcode = '42501';
  end if;
  select role::text into old_role
  from public.profiles where id = target_user for update;
  if old_role is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if target_user = auth.uid() and old_role in ('moderator', 'admin')
     and new_role = 'user' then
    raise exception 'self_demotion_not_allowed' using errcode = '42501';
  end if;
  if not public.is_platform_owner() and old_role = 'admin' then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;
  update public.profiles
  set role = new_role::public.user_role
  where id = target_user;
  insert into public.admin_audit_log(
    actor_id, action, target_type, target_id, details
  ) values(
    auth.uid(), 'staff_role_changed', 'profile', target_user::text,
    jsonb_build_object('old_role', old_role, 'new_role', new_role)
  );
end;
$$;
drop function if exists public.list_staff_accounts();
create function public.list_staff_accounts()
returns table(
  id uuid,
  email text,
  display_name text,
  role text,
  is_owner boolean,
  is_suspended boolean,
  can_manage_listings boolean,
  can_manage_reports boolean,
  can_manage_locations boolean,
  can_manage_users boolean,
  can_review_media boolean
) language sql stable security definer set search_path = public, auth as $$
  select profile.id,
         account.email::text,
         profile.display_name,
         profile.role::text,
         exists(
           select 1 from public.platform_owners owner
           where owner.user_id = profile.id
         ) as is_owner,
         coalesce(permission.is_suspended, false),
         coalesce(permission.can_manage_listings, false),
         coalesce(permission.can_manage_reports, false),
         coalesce(permission.can_manage_locations, false),
         coalesce(permission.can_manage_users, false),
         coalesce(permission.can_review_media, false)
  from public.profiles profile
  join auth.users account on account.id = profile.id
  left join public.staff_permissions permission
    on permission.user_id = profile.id
  where (
    profile.role in ('moderator', 'admin')
    or exists(
      select 1 from public.platform_owners owner
      where owner.user_id = profile.id
    )
  )
  and (public.is_platform_owner() or public.is_admin())
  order by is_owner desc, profile.display_name;
$$;
revoke all on function public.list_staff_accounts() from public;
grant execute on function public.list_staff_accounts() to authenticated;
create or replace function public.list_admin_user_accounts(
  search_term text default '',
  result_limit integer default 100
) returns table(
  id uuid,
  email text,
  display_name text,
  phone text,
  business_name text,
  role text,
  account_type text,
  account_tier text
) language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.can_staff('users') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return query
  select profile.id,
         account.email::text,
         profile.display_name,
         profile.phone,
         profile.business_name,
         profile.role::text,
         profile.account_type::text,
         profile.account_tier
  from public.profiles profile
  join auth.users account on account.id = profile.id
  where trim(search_term) = ''
     or profile.display_name ilike '%' || trim(search_term) || '%'
     or coalesce(profile.business_name, '') ilike '%' || trim(search_term) || '%'
     or coalesce(profile.phone, '') ilike '%' || trim(search_term) || '%'
     or coalesce(account.email, '') ilike '%' || trim(search_term) || '%'
  order by profile.created_at desc
  limit least(greatest(result_limit, 1), 100);
end;
$$;
revoke all on function public.list_admin_user_accounts(text,integer) from public;
grant execute on function public.list_admin_user_accounts(text,integer)
  to authenticated;
create or replace function public.queue_admin_direct_message(
  target_user uuid,
  message_title text,
  message_body text,
  delivery_channel text
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare job_id uuid;
declare target_email text;
declare email_confirmed timestamptz;
begin
  if not public.can_staff('users') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if char_length(trim(message_title)) not between 2 and 120
     or char_length(trim(message_body)) not between 2 and 2000 then
    raise exception 'invalid_message_content';
  end if;
  if delivery_channel not in ('notification', 'email', 'both') then
    raise exception 'invalid_channel';
  end if;
  select account.email, account.email_confirmed_at
  into target_email, email_confirmed
  from auth.users account
  join public.profiles profile on profile.id = account.id
  where account.id = target_user;
  if not found then raise exception 'user_not_found'; end if;
  if delivery_channel in ('email', 'both')
     and (target_email is null or email_confirmed is null) then
    raise exception 'confirmed_email_required';
  end if;
  insert into public.broadcast_jobs(created_by, title, body, channel)
  values(
    auth.uid(), trim(message_title), trim(message_body), delivery_channel
  ) returning id into job_id;
  if delivery_channel in ('notification', 'both') then
    insert into public.notifications(user_id, type, title, body, payload)
    values(
      target_user, 'admin_direct_message', trim(message_title),
      trim(message_body), jsonb_build_object('job_id', job_id)
    );
  end if;
  if delivery_channel in ('email', 'both') then
    insert into public.broadcast_recipients(job_id, user_id, email)
    values(job_id, target_user, lower(target_email));
    update public.broadcast_jobs
    set recipient_count = 1
    where id = job_id;
  else
    update public.broadcast_jobs
    set state = 'sent', processed_at = now()
    where id = job_id;
  end if;
  insert into public.admin_audit_log(
    actor_id, action, target_type, target_id, details
  ) values(
    auth.uid(), 'direct_message_queued', 'profile', target_user::text,
    jsonb_build_object('job_id', job_id, 'channel', delivery_channel)
  );
  return job_id;
end;
$$;
revoke all on function public.queue_admin_direct_message(uuid,text,text,text)
  from public;
grant execute on function public.queue_admin_direct_message(uuid,text,text,text)
  to authenticated;
alter table public.broadcast_recipients
  add column if not exists locked_at timestamptz;
create or replace function public.claim_broadcast_recipients(
  target_job uuid,
  batch_size integer default 50
) returns table(id bigint, email text, attempts integer)
language sql security definer set search_path = public as $$
  with candidates as (
    select recipient.id
    from public.broadcast_recipients recipient
    where recipient.job_id = target_job
      and recipient.attempts < 3
      and (
        recipient.state in ('queued', 'failed')
        or (
          recipient.state = 'processing'
          and (
            recipient.locked_at is null
            or recipient.locked_at < now() - interval '10 minutes'
          )
        )
      )
    order by recipient.id
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  ), claimed as (
    update public.broadcast_recipients recipient
    set state = 'processing',
        attempts = recipient.attempts + 1,
        locked_at = now(),
        error_message = null
    from candidates
    where recipient.id = candidates.id
    returning recipient.id, recipient.email, recipient.attempts
  )
  select claimed.id, claimed.email, claimed.attempts from claimed;
$$;
revoke all on function public.claim_broadcast_recipients(uuid,integer)
  from public;
grant execute on function public.claim_broadcast_recipients(uuid,integer)
  to service_role;
create or replace function public.review_listing_video(
  target_listing uuid,
  approve_video boolean
) returns void language plpgsql security definer set search_path = public as $$
declare target_media uuid;
begin
  if not public.can_staff('media') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.listing_media
  set review_status = (
        case when approve_video then 'approved' else 'rejected' end
      )::public.review_state,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where listing_id = target_listing and kind = 'video'
  returning id into target_media;
  if target_media is null then raise exception 'video_not_found'; end if;
  insert into public.moderation_log(
    moderator_id, listing_id, media_id, action
  ) values(
    auth.uid(), target_listing, target_media,
    case when approve_video then 'approve_video' else 'reject_video' end
  );
end;
$$;
revoke all on function public.review_listing_video(uuid,boolean) from public;
grant execute on function public.review_listing_video(uuid,boolean)
  to authenticated;
create or replace function public.set_report_state(
  target_report uuid,
  new_state text
) returns void language plpgsql security definer set search_path = public as $$
declare target_listing uuid;
begin
  if not public.can_staff('reports') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if new_state not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_report_state';
  end if;
  update public.reports
  set state = new_state::public.report_state,
      handled_by = auth.uid(),
      handled_at = now()
  where id = target_report
  returning listing_id into target_listing;
  if target_listing is null then raise exception 'report_not_found'; end if;
  insert into public.moderation_log(
    moderator_id, listing_id, action, note
  ) values(
    auth.uid(), target_listing, 'report_' || new_state,
    'Report ID: ' || target_report::text
  );
end;
$$;
revoke all on function public.set_report_state(uuid,text) from public;
grant execute on function public.set_report_state(uuid,text) to authenticated;
-- Replace broad legacy staff policies with task-specific permissions.
-- Direct client updates can never change privileged columns. Only the
-- SECURITY DEFINER moderation RPCs above run as the migration owner.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    new.role = old.role;
    new.is_phone_verified = old.is_phone_verified;
    new.is_identity_verified = old.is_identity_verified;
    new.account_tier = old.account_tier;
    new.promotion_location_node_id = old.promotion_location_node_id;
  end if;
  return new;
end;
$$;
create or replace function public.protect_listing_privileges()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    new.owner_id = old.owner_id;
    new.is_featured = old.is_featured;
    if new.state is distinct from old.state
       and (
         new.state::text = 'rejected'
         or (old.state::text = 'rejected' and new.state::text <> 'removed')
       ) then
      raise exception 'Only authorized moderation can change rejected listings';
    end if;
  end if;
  return new;
end;
$$;
drop policy if exists "profile owner or staff read" on public.profiles;
create policy "profile owner or staff read" on public.profiles
for select using(id = auth.uid() or public.can_staff('users'));
drop policy if exists "chat participants read profiles" on public.profiles;
create policy "chat participants read profiles" on public.profiles
for select to authenticated using(
  id = auth.uid()
  or public.can_staff('users')
  or exists(
    select 1 from public.conversations conversation
    where (
      conversation.buyer_id = auth.uid()
      and conversation.seller_id = profiles.id
    ) or (
      conversation.seller_id = auth.uid()
      and conversation.buyer_id = profiles.id
    )
  )
);
drop policy if exists "published listings read" on public.listings;
create policy "published listings read" on public.listings
for select using (
  state::text in ('published', 'reserved')
  or owner_id = auth.uid()
  or public.can_staff('listings')
  or public.can_staff('reports')
  or public.can_staff('media')
  or exists (
    select 1 from public.conversations conversation
    where conversation.listing_id = listings.id
      and (
        conversation.buyer_id = auth.uid()
        or conversation.seller_id = auth.uid()
      )
  )
);
drop policy if exists "owners update listings" on public.listings;
create policy "owners update listings" on public.listings
for update to authenticated
using(owner_id = auth.uid() or public.can_staff('listings'))
with check(owner_id = auth.uid() or public.can_staff('listings'));
drop policy if exists "staff review media" on public.listing_media;
create policy "staff review media" on public.listing_media
for update to authenticated
using(public.can_staff('media')) with check(public.can_staff('media'));
drop policy if exists "approved media read" on public.listing_media;
create policy "approved media read" on public.listing_media
for select using (
  (
    kind = 'image'
    and exists (
      select 1 from public.listings listing
      where listing.id = listing_id
        and listing.state::text in ('published', 'reserved')
    )
  )
  or (
    review_status = 'approved'
    and exists (
      select 1 from public.listings listing
      where listing.id = listing_id
        and listing.state::text in ('published', 'reserved')
    )
  )
  or owner_id = auth.uid()
  or public.can_staff('listings')
  or public.can_staff('reports')
  or public.can_staff('media')
  or exists (
    select 1 from public.conversations conversation
    where conversation.listing_id = listing_media.listing_id
      and (
        conversation.buyer_id = auth.uid()
        or conversation.seller_id = auth.uid()
      )
  )
);
drop policy if exists "owner or staff delete media" on public.listing_media;
create policy "owner or staff delete media" on public.listing_media
for delete to authenticated
using(owner_id = auth.uid() or public.can_staff('media'));
drop policy if exists "user or staff reads report" on public.reports;
create policy "user or staff reads report" on public.reports
for select using(reporter_id = auth.uid() or public.can_staff('reports'));
drop policy if exists "staff handles report" on public.reports;
create policy "staff handles report" on public.reports
for update to authenticated
using(public.can_staff('reports')) with check(public.can_staff('reports'));
drop policy if exists "staff creates notifications" on public.notifications;
create policy "staff creates notifications" on public.notifications
for insert to authenticated with check(public.can_staff('users'));
drop policy if exists "staff moderation log" on public.moderation_log;
create policy "staff moderation log" on public.moderation_log
for select to authenticated using(
  public.can_staff('listings') or public.can_staff('reports')
  or public.can_staff('media')
);
drop policy if exists "staff adds moderation log" on public.moderation_log;
create policy "staff adds moderation log" on public.moderation_log
for insert to authenticated with check(
  moderator_id = auth.uid() and (
    public.can_staff('listings') or public.can_staff('reports')
    or public.can_staff('media')
  )
);
drop policy if exists "owner or staff reads videos" on storage.objects;
create policy "owner or staff reads videos" on storage.objects
for select to authenticated using(
  bucket_id = 'listing-videos' and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.can_staff('media')
    or exists(
      select 1 from public.listing_media media
      where media.storage_path = name
        and media.kind = 'video'
        and media.review_status = 'approved'
    )
  )
);
drop policy if exists "owner or staff deletes media files" on storage.objects;
create policy "owner or staff deletes media files" on storage.objects
for delete to authenticated using(
  bucket_id in ('listing-images', 'listing-videos') and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.can_staff('media')
  )
);
commit;
-- RojDeal production-ready hardening (2026-08-10).
-- Run AFTER production_release_upgrade.sql.
begin;
-- -------------------------------------------------------------------------
-- Account activity used only as a tie-breaker for locally promoted Pro/Gold
-- accounts. Promotion scope and tier remain admin-controlled.
-- -------------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_active_at timestamptz;
update public.profiles
set last_active_at = coalesce(last_active_at, now())
where last_active_at is null;
create index if not exists profiles_promoted_activity_idx
  on public.profiles(promotion_location_node_id, account_tier, last_active_at desc)
  where account_tier in ('pro','gold');
create or replace function public.touch_my_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  update public.profiles
  set last_active_at = now()
  where id = auth.uid()
    and (last_active_at is null or last_active_at < now() - interval '15 minutes');
end;
$$;
revoke all on function public.touch_my_activity() from public;
grant execute on function public.touch_my_activity() to authenticated;
-- -------------------------------------------------------------------------
-- Permanent admin deletion. Database rows are deleted atomically; the Flutter
-- client removes the corresponding Storage objects after this RPC succeeds.
-- -------------------------------------------------------------------------
create or replace function public.admin_delete_listing(
  target_listing uuid,
  deletion_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
begin
  if not public.can_staff('listings') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select owner_id into listing_owner
  from public.listings
  where id = target_listing
  for update;

  if listing_owner is null then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values(
    auth.uid(),
    'listing_deleted_permanently',
    'listing',
    target_listing::text,
    jsonb_build_object(
      'owner_id', listing_owner,
      'note', nullif(trim(deletion_note), '')
    )
  );

  delete from public.listings where id = target_listing;
end;
$$;
revoke all on function public.admin_delete_listing(uuid,text) from public;
grant execute on function public.admin_delete_listing(uuid,text) to authenticated;
commit;
