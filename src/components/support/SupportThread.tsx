"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminText, displayDate } from '@/lib/admin-display';
import type { Locale } from '@/lib/i18n-config';
export function SupportThread({requestId,lang}:{requestId:string;lang:Locale}) {
  const [messages,setMessages]=useState<Array<{id:string;body:string;created_at:string;is_staff:boolean}>>([]);
  const [body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const sending=useRef(false);
  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('web_support_messages').select('id,body,created_at,is_staff').eq('request_id',requestId).order('created_at');
    if(error){setError(adminText('failed',lang));return;}setError('');setMessages(data ?? []);
  },[requestId,lang]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);return()=>clearInterval(timer);},[load]);
  return <section className="mt-3 space-y-3 rounded-xl bg-rojWarmBg p-3">
    <p className="font-bold">{adminText('reply',lang)}</p>
    {messages.map(m=><article key={m.id} className={`rounded-xl border p-3 ${m.is_staff?'bg-red-50':'bg-white'}`}><strong>{m.is_staff?'RojDeal':adminText('support',lang)}</strong><p className="whitespace-pre-wrap break-words">{m.body}</p><time className="text-xs">{displayDate(m.created_at)}</time></article>)}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <textarea aria-label={adminText('reply',lang)} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} className="min-h-24 w-full rounded-xl border p-3" />
    <button disabled={busy || body.trim().length<2} className="rounded-xl bg-rojNavy px-4 py-2 text-white disabled:opacity-50" onClick={async()=>{
      if(sending.current)return;sending.current=true;setBusy(true);setError('');
      try{const {error}=await supabase.rpc('web_reply_support',{target_request:requestId,message_body:body.trim()});if(error)throw error;setBody('');await load();}catch{setError(adminText('failed',lang));}finally{setBusy(false);sending.current=false;}
    }}>{busy?'…':adminText('send',lang)}</button>
  </section>;
}
