import {supabase} from '@/lib/supabase';
export const reportReasons=['spam','fraud','illegal','harassment','hate','sexual','violence','privacy','misleading','duplicate','wrong_category','other'] as const;
export async function reportContent(target:'listing'|'user',id:string,reason:typeof reportReasons[number],details:string){
 if(!reportReasons.includes(reason)||reason==='other'&&details.trim().length<3)throw new Error('report_details_required');
 const {data,error}=await supabase.auth.getUser();if(error)throw error;if(!data.user)throw new Error('authentication_required');
 const result=await supabase.rpc('submit_safety_report',{report_target_type:target,report_target_id:id,report_reason:reason,report_details:details.trim()||null});if(result.error)throw result.error;
}
export async function blockSeller(id:string){const {data,error}=await supabase.auth.getUser();if(error)throw error;if(!data.user)throw new Error('authentication_required');if(data.user.id===id)throw new Error('cannot_block_self');const result=await supabase.from('user_blocks').insert({blocker_id:data.user.id,blocked_id:id});if(result.error&&result.error.code!=='23505')throw result.error;}
