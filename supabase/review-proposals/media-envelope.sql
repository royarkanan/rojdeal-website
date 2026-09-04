-- REVIEW ONLY. Not a deployable migration and NOT applied to any database.
-- Requires schema/trigger inspection, local integration tests and owner approval.
-- Accommodate catalog maxima; category media-limit trigger MUST remain enabled.
begin;
do $$
declare
  duration_constraint text;
  order_constraint text;
  matches integer;
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_proc p on p.oid=t.tgfoid
    where t.tgrelid='public.listing_media'::regclass
      and not t.tgisinternal and t.tgenabled in ('O','A')
      and pg_get_functiondef(p.oid) like '%max_images%'
      and pg_get_functiondef(p.oid) like '%max_video_seconds%'
  ) then
    raise exception 'Review stopped: category media limits trigger not confirmed';
  end if;
  select count(*),min(c.conname) into matches,duration_constraint
  from pg_constraint c
  where c.conrelid='public.listing_media'::regclass and c.contype='c'
    and array_length(c.conkey,1)=2
    and (select attnum from pg_attribute where attrelid=c.conrelid and attname='duration_seconds')=any(c.conkey)
    and (select attnum from pg_attribute where attrelid=c.conrelid and attname='kind')=any(c.conkey);
  if matches<>1 then raise exception 'Review stopped: unexpected duration constraints'; end if;
  select count(*),min(c.conname) into matches,order_constraint
  from pg_constraint c
  where c.conrelid='public.listing_media'::regclass and c.contype='c'
    and array_length(c.conkey,1)=1
    and (select attnum from pg_attribute where attrelid=c.conrelid and attname='sort_order')=any(c.conkey);
  if matches<>1 then raise exception 'Review stopped: unexpected ordering constraints'; end if;
  execute format('alter table public.listing_media drop constraint %I',duration_constraint);
  execute format('alter table public.listing_media drop constraint %I',order_constraint);
  alter table public.listing_media add constraint listing_media_duration_envelope
    check ((kind='image' and duration_seconds is null) or (kind='video' and duration_seconds between 1 and 1800));
  alter table public.listing_media add constraint listing_media_order_envelope check (sort_order between 0 and 29);
end $$;
commit;
