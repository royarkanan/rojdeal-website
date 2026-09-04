grant select (
  id, user_id, type, title, body, read_at, created_at, payload
) on public.notifications to authenticated;

grant update (read_at)
on public.notifications to authenticated;

grant select, insert, update, delete
on public.saved_searches to authenticated;

grant update (
  display_name,
  phone,
  account_type,
  business_name,
  office_address,
  direct_call_enabled,
  avatar_url,
  office_latitude,
  office_longitude
) on public.profiles to authenticated;
