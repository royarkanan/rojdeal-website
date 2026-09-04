begin;
create table if not exists public.ad_consent_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  personalized_ads boolean not null default false,
  consent_version text not null,
  decided_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ad_consent_preferences enable row level security;
drop policy if exists "users manage own ad consent" on public.ad_consent_preferences;
create policy "users manage own ad consent" on public.ad_consent_preferences
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.ad_consent_preferences to authenticated;
create or replace function public.get_active_direct_ad(
  target_placement text,
  target_language text
) returns table (
  campaign_id uuid, creative_id uuid, headline text, body text,
  call_to_action text, media_url text, creative_type text,
  destination_type text, destination_url text, listing_id uuid,
  internal_route text
)
language sql
security definer
set search_path = public
as $$
  select campaign.id, creative.id, creative.headline, creative.body,
    creative.call_to_action, creative.media_url, creative.creative_type,
    campaign.destination_type, campaign.destination_url,
    campaign.listing_id, campaign.internal_route
  from public.ad_placements as placement
  join public.ad_campaigns as campaign
    on target_placement = any(campaign.placement_keys)
  join public.ad_creatives as creative on creative.campaign_id = campaign.id
  where placement.placement_key = target_placement and placement.is_enabled
    and placement.provider_mode in ('direct','mixed')
    and campaign.status in ('scheduled','active')
    and (campaign.start_at is null or campaign.start_at <= now())
    and (campaign.end_at is null or campaign.end_at > now())
    and creative.is_active
    and creative.language in (target_language, 'ar', 'en')
    and (campaign.impression_limit is null or campaign.impression_limit > (
      select count(*) from public.ad_events e
      where e.campaign_id = campaign.id and e.event_type = 'impression'
    ))
  order by case when creative.language = target_language then 0 else 1 end,
    campaign.priority desc, creative.sort_order, random()
  limit 1;
$$;
grant execute on function public.get_active_direct_ad(text,text) to anon, authenticated;
create or replace function public.save_direct_ad_campaign(
  target_campaign uuid,
  advertiser_name text,
  campaign_title text,
  target_status text,
  target_start timestamptz,
  target_end timestamptz,
  target_placements text[],
  target_destination_url text,
  creative_language text,
  creative_headline text,
  creative_body text,
  creative_action text,
  creative_media_url text,
  creative_kind text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare advertiser uuid;
declare campaign uuid := coalesce(target_campaign, gen_random_uuid());
begin
  if not public.can_staff('ads') then
    raise exception 'ad_management_permission_required' using errcode = '42501';
  end if;
  select id into advertiser from public.advertisers
  where lower(name) = lower(trim(advertiser_name)) and status <> 'archived'
  order by created_at limit 1;
  if advertiser is null then
    insert into public.advertisers(name,created_by)
    values(trim(advertiser_name),auth.uid()) returning id into advertiser;
  end if;
  insert into public.ad_campaigns(
    id,advertiser_id,title,status,start_at,end_at,campaign_type,
    destination_type,destination_url,placement_keys,created_by,updated_by
  ) values (
    campaign,advertiser,trim(campaign_title),target_status,target_start,target_end,
    'direct',case when nullif(trim(target_destination_url),'') is null then 'none' else 'url' end,
    nullif(trim(target_destination_url),''),target_placements,auth.uid(),auth.uid()
  ) on conflict (id) do update set advertiser_id=excluded.advertiser_id,
    title=excluded.title,status=excluded.status,start_at=excluded.start_at,
    end_at=excluded.end_at,destination_type=excluded.destination_type,
    destination_url=excluded.destination_url,placement_keys=excluded.placement_keys,
    updated_by=auth.uid(),updated_at=now();
  delete from public.ad_creatives where campaign_id=campaign and language=creative_language;
  insert into public.ad_creatives(
    campaign_id,creative_type,media_url,headline,body,call_to_action,language
  ) values (
    campaign,creative_kind,coalesce(trim(creative_media_url),''),
    trim(creative_headline),trim(creative_body),trim(creative_action),creative_language
  );
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'ad_campaign_saved','ad_campaign',campaign::text,
    jsonb_build_object('status',target_status,'placements',target_placements));
  return campaign;
end;
$$;
revoke all on function public.save_direct_ad_campaign(uuid,text,text,text,timestamptz,timestamptz,text[],text,text,text,text,text,text,text) from public;
grant execute on function public.save_direct_ad_campaign(uuid,text,text,text,timestamptz,timestamptz,text[],text,text,text,text,text,text,text) to authenticated;
commit;
