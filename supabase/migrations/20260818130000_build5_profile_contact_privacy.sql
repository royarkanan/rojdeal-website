-- Build 5: profile contact privacy and user-controlled direct calls.
-- A hidden phone number must not remain readable through a modified client.

create or replace function public.get_visible_profile(target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  viewer uuid := auth.uid();
  row_profile public.profiles%rowtype;
  is_staff boolean := false;
  can_view boolean := false;
begin
  select * into row_profile
  from public.profiles
  where id = target_user;

  if not found then
    return null;
  end if;

  if viewer is not null then
    is_staff := public.can_staff('users');
  end if;

  can_view := viewer = target_user
    or is_staff
    or (
      not coalesce(row_profile.is_suspended, false)
      and exists (
        select 1
        from public.listings listing
        where listing.owner_id = target_user
          and listing.state in ('published', 'reserved')
          and listing.deleted_at is null
      )
    )
    or (
      viewer is not null
      and exists (
        select 1
        from public.conversations conversation
        where (conversation.buyer_id = viewer and conversation.seller_id = target_user)
           or (conversation.seller_id = viewer and conversation.buyer_id = target_user)
      )
    );

  if not can_view then
    return null;
  end if;

  return jsonb_build_object(
    'id', row_profile.id,
    'display_name', row_profile.display_name,
    'phone', case
      when viewer = target_user or is_staff or row_profile.direct_call_enabled
        then row_profile.phone
      else null
    end,
    'avatar_url', row_profile.avatar_url,
    'account_type', row_profile.account_type,
    'business_name', row_profile.business_name,
    'office_address', row_profile.office_address,
    'office_latitude', row_profile.office_latitude,
    'office_longitude', row_profile.office_longitude,
    'role', row_profile.role,
    'is_identity_verified', row_profile.is_identity_verified,
    'account_tier', row_profile.account_tier,
    'promotion_location_node_id', row_profile.promotion_location_node_id,
    'is_suspended', row_profile.is_suspended,
    'suspension_reason', case
      when viewer = target_user or is_staff then row_profile.suspension_reason
      else null
    end,
    'direct_call_enabled', row_profile.direct_call_enabled
  );
end;
$$;
revoke all on function public.get_visible_profile(uuid) from public;
grant execute on function public.get_visible_profile(uuid) to anon, authenticated;
-- Remove the broad table grant, then expose only non-sensitive columns for
-- embedded listing/chat relations. Phone is available solely through the RPC.
revoke select on public.profiles from anon, authenticated;
grant select (
  id,
  display_name,
  avatar_url,
  account_type,
  business_name,
  office_address,
  office_latitude,
  office_longitude,
  role,
  is_identity_verified,
  account_tier,
  promotion_location_node_id,
  is_suspended,
  suspension_reason,
  direct_call_enabled,
  last_active_at,
  market_id
) on public.profiles to anon, authenticated;
comment on function public.get_visible_profile(uuid) is
  'Returns a visible profile while withholding phone and suspension details unless permitted.';
