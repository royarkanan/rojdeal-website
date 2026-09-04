-- Read-only. Does NOT return customer rows, credentials, or change anything.
-- Run in the existing RojDeal SQL editor and export the results for review.
select table_name,column_name,data_type,udt_name,is_nullable
from information_schema.columns
where table_schema='public' and table_name in
('support_requests','notifications','profiles','staff_assignments','staff_roles',
'staff_role_permissions','platform_owners','admin_audit_log','listings','listing_media')
order by table_name,ordinal_position;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('can_staff','get_my_staff_permissions','search_marketplace_ids',
'list_admin_audit_log','assign_scoped_staff_role_by_email',
'queue_admin_direct_message','replace_home_platform_videos','web_reply_support')
order by p.proname;

select tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in
('support_requests','notifications','listings','listing_media','profiles','web_support_messages')
order by tablename,policyname;
