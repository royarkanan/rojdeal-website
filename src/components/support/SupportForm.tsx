"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { contactConfig } from '@/lib/contact-config';
import { adminText, displayDate } from '@/lib/admin-display';
import type { Locale } from '@/lib/i18n-config';
import { SupportThread } from './SupportThread';
const texts = {
 ar: ['التواصل مع الدعم','بريد التواصل','عنوان المشكلة (4 أحرف على الأقل)','اشرح المشكلة (15 حرفاً على الأقل)','رقم الإعلان — اختياري','تم إرسال الطلب. يمكنك متابعة الرد هنا بعد تسجيل الدخول.','تسجيل الدخول','الإعلانات','الدفع','الأمان','أخرى'],
 ku: ['Piştgirî','E-name','Sernav (herî kêm 4 tîp)','Pirsgirêk (herî kêm 15 tîp)','ID ya îlanê — vebijarkî','Daxwaz hat şandin. Piştî têketinê bersivan li vir bibîne.','Têketin','Îlan','Dayîn','Ewlehî','Din'],
 de: ['Support kontaktieren','Kontakt-E-Mail','Betreff (mindestens 4 Zeichen)','Problem (mindestens 15 Zeichen)','Anzeigen-ID — optional','Anfrage gesendet. Nach der Anmeldung kannst du Antworten hier verfolgen.','Anmeldung','Anzeigen','Zahlung','Sicherheit','Sonstiges'],
 en: ['Contact support','Contact email','Subject (at least 4 characters)','Problem (at least 15 characters)','Listing ID — optional','Request sent. Sign in to follow replies here.','Login','Listings','Payment','Safety','Other'],
};
type Ticket={id:string;subject:string;message:string;state:string;created_at:string};
export function SupportForm({lang}:{lang:Locale}) {
 const t=texts[lang]; const [email,setEmail]=useState(''),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[reference,setReference]=useState(''),[category,setCategory]=useState('login');
 const [tickets,setTickets]=useState<Ticket[]>([]),[opened,setOpened]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''); const sending=useRef(false);
 const [page,setPage]=useState(1),[hasNext,setHasNext]=useState(false),[focused,setFocused]=useState<Ticket|null>(null),[loading,setLoading]=useState(false);
 const generation=useRef(0);
 const load=useCallback(async()=>{
   const version=++generation.current;setLoading(true);
   try {
     const {data,error}=await supabase.auth.getUser();
     if(version!==generation.current)return;
     if(error || !data.user){setTickets([]);setFocused(null);setHasNext(false);return;}
     setEmail(e=>e || data.user?.email || '');
     const columns='id,subject,message,state,created_at';
     const result=await supabase.from('support_requests').select(columns).eq('requester_id',data.user.id).order('created_at',{ascending:false}).order('id').range((page-1)*24,page*24);
     if(result.error)throw result.error;
     const selected=opened ? await supabase.from('support_requests').select(columns).eq('requester_id',data.user.id).eq('id',opened).maybeSingle() : null;
     if(selected?.error)throw selected.error;
     if(version!==generation.current)return;
     setTickets((result.data??[]).slice(0,24));setHasNext((result.data?.length??0)>24);setFocused(selected?.data??null);
   } catch {if(version===generation.current)setNotice(adminText('failed',lang));}
   finally {if(version===generation.current)setLoading(false);}
 },[lang,page,opened]);
 useEffect(()=>{const guard=generation;void load();return()=>{guard.current++;};},[load]);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('request');if(id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))setOpened(id);},[]);
 const field='w-full rounded-xl border bg-white p-3';
 return <section className="mx-auto max-w-3xl space-y-5"><h1 className="text-2xl font-black">{t[0]}</h1><a href={`mailto:${contactConfig.supportEmail}`} className="block rounded-xl bg-white p-4" dir="ltr">{contactConfig.supportEmail}</a>
 <form className="space-y-3 rounded-2xl bg-white p-4" onSubmit={async e=>{e.preventDefault();if(sending.current)return;sending.current=true;setBusy(true);setNotice('');try{
  const {data}=await supabase.auth.getUser();
  const body=reference.trim()?`[Listing: ${reference.trim()}]\n${message.trim()}`:message.trim();
  const {error}=await supabase.from('support_requests').insert({requester_id:data.user?.id ?? null,contact_email:email.trim(),category,subject:subject.trim(),message:body});if(error)throw error;
  setSubject('');setMessage('');setReference('');await load();setNotice(data.user?t[5]:({ar:'تم إرسال الطلب. الطلب المرسل دون تسجيل دخول لا يظهر في حسابك لاحقاً؛ يمكنك المتابعة عبر بريد الدعم.',ku:'Daxwaz hat şandin. Ji bo şopandinê bi e-nameyê têkilî dayne.',de:'Anfrage gesendet. Anonyme Anfragen erscheinen später nicht im Konto. Bitte per Support-E-Mail nachfragen.',en:'Request sent. Anonymous requests will not appear in your account later; follow up by support email.'})[lang]);
 }catch{setNotice(adminText('failed',lang));}finally{setBusy(false);sending.current=false;}}}>
 <select className={field} value={category} onChange={e=>setCategory(e.target.value)} aria-label={t[0]}>{['login','listing','payment','safety','other'].map((v,i)=><option key={v} value={v}>{t[i+6]}</option>)}</select>
 <label className="block">{t[1]}<input required type="email" dir="ltr" className={field} value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label className="block">{t[4]}<input maxLength={80} dir="ltr" className={field} value={reference} onChange={e=>setReference(e.target.value)}/></label>
 <label className="block">{t[2]}<input required minLength={4} maxLength={120} className={field} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
 <label className="block">{t[3]}<textarea required minLength={15} maxLength={1800} rows={5} className={field} value={message} onChange={e=>setMessage(e.target.value)}/></label>
 {notice && <p role="status" className="rounded-xl bg-amber-50 p-3">{notice}</p>}
 <button disabled={busy} className="w-full rounded-xl bg-rojRed p-3 font-bold text-white disabled:opacity-50">{busy?'…':adminText('send',lang)}</button></form>
 {(focused && !tickets.some(ticket=>ticket.id===focused.id)?[focused,...tickets]:tickets).map(ticket=><article key={ticket.id} className="space-y-2 rounded-2xl bg-white p-4"><h2 className="font-bold">{ticket.subject}</h2><p>{adminText(ticket.state,lang)} · {displayDate(ticket.created_at)}</p><p className="whitespace-pre-wrap break-words">{ticket.message}</p><p dir="ltr" className="break-all text-xs">{ticket.id}</p><button className="rounded-xl border px-3 py-2" onClick={()=>setOpened(opened===ticket.id?'':ticket.id)}>{adminText('reply',lang)}</button>{opened===ticket.id && <SupportThread key={ticket.id} requestId={ticket.id} lang={lang}/>}</article>)}
 {(page>1 || hasNext) && <nav className="flex justify-center gap-3"><button disabled={loading||page===1} onClick={()=>setPage(p=>p-1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">{({ar:'السابق',ku:'Berê',de:'Zurück',en:'Previous'})[lang]}</button><span className="p-3">{page}</span><button disabled={loading||!hasNext} onClick={()=>setPage(p=>p+1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">{({ar:'التالي',ku:'Piştî',de:'Weiter',en:'Next'})[lang]}</button></nav>}
 </section>;
}
