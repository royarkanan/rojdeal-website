'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import {adminText,displayDate} from '@/lib/admin-display';
import type {Locale} from '@/lib/i18n-config';
import {accountText,type AccountLabel} from '@/lib/account-copy';
import {savedSearchParams} from '@/lib/saved-search';
import {blockedUsers,changeSavedSearch,ownMetrics,ownPlan,ownProfile,savedSearches,unblock,type AccountProfile,type BlockedUser,type Metric,type SavedSearch} from '@/services/account';
import {useAccount} from './useAccount';
import {AccountState} from './AccountState';
import {PlanCard} from './PlanCard';
import {AccountPageHeader} from './AccountBackLink';
import type {AccountSectionName} from '@/lib/account-sections';
import {ArrowLeft,ArrowRight,Download} from 'lucide-react';
export function AccountSection({lang,section}:{lang:Locale;section:AccountSectionName}){
 const auth=useAccount();
 if(section==='help'||section==='ad-privacy')return <SectionData key={section} userId="" lang={lang} section={section}/>;
 if(auth.loading||auth.error||!auth.user)return <AccountState lang={lang} loading={auth.loading} error={auth.error} retry={auth.retry}/>;
 return <SectionData key={`${auth.user.id}:${section}`} userId={auth.user.id} lang={lang} section={section}/>;
}
function SectionData({lang,section,userId}:{lang:Locale;section:AccountSectionName;userId:string}){
 const t=(key:AccountLabel)=>accountText(lang,key);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[version,setVersion]=useState(0),[busy,setBusy]=useState(false),[actionError,setActionError]=useState(false);
 const [saved,setSaved]=useState<SavedSearch[]>([]),[blocked,setBlocked]=useState<BlockedUser[]>([]),[metrics,setMetrics]=useState<Metric[]>([]),[profile,setProfile]=useState<AccountProfile|null>(null),[advanced,setAdvanced]=useState(false);
 const lock=useRef(false);
 useEffect(()=>{let live=true;setLoading(true);setError(false);
 async function load(){try{
 if(section==='saved-searches'){const rows=await savedSearches(userId);if(live)setSaved(rows);}
 if(section==='blocked-users'){const rows=await blockedUsers();if(live)setBlocked(rows);}
 if(section==='subscription'||section==='analytics'){const p=await ownProfile(userId);if(live)setProfile(p);if(section==='analytics'){const [rows,plan]=await Promise.all([ownMetrics(userId),ownPlan(p)]);if(live){setMetrics(rows);setAdvanced(plan.plan?.analytics_level==='advanced');}}}
 }catch{if(live)setError(true);}finally{if(live)setLoading(false);}}
 void load();return()=>{live=false;};},[section,userId,version]);
 async function act(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setActionError(false);try{await fn();setVersion(v=>v+1);}catch{setActionError(true);}finally{lock.current=false;setBusy(false);}}
 const title:Record<AccountSectionName,AccountLabel>={'saved-searches':'saved','blocked-users':'blocked',analytics:'analytics',subscription:'details',help:'help','ad-privacy':'privacy'};
 const keys:[keyof Metric,AccountLabel][]=[['view_count','views'],['favorite_count','favorites'],...(advanced?[['call_count','calls'],['share_count','shares'],['message_count','messages']] as [keyof Metric,AccountLabel][]:[])];
 const number=(row:Metric,key:keyof Metric)=>typeof row[key]==='number'?Math.max(0,Number(row[key])):0;
 return <div className="mx-auto max-w-3xl space-y-5 pb-20"><AccountPageHeader lang={lang} title={title[section]}/>
 {actionError&&<p role="alert" className="rounded-xl bg-red-50 p-4">{t('actionError')}</p>}
 {loading||error?<AccountState lang={lang} loading={loading} error={error} retry={()=>setVersion(v=>v+1)}/>:<>
 {section==='saved-searches'&&(saved.length?saved.map(row=>{const params=savedSearchParams(row.filters);return <article key={row.id} className="space-y-4 rounded-3xl bg-white p-5"><h2 className="break-words text-lg font-bold">{row.name}</h2>{params?<Link href={`/${lang}/search?${new URLSearchParams(params)}`} className="inline-block rounded-xl bg-rojRed px-4 py-3 font-bold text-white">{t('open')}</Link>:<p>{t('unsupported')}</p>}<div className="flex flex-wrap items-center justify-between gap-4"><label className="flex items-center gap-3"><input type="checkbox" checked={row.alerts_enabled} disabled={busy} onChange={e=>{const enabled=e.target.checked;void act(()=>changeSavedSearch(row.id,userId,enabled));}}/>{t('alerts')}</label><button disabled={busy} className="rounded-xl border px-4 py-3 text-rojRed disabled:opacity-50" onClick={()=>{if(window.confirm(t('confirm')))void act(()=>changeSavedSearch(row.id,userId));}}>{t('remove')}</button></div></article>}):(
  <div className="rounded-3xl bg-white p-10 text-center text-gray-500">
    {t('empty')}
  </div>
))}
 {section==='blocked-users'&&(blocked.length?blocked.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5"><span className="break-words font-bold">{row.display_name||row.id}</span><button disabled={busy} className="rounded-xl border px-4 py-3 text-rojRed disabled:opacity-50" onClick={()=>{if(window.confirm(t('confirmUnblock')))void act(()=>unblock(userId,row.id));}}>{t('unblock')}</button></article>):(
  <div className="rounded-3xl bg-white p-10 text-center text-gray-500">
    {t('empty')}
  </div>
))}
 {section==='subscription'&&profile&&<PlanCard profile={profile} lang={lang} expanded/>}
 {section==='analytics'&&<><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{keys.map(([key,label])=><div key={key} className="rounded-2xl bg-white p-4"><p>{t(label)}</p><p className="mt-2 text-2xl font-black">{metrics.reduce((sum,row)=>sum+number(row,key),0).toLocaleString(lang)}</p></div>)}</div>{metrics.length?metrics.map(row=>{const state=row.listing_state;const path=state==='draft'?`/${lang}/listings/${row.listing_id}/edit`:state&&!['published','reserved'].includes(state)?`/${lang}/my-listings`:`/${lang}/listings/${row.listing_id}`;const image=row.listing_image_path;return <article key={row.listing_id} className="space-y-4 rounded-3xl bg-white p-5"><Link href={path} className="flex min-w-0 flex-wrap items-center gap-4 rounded-xl focus-visible:outline focus-visible:outline-rojRed">{image&&<img src={/^https?:\/\//.test(image)?image:supabase.storage.from('listing-images').getPublicUrl(image).data.publicUrl} alt="" className="h-24 w-28 rounded-xl object-cover" loading="lazy"/>}<div className="min-w-0 flex-1"><h2 className="break-words font-bold text-rojRed">{row.listing_title||row.listing_id}</h2><p className="mt-1 break-all text-xs" dir="ltr">ID: {row.public_code||row.listing_id}</p>{row.details_unavailable&&<p className="text-sm">{t('error')}</p>}{row.listing_area&&<p className="text-sm">{row.listing_area}</p>}{state&&<p className="text-sm">{adminText(state,lang)}</p>}{row.listing_created_at&&<p className="text-xs text-gray-500">{displayDate(row.listing_created_at)}</p>}</div></Link><dl className="flex flex-wrap gap-6">{keys.map(([key,label])=><div key={key}><dt>{t(label)}</dt><dd className="font-black">{number(row,key).toLocaleString(lang)}</dd></div>)}</dl></article>}):(
  <div className="rounded-3xl bg-white p-10 text-center text-gray-500">
    {t('empty')}
  </div>
)}</>}
 {section==='help'&&<div className="space-y-3">
 <a href="/guides/RojDeal_User_Guide_All_Languages.pdf" download dir="ltr" className="flex min-h-16 items-center justify-between gap-4 rounded-2xl bg-white p-5 font-bold transition hover:bg-red-50">
  <Download className="h-5 w-5 shrink-0 text-rojRed"/>
  <span dir={lang==='ar'?'rtl':'ltr'} className={`min-w-0 flex-1 ${lang==='ar'?'text-right':'text-left'}`}>{t('guide')}</span>
 </a>
 {([['support','contact'],['howto','how-to'],['policy','privacy'],['terms','terms'],['safety','safety'],['community','community-rules'],['deletion','account-deletion'],['about','about']] as [AccountLabel,string][]).map(([label,path])=>
  <Link key={path} href={`/${lang}/${path}`} dir="ltr" className="flex min-h-16 items-center justify-between gap-4 rounded-2xl bg-white p-5 font-bold transition hover:bg-red-50">
   <span className="shrink-0 text-rojNavy">{lang==='ar'?<ArrowLeft className="h-5 w-5"/>:<ArrowRight className="h-5 w-5"/>}</span>
   <span dir={lang==='ar'?'rtl':'ltr'} className={`min-w-0 flex-1 ${lang==='ar'?'text-right':'text-left'}`}>{t(label)}</span>
  </Link>
 )}
 </div>}
 {section==='ad-privacy'&&<div className="space-y-5 rounded-3xl bg-white p-6"><p>{t('noTracking')}</p><Link href={`/${lang}/privacy`} className="font-bold text-rojRed">{t('policy')}</Link></div>}
 </>}
 </div>;
}
