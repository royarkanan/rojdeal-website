import {supabase} from '@/lib/supabase';
export type OwnMedia={id:string;kind:'image'|'video';storage_path:string;sort_order:number;url:string};
async function ownerOf(listing:string){
 const {data:auth,error}=await supabase.auth.getUser();if(error)throw error;if(!auth.user)throw new Error('authentication_required');
 const row=await supabase.from('listings').select('id').eq('id',listing).eq('owner_id',auth.user.id).maybeSingle();
 if(row.error)throw row.error;if(!row.data)throw new Error('listing_owner_required');return auth.user.id;
}
export async function ownListingMedia(listing:string):Promise<OwnMedia[]>{
 const owner=await ownerOf(listing),result=await supabase.from('listing_media').select('id,kind,storage_path,sort_order').eq('listing_id',listing).eq('owner_id',owner).order('sort_order').order('id');
 if(result.error)throw result.error;
 return (result.data??[]).filter(row=>row.kind==='image'||row.kind==='video').map(row=>({...row,kind:row.kind as OwnMedia['kind'],url:supabase.storage.from(row.kind==='image'?'listing-images':'listing-videos').getPublicUrl(row.storage_path).data.publicUrl}));
}
export async function removeOwnListingMedia(listing:string,mediaId:string){
 const owner=await ownerOf(listing),result=await supabase.from('listing_media').select('id,kind,storage_path').eq('id',mediaId).eq('listing_id',listing).eq('owner_id',owner).maybeSingle();
 if(result.error)throw result.error;if(!result.data)return;
 const media=result.data;
 if(media.kind==='video'){
   const removed=await supabase.rpc('replace_own_listing_video',{target_listing:listing,new_storage_path:null,new_mime_type:null,new_size_bytes:null,new_duration_seconds:null});
   if(removed.error)throw removed.error;
 }else if(media.kind==='image'){
   const removed=await supabase.from('listing_media').delete().eq('id',mediaId).eq('listing_id',listing).eq('owner_id',owner).select('id');
   if(removed.error)throw removed.error;if(removed.data?.length!==1)throw new Error('media_removal_not_confirmed');
 }else throw new Error('invalid_media');
 // Remove the public reference first; never break the current listing if DB deletion is denied.
 if(media.storage_path.startsWith(`${owner}/${listing}/`)){
   try{await supabase.storage.from(media.kind==='image'?'listing-images':'listing-videos').remove([media.storage_path]);}catch{/* Committed deletion; existing orphan/retention cleanup may still be needed. */}
 }
}
