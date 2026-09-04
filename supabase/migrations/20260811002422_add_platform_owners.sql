begin;
insert into public.profiles (
  id,
  display_name,
  role,
  account_type,
  preferred_language
)
values (
  '15dc7954-d452-43e0-8c74-e52985923b4d',
  'Royar',
  'admin',
  'individual',
  'ar'
)
on conflict (id) do update
set role = 'admin';
update public.profiles
set role = 'admin'
where id in (
  '1220c05a-02ee-447e-a1bd-1658c01ce6e8',
  '15dc7954-d452-43e0-8c74-e52985923b4d',
  '5cd64b56-0a7d-4c48-b640-095e38c5ca96'
);
insert into public.platform_owners (user_id)
values
  ('1220c05a-02ee-447e-a1bd-1658c01ce6e8'),
  ('15dc7954-d452-43e0-8c74-e52985923b4d'),
  ('5cd64b56-0a7d-4c48-b640-095e38c5ca96')
on conflict (user_id) do nothing;
commit;
