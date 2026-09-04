'use client';
import {useRef,useState} from 'react';
import Link from 'next/link';
import type {Locale} from '@/lib/i18n-config';
import {accountText,type AccountLabel} from '@/lib/account-copy';
import {sharedSearchFilters} from '@/lib/saved-search';
import {currentUser,saveSearch} from '@/services/account';
export function SaveSearch({lang,params}:{lang:Locale;params:Record<string,string>}){
 const t=(key:AccountLabel)=>accountText(lang,key),filters=sharedSearchFilters(params),lock=useRef(false);
 const [open,setOpen]=useState(false),[name,setName]=useState(params.q||''),[busy,setBusy]=useState(false),[status,setStatus]=useState<AccountLabel|null>(null);
 return <section className="rounded-2xl bg-white p-4"><button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} className="font-bold text-rojRed">{t('save')}</button>{open&&(!filters?<p className="mt-3">{t('unsupported')}</p>:<form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={async e=>{e.preventDefault();if(lock.current||!name.trim())return;lock.current=true;setBusy(true);setStatus(null);try{const user=await currentUser();if(!user){setStatus('required');return;}await saveSearch(user.id,name,filters);setStatus('savedOk');}catch{setStatus('actionError');}finally{lock.current=false;setBusy(false);}}}><label className="flex min-w-0 flex-1 flex-col gap-2">{t('name')}<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="rounded-xl border p-3"/></label><button disabled={busy||status==='savedOk'} className="rounded-xl bg-rojRed px-5 py-3 font-bold text-white disabled:opacity-50">{t('save')}</button></form>)}{status&&<p role="status" className="mt-3">{t(status)} {status==='required'&&<Link href={`/${lang}/auth`} className="text-rojRed">{t('login')}</Link>}{status==='savedOk'&&<Link href={`/${lang}/account/saved-searches`} className="text-rojRed">{t('saved')}</Link>}</p>}</section>;
}
