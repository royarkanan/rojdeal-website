begin;

-- Public visitors need only the published operator row and currently active
-- legal documents. Admin access remains covered by the existing authenticated
-- management policies. Avoid calling privileged helper functions from an anon
-- RLS policy because hardened EXECUTE grants can otherwise make public reads fail.

grant select on public.legal_operator_settings to anon, authenticated;
grant select on public.legal_documents to anon, authenticated;

drop policy if exists "published legal operator public read"
on public.legal_operator_settings;
create policy "published legal operator public read"
on public.legal_operator_settings
for select
to anon, authenticated
using (is_published);

drop policy if exists "active legal documents public read"
on public.legal_documents;
create policy "active legal documents public read"
on public.legal_documents
for select
to anon, authenticated
using (is_active and effective_at <= now());

commit;
