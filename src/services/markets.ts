import {supabase} from '@/lib/supabase';
export type Market={id:string;code:string;names:Record<string,string>;status:'draft'|'active'|'paused'|'archived';default_currency:string};
export async function markets():Promise<Market[]>{const {data,error}=await supabase.from('markets').select('id,code,names,status,default_currency').order('sort_order').order('code');if(error)throw error;return data??[];}
export async function addMarket(code:string,names:Record<string,string>,currency:string){
 const cleanCode=code.trim().toUpperCase(),cleanCurrency=currency.trim().toUpperCase();
 if(!/^[A-Z]{2,8}$/.test(cleanCode)||!/^[A-Z]{3}$/.test(cleanCurrency)||!Object.values(names).some(name=>name.trim()))throw new Error('invalid_market');
 const {data:auth,error:authError}=await supabase.auth.getUser();if(authError)throw authError;if(!auth.user)throw new Error('authentication_required');
 const {data,error}=await supabase.from('markets').insert({code:cleanCode,names:Object.fromEntries(['ar','ku','de','en'].map(lang=>[lang,(names[lang]??'').trim()])),status:'draft',default_currency:cleanCurrency,supported_currencies:[cleanCurrency],created_by:auth.user.id,updated_by:auth.user.id}).select('id');
 if(error)throw error;if(data?.length!==1)throw new Error('market_save_not_confirmed');
}
export async function changeMarketStatus(id:string,status:Market['status'],reason:string){
 if(!id||!['draft','active','paused','archived'].includes(status)||reason.trim().length<5)throw new Error('market_reason_required');
 const {error}=await supabase.rpc('set_market_status',{target_market:id,new_status:status,change_reason:reason.trim()});if(error)throw error;
}
