"use client";
import {useRef,useState} from 'react';
import type {Locale} from '@/lib/i18n-config';
import {supabase} from '@/lib/supabase';
const copy={
 ar:['إرسال إشعار للمستخدم','العنوان','نص الرسالة','إرسال','تم وضع الإشعار في قائمة الإرسال.','تعذر إرسال الإشعار.','تأكيد إرسال الإشعار لهذا المستخدم؟'],
 ku:['Ji bikarhêner re agahdarî bişîne','Sernav','Peyam','Bişîne','Agahdarî li bendê şandinê ye.','Peyam nehat şandin.','Ji vî bikarhênerî re bişîne?'],
 de:['Benutzer benachrichtigen','Betreff','Nachricht','Senden','Benachrichtigung zum Versand vorgemerkt.','Senden fehlgeschlagen.','An diesen Benutzer senden?'],
 en:['Notify user','Subject','Message','Send','In-account notification queued.','Could not send notification.','Send to this user?'],
};
export function AdminMessageComposer({userId,lang}:{userId:string;lang:Locale}){
 const t=copy[lang];const [open,setOpen]=useState(false),[title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');const lock=useRef(false);
 return <div className="mt-3 space-y-2"><button type="button" className="rounded-xl border px-3 py-2 font-bold" onClick={()=>setOpen(!open)} aria-expanded={open}>{t[0]}</button>{open&&<form className="space-y-2 rounded-xl bg-rojWarmBg p-3" onSubmit={async e=>{
 e.preventDefault();if(lock.current || !window.confirm(`${t[6]}\n${userId}`))return;
 lock.current=true;setBusy(true);setNotice('');
 try{const {error}=await supabase.rpc('queue_admin_direct_message',{target_user:userId,message_title:title.trim(),message_body:body.trim(),delivery_channel:'notification'});if(error)throw error;setTitle('');setBody('');setNotice(t[4]);}catch{setNotice(t[5]);}finally{lock.current=false;setBusy(false);}
 }}><label className="block">{t[1]}<input required minLength={2} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border p-3"/></label><label className="block">{t[2]}<textarea required minLength={2} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} className="w-full rounded-xl border p-3"/></label>{notice&&<p role="status">{notice}</p>}<button disabled={busy||title.trim().length<2||body.trim().length<2} className="rounded-xl bg-rojRed px-4 py-2 font-bold text-white disabled:opacity-50">{busy?'…':t[3]}</button></form>}</div>;
}
