-- Build 5: granular legal-editor access and audited legal CMS APIs.

begin;

drop policy if exists "published legal operator public read"
on public.legal_operator_settings;
create policy "published legal operator public read"
on public.legal_operator_settings
for select using (is_published or public.can_staff('legal'));

drop policy if exists "owner manages legal operator"
on public.legal_operator_settings;
create policy "legal staff manage operator"
on public.legal_operator_settings
for all to authenticated using (public.can_staff('legal'))
with check (public.can_staff('legal'));

drop policy if exists "active legal documents public read"
on public.legal_documents;
create policy "active legal documents public read"
on public.legal_documents
for select using (is_active or public.can_staff('legal'));

drop policy if exists "admins manage legal documents"
on public.legal_documents;
create policy "legal staff manage legal documents"
on public.legal_documents
for all to authenticated using (public.can_staff('legal'))
with check (public.can_staff('legal'));

drop policy if exists "users read own legal acceptances"
on public.legal_acceptances;
create policy "users read own legal acceptances"
on public.legal_acceptances
for select to authenticated using (
  user_id = auth.uid() or public.can_staff('legal')
);

create or replace function public.save_legal_document(
  target_document uuid,
  target_type text,
  target_version text,
  target_language text,
  target_title text,
  target_content text,
  target_public_url text,
  target_effective_at timestamptz,
  target_is_active boolean,
  target_requires_acceptance boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare saved_id uuid;
begin
  if not public.can_staff('legal') then
    raise exception 'legal_permission_required' using errcode = '42501';
  end if;
  if target_type not in (
    'privacy','terms','community_rules','account_deletion',
    'impressum','payment_terms','cookie_policy','ad_privacy'
  ) then raise exception 'invalid_legal_document_type'; end if;
  if target_language not in ('ar','ku','en','de') then
    raise exception 'invalid_language';
  end if;
  if char_length(trim(coalesce(target_version,''))) < 1
     or char_length(trim(coalesce(target_title,''))) < 2
     or (trim(coalesce(target_content,'')) = ''
         and trim(coalesce(target_public_url,'')) = '') then
    raise exception 'legal_document_fields_required';
  end if;

  if target_is_active then
    update public.legal_documents set
      is_active = false,
      updated_by = auth.uid(),
      updated_at = now()
    where document_type = target_type
      and language = target_language
      and (target_document is null or id <> target_document);
  end if;

  if target_document is null then
    insert into public.legal_documents(
      document_type,version,language,title,content,public_url,effective_at,
      is_active,requires_acceptance,created_by,updated_by
    ) values (
      target_type,trim(target_version),target_language,trim(target_title),
      coalesce(target_content,''),trim(coalesce(target_public_url,'')),
      target_effective_at,target_is_active,target_requires_acceptance,
      auth.uid(),auth.uid()
    ) returning id into saved_id;
  else
    update public.legal_documents set
      document_type = target_type,
      version = trim(target_version),
      language = target_language,
      title = trim(target_title),
      content = coalesce(target_content,''),
      public_url = trim(coalesce(target_public_url,'')),
      effective_at = target_effective_at,
      is_active = target_is_active,
      requires_acceptance = target_requires_acceptance,
      updated_by = auth.uid(),
      updated_at = now()
    where id = target_document
    returning id into saved_id;
    if saved_id is null then raise exception 'legal_document_not_found'; end if;
  end if;

  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'legal_document_saved','legal_document',saved_id::text,
    jsonb_build_object('type',target_type,'version',trim(target_version),
      'language',target_language,'active',target_is_active,
      'requires_acceptance',target_requires_acceptance));
  return saved_id;
end;
$$;

create or replace function public.save_legal_operator_settings(
  target_legal_name text,
  target_business_name text,
  target_postal_address text,
  target_country_code text,
  target_contact_email text,
  target_contact_phone text,
  target_responsible_person text,
  target_registration_details text,
  target_tax_details text,
  target_is_published boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_staff('legal') then
    raise exception 'legal_permission_required' using errcode = '42501';
  end if;
  if target_is_published and (
    char_length(trim(coalesce(target_legal_name,''))) < 2
    or char_length(trim(coalesce(target_postal_address,''))) < 5
    or char_length(trim(coalesce(target_contact_email,''))) < 5
    or char_length(trim(coalesce(target_responsible_person,''))) < 2
  ) then raise exception 'published_operator_fields_required'; end if;
  insert into public.legal_operator_settings(
    id,legal_name,business_name,postal_address,country_code,contact_email,
    contact_phone,responsible_person,registration_details,tax_details,
    is_published,updated_by,updated_at
  ) values (
    true,trim(coalesce(target_legal_name,'')),trim(coalesce(target_business_name,'')),
    trim(coalesce(target_postal_address,'')),upper(trim(coalesce(target_country_code,'DE'))),
    lower(trim(coalesce(target_contact_email,''))),trim(coalesce(target_contact_phone,'')),
    trim(coalesce(target_responsible_person,'')),trim(coalesce(target_registration_details,'')),
    trim(coalesce(target_tax_details,'')),target_is_published,auth.uid(),now()
  ) on conflict (id) do update set
    legal_name=excluded.legal_name,business_name=excluded.business_name,
    postal_address=excluded.postal_address,country_code=excluded.country_code,
    contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,
    responsible_person=excluded.responsible_person,
    registration_details=excluded.registration_details,
    tax_details=excluded.tax_details,is_published=excluded.is_published,
    updated_by=excluded.updated_by,updated_at=now();
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'legal_operator_saved','legal_operator','primary',
    jsonb_build_object('published',target_is_published));
end;
$$;

revoke all on function public.save_legal_document(uuid,text,text,text,text,text,text,timestamptz,boolean,boolean) from public;
revoke all on function public.save_legal_operator_settings(text,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.save_legal_document(uuid,text,text,text,text,text,text,timestamptz,boolean,boolean) to authenticated;
grant execute on function public.save_legal_operator_settings(text,text,text,text,text,text,text,text,text,boolean) to authenticated;

commit;
