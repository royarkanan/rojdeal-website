import {supabase} from '@/lib/supabase';
export type AccountProfile={id:string;display_name:string;account_type:string;avatar_url:string|null;account_tier:string;business_name:string|null;is_identity_verified?:boolean;is_suspended?:boolean;phone?:string|null;office_address?:string|null;direct_call_enabled?:boolean;office_latitude?:number|null;office_longitude?:number|null};
export type Plan={tier_key:string;names:Record<string,string>;descriptions:Record<string,string>;benefits:unknown[];analytics_level:string};
export type Subscription={tier_key:string;expires_at:string|null;manager_name?:string|null};
export type SavedSearch={id:string;name:string;filters:unknown;alerts_enabled:boolean};
export type BlockedUser={id:string;display_name:string};
export type Metric={listing_id:string;listing_title:string;listing_area?:string;listing_state?:string;listing_created_at?:string;listing_image_path?:string;public_code?:string;details_unavailable?:boolean;view_count:number;favorite_count:number;call_count:number;share_count:number;message_count:number};
export async function currentUser(){const {data,error}=await supabase.auth.getUser();if(error)throw error;return data.user;}
export async function ownProfile(id:string):Promise<AccountProfile>{const {data,error}=await supabase.rpc('get_visible_profile',{target_user:id});if(error)throw error;if(!data||data.id!==id)throw new Error('Profile unavailable');return data;}
export async function ownPlan(profile:AccountProfile){
 const [plans,subscription]=await Promise.all([supabase.from('tier_plans').select('tier_key,names,descriptions,benefits,analytics_level').eq('tier_key',profile.account_tier).maybeSingle(),supabase.rpc('get_my_subscription_details')]);
 if(plans.error)throw plans.error;if(subscription.error)throw subscription.error;
 return {plan:plans.data as Plan|null,subscription:(subscription.data?.[0]??null) as Subscription|null};
}
export async function savedSearches(id:string):Promise<SavedSearch[]>{const {data,error}=await supabase.from('saved_searches').select('id,name,filters,alerts_enabled').eq('user_id',id).order('created_at',{ascending:false});if(error)throw error;return data??[];}
export async function changeSavedSearch(id:string,userId:string,alerts?:boolean){
 const query=alerts===undefined?supabase.from('saved_searches').delete():supabase.from('saved_searches').update({alerts_enabled:alerts});
 const {data,error}=await query.eq('id',id).eq('user_id',userId).select('id');if(error)throw error;if(data?.length!==1)throw new Error('Change not applied');
}
export async function saveSearch(userId:string,name:string,filters:Record<string,unknown>){const {error}=await supabase.from('saved_searches').insert({user_id:userId,name:name.trim(),filters,alerts_enabled:true});if(error)throw error;}
export async function blockedUsers():Promise<BlockedUser[]>{const {data,error}=await supabase.rpc('list_my_blocked_users');if(error)throw error;return data??[];}
export async function unblock(userId:string,id:string){const {error}=await supabase.from('user_blocks').delete().eq('blocker_id',userId).eq('blocked_id',id);if(error)throw error;}
export async function ownMetrics(userId?:string):Promise<Metric[]>{
 const {data,error}=await supabase.rpc('get_my_listing_metrics');if(error)throw error;
 const metrics=(data??[])as Metric[];if(!userId||!metrics.length)return metrics;
 try{const details=new Map<string,Record<string,any>>();for(let start=0;start<metrics.length;start+=100){const result=await supabase.from('listings').select('id,title,public_code,area_label,state,created_at,listing_media(kind,storage_path,sort_order)').eq('owner_id',userId).in('id',metrics.slice(start,start+100).map(m=>m.listing_id));if(result.error)throw result.error;for(const row of result.data??[])details.set(row.id,row);}
 return metrics.map(metric=>{const row=details.get(metric.listing_id);if(!row)return {...metric,details_unavailable:true};const image=(row.listing_media??[]).filter((m:any)=>m.kind==='image').sort((a:any,b:any)=>Number(a.sort_order)-Number(b.sort_order))[0];return {...metric,listing_title:row.title,public_code:row.public_code,listing_area:row.area_label,listing_state:row.state,listing_created_at:row.created_at,listing_image_path:image?.storage_path??metric.listing_image_path};});
 }catch{return metrics.map(metric=>({...metric,details_unavailable:true}));}
}

export function localized(value:unknown,lang:string):string {if(typeof value==='string')return value;if(!value||typeof value!=='object')return '';const v=value as Record<string,unknown>;return String(v[lang]??v.ar??v.en??'');}

// Reads the existing app launch switch; a failed read must not activate paid marketing.
export async function tierUpgradesEnabled():Promise<boolean>{const {data,error}=await supabase.from('platform_content').select('tier_upgrades_enabled').eq('id',true).maybeSingle();if(error)throw error;return data?.tier_upgrades_enabled===true;}
