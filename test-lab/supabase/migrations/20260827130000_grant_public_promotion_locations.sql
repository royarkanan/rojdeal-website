begin;

grant select (promotion_location_node_ids)
on public.profiles
to anon, authenticated;

commit;
