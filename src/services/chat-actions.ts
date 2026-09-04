import {supabase} from '@/lib/supabase';

export async function deleteChatMessage(messageId:string,scope:'me'|'everyone') {
  if(!messageId || !['me','everyone'].includes(scope))throw new Error('invalid_message');
  const {error}=await supabase.rpc(scope==='me'?'delete_message_for_me':'delete_message_for_everyone',{
    target_message:messageId,...(scope==='everyone'?{deletion_note:null}:{}),
  });
  if(error)throw error;
}

export const CHAT_ATTACHMENT_LIMIT=25*1024*1024;
export type ChatSendAttempt={owner?:string;conversation?:string;messageId?:string;attachmentId?:string;file?:File;body?:string;uploaded?:boolean;attempted?:boolean;path?:string};
export async function cancelChatAttachment(attempt:ChatSendAttempt):Promise<'sent'|'cancelled'>{
  if(!attempt.messageId)return 'cancelled';
  const {data:auth,error}=await supabase.auth.getUser();if(error)throw error;
  if(!auth.user||auth.user.id!==attempt.owner)throw new Error('authentication_required');
  const attachment=await supabase.from('message_attachments').select('id').eq('id',attempt.attachmentId!).maybeSingle();
  if(attachment.error)throw attachment.error;if(attachment.data)return 'sent';
  const abandoned=await supabase.rpc('abandon_message_upload',{target_message:attempt.messageId});
  if(abandoned.error)throw abandoned.error;
  const remaining=await supabase.from('messages').select('id').eq('id',attempt.messageId).maybeSingle();
  if(remaining.error)throw remaining.error;if(remaining.data)throw new Error('upload_cannot_be_cancelled');
  if(attempt.path){try{await supabase.storage.from('chat-attachments').remove([attempt.path]);}catch{/* Retention cleanup may still be required for an unreferenced upload. */}}
  return 'cancelled';
}
const mimeTypes:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};

// Stable IDs keep a retry from sending a second message when a response is lost.
// RLS and Storage policies remain the authority; no privileged client is used.
export async function sendChatAttachment(conversation:string,file:File,body:string,attempt:ChatSendAttempt){
  if(file.size<1||file.size>CHAT_ATTACHMENT_LIMIT||!file.name.trim()||file.name.length>255||body.trim().length>2000)throw new Error('invalid_attachment');
  const mime=mimeTypes[file.name.split('.').pop()?.toLowerCase()??''];
  if(!mime)throw new Error('unsupported_attachment');
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError)throw authError;if(!auth.user)throw new Error('authentication_required');
  if(attempt.owner&&(attempt.owner!==auth.user.id||attempt.conversation!==conversation||attempt.file!==file||attempt.body!==body.trim()))throw new Error('pending_attachment_changed');
  attempt.owner=auth.user.id;attempt.conversation=conversation;attempt.file=file;attempt.body=body.trim();
  attempt.messageId??=crypto.randomUUID();attempt.attachmentId??=crypto.randomUUID();
  attempt.path??=`${conversation}/${auth.user.id}/${attempt.messageId}-${file.name.replace(/[^A-Za-z0-9._-]/g,'_')}`;
  const message=await supabase.from('messages').select('id,sender_id,conversation_id,deleted_for_everyone_at').eq('id',attempt.messageId).maybeSingle();
  if(message.error)throw message.error;
  if(message.data){
    if(message.data.sender_id!==auth.user.id||message.data.conversation_id!==conversation||message.data.deleted_for_everyone_at)throw new Error('message_unavailable');
  }else{
    const {error}=await supabase.from('messages').insert({id:attempt.messageId,conversation_id:conversation,sender_id:auth.user.id,message_type:body.trim()?'mixed':'attachment',body:body.trim()});
    if(error)throw error;
  }
  const existing=await supabase.from('message_attachments').select('id,message_id,storage_path,upload_state,deleted_at').eq('id',attempt.attachmentId).maybeSingle();
  if(existing.error)throw existing.error;
  if(existing.data){
    if(existing.data.message_id!==attempt.messageId||existing.data.storage_path!==attempt.path||existing.data.upload_state!=='complete'||existing.data.deleted_at)throw new Error('attachment_unavailable');
    return attempt.messageId;
  }
  if(!attempt.uploaded){
    const retry=attempt.attempted;attempt.attempted=true;
    const {error}=await supabase.storage.from('chat-attachments').upload(attempt.path,file,{contentType:mime,upsert:false});
    // Only accept a conflict for this same unpredictable path after an uncertain upload.
    if(error&&!(retry&&['409','Duplicate'].includes(String((error as {statusCode?:string;error?:string}).statusCode??(error as {error?:string}).error))))throw error;
    attempt.uploaded=true;
  }
  const {error}=await supabase.from('message_attachments').insert({id:attempt.attachmentId,message_id:attempt.messageId,conversation_id:conversation,uploader_id:auth.user.id,kind:mime.startsWith('image/')?'image':mime==='application/pdf'?'pdf':'file',storage_path:attempt.path,original_name:file.name,mime_type:mime,size_bytes:file.size});
  if(error)throw error;
  // A failure updating list order must not turn a completed send into a duplicate retry.
  try{await supabase.from('conversations').update({last_message_at:new Date().toISOString()}).eq('id',conversation);}catch{/* message and attachment already acknowledged */}
  return attempt.messageId;
}
