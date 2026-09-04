-- Connect the configurable catalog to listing publication rules.
begin;
create or replace function public.validate_listing_dynamic_configuration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  category_row public.listing_categories_config%rowtype;
  type_row public.listing_category_types%rowtype;
  missing_key text;
begin
  if new.category_config_id is null then
    select * into category_row
    from public.listing_categories_config
    where category_key = coalesce(new.category_key, new.category::text);
    new.category_config_id = category_row.id;
  else
    select * into category_row
    from public.listing_categories_config
    where id = new.category_config_id;
  end if;

  if category_row.id is null then
    raise exception 'invalid_listing_category';
  end if;
  if not category_row.is_active and not public.can_staff('listings') then
    raise exception 'listing_category_disabled' using errcode = '42501';
  end if;

  if new.category_type_id is not null then
    select * into type_row
    from public.listing_category_types
    where id = new.category_type_id;
    if type_row.id is null or type_row.category_id <> category_row.id then
      raise exception 'invalid_listing_category_type';
    end if;
    if not type_row.is_active and not public.can_staff('listings') then
      raise exception 'listing_category_type_disabled' using errcode = '42501';
    end if;
  end if;

  new.category_key = category_row.category_key;
  new.purpose_key = coalesce(
    nullif(new.purpose_key, ''),
    case when new.listing_direction = 'wanted'
      then 'wanted' else new.purpose::text end
  );

  if not exists (
    select 1
    from public.listing_purpose_definitions as purpose
    where purpose.purpose_key = new.purpose_key
      and (purpose.is_active or public.can_staff('listings'))
  ) then
    raise exception 'listing_purpose_disabled' using errcode = '42501';
  end if;
  if not (new.purpose_key = any(category_row.allowed_purpose_keys)) then
    raise exception 'listing_purpose_not_available_for_category';
  end if;

  if new.state::text in ('published', 'reserved') then
    select field.field_key into missing_key
    from public.category_field_definitions as field
    where field.category_id = category_row.id
      and field.is_active
      and field.is_required
      and (field.category_type_id is null
        or field.category_type_id = new.category_type_id)
      and not (
        coalesce(new.attributes, '{}'::jsonb) ? field.field_key
        and nullif(trim(coalesce(new.attributes->>field.field_key, '')), '')
          is not null
      )
    order by field.sort_order, field.field_key
    limit 1;
    if missing_key is not null then
      raise exception 'required_dynamic_field_missing'
        using detail = missing_key, errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
commit;
