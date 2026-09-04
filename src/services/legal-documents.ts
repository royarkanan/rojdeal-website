import {supabase} from '@/lib/supabase';
import type {Locale} from '@/lib/i18n-config';
export const documentTypes=['privacy','terms','community_rules','account_deletion','impressum','payment_terms','cookie_policy','ad_privacy']as const;
export type LegalDocument={id?:string;document_type:typeof documentTypes[number];version:string;language:Locale;title:string;content:string;public_url:string;effective_at:string;is_active:boolean;requires_acceptance:boolean};
export async function legalDocuments(lang?:Locale):Promise<LegalDocument[]>{let q=supabase.from('legal_documents').select('id,document_type,version,language,title,content,public_url,effective_at,is_active,requires_acceptance');if(lang)q=q.eq('language',lang).eq('is_active',true).lte('effective_at',new Date().toISOString());const {data,error}=await q.order('document_type').order('effective_at',{ascending:false});if(error)throw error;return data??[];}
export async function saveLegalDocument(row:LegalDocument){
 if(!documentTypes.includes(row.document_type)||!row.version.trim()||row.title.trim().length<2||!row.content.trim()&&!row.public_url.trim()||!Number.isFinite(Date.parse(row.effective_at)))throw new Error('invalid_document');
 if(row.public_url&&!/^https:\/\//i.test(row.public_url))throw new Error('invalid_url');
 const {data,error}=await supabase.rpc('save_legal_document',{target_document:row.id??null,target_type:row.document_type,target_version:row.version.trim(),target_language:row.language,target_title:row.title.trim(),target_content:row.content,target_public_url:row.public_url.trim(),target_effective_at:row.effective_at,target_is_active:row.is_active,target_requires_acceptance:row.requires_acceptance});if(error)throw error;if(!data)throw new Error('save_not_confirmed');return String(data);
}
export async function acceptLegalDocument(id:string){const {error}=await supabase.rpc('accept_legal_document',{target_document:id,acceptance_source:'web',client_app_version:'rojdeal-web/1.0.0'});if(error)throw error;}
