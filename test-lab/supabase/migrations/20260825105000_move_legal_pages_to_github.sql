begin;

update public.legal_documents
set public_url = 'https://royarkanan.github.io/RojDeal-Legal/legal/?type=' || document_type || '&lang=' || language,
    updated_at = now()
where is_active
  and document_type in (
    'privacy', 'terms', 'community_rules', 'account_deletion',
    'impressum', 'ad_privacy', 'payment_terms', 'cookie_policy'
  )
  and language in ('de', 'en', 'ar', 'ku');

commit;
