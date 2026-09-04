-- Editable, non-secret UI wording. The bundled AR/KU/EN/DE text remains the
-- offline fallback; only active overrides are delivered to clients.
begin;

create table if not exists public.app_text_overrides (
  text_key text primary key check (text_key ~ '^[A-Za-z0-9_]{2,120}$'),
  values jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(values) = 'object')
);

alter table public.app_text_overrides enable row level security;

drop policy if exists "active app text is public" on public.app_text_overrides;
create policy "active app text is public" on public.app_text_overrides
for select using (is_active or public.can_staff('platform_content.manage'));

drop policy if exists "content staff manages app text" on public.app_text_overrides;
create policy "content staff manages app text" on public.app_text_overrides
for all to authenticated
using (public.can_staff('platform_content.manage'))
with check (public.can_staff('platform_content.manage'));

grant select on public.app_text_overrides to anon, authenticated;
grant insert, update, delete on public.app_text_overrides to authenticated;

commit;
