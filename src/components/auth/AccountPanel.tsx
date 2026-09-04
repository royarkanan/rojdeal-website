'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Bell,Bookmark,ChevronRight,Globe,Heart,HelpCircle,LogOut,Megaphone,MessageSquare,Settings,ShieldCheck,ShieldOff,Trash2,UserRound} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {adminAccess} from '@/services/web-features';
import {ownProfile,tierUpgradesEnabled,type AccountProfile} from '@/services/account';
import {accountText,type AccountLabel} from '@/lib/account-copy';
import type {Locale} from '@/lib/i18n-config';
import {LanguageSwitcher} from '@/components/common/LanguageSwitcher';
import {useAccount} from '@/components/account/useAccount';
import {AccountState} from '@/components/account/AccountState';
import {PlanCard} from '@/components/account/PlanCard';
export function AccountPanel({lang}:{lang:Locale}){
 const t=(key:AccountLabel)=>accountText(lang,key),router=useRouter(),auth=useAccount();
 const [loadedProfile,setProfile]=useState<AccountProfile|null>(null),[failed,setFailed]=useState(false),[showAdmin,setShowAdmin]=useState(false),[version,setVersion]=useState(0),[busy,setBusy]=useState(false),[actionError,setActionError]=useState(false);
 const [tiersEnabled,setTiersEnabled]=useState(false);
 useEffect(()=>{let live=true;void tierUpgradesEnabled().then(v=>{if(live)setTiersEnabled(v);}).catch(()=>{});return()=>{live=false;};},[]);
 const id=auth.user?.id;
 const profile=loadedProfile?.id===id?loadedProfile:null;
 useEffect(()=>{let live=true;setProfile(null);setFailed(false);setShowAdmin(false);if(id){void ownProfile(id).then(p=>{if(live)setProfile(p);}).catch(()=>{if(live)setFailed(true);});void adminAccess().then(a=>{if(live)setShowAdmin(a.allowed);}).catch(()=>{});}return()=>{live=false;};},[id,version]);
 if(auth.loading||auth.error)return <AccountState lang={lang} loading={auth.loading} error={auth.error} retry={auth.retry}/>;
 if(!auth.user)return <div className="mx-auto max-w-3xl space-y-4"><AccountState lang={lang}/><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5"><span className="font-bold">{t('language')}</span><LanguageSwitcher currentLocale={lang}/></div><Link className="block rounded-2xl bg-white p-5 font-bold" href={`/${lang}/account/help`}>{t('help')}</Link></div>;
 const name=profile?.display_name||String(auth.user.user_metadata?.display_name||auth.user.email?.split('@')[0]||'RojDeal');
 const links:[AccountLabel,string,typeof Settings][]=[['edit','account/edit',Settings],['analytics','account/analytics',Megaphone],['listings','my-listings',Megaphone],['saved','account/saved-searches',Bookmark],['messages','messages',MessageSquare],['favorites','favorites',Heart],['notifications','notifications',Bell],['help','account/help',HelpCircle],['blocked','account/blocked-users',ShieldOff],['privacy','account/ad-privacy',ShieldCheck],['deletion','account-deletion',Trash2]];
 if(showAdmin&&profile)links.push(['admin','admin',ShieldCheck]);
 return <div className="mx-auto max-w-3xl space-y-5 pb-20 md:pb-8">
 <div className="flex items-center justify-between"><h1 className="text-3xl font-black text-rojNavy">{t('title')}</h1><Link href={`/${lang}/notifications`} aria-label={t('notifications')} className="rounded-full bg-white p-3"><Bell/></Link></div>
 <div className="flex items-center gap-5 rounded-3xl bg-white p-6">
 <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rojRed text-3xl font-black text-white">{profile?.avatar_url&&/^https:\/\//.test(profile.avatar_url)? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer"/>:name.charAt(0).toUpperCase()||<UserRound/>}</div>
 <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="break-words text-2xl font-black">{name}</h2>{tiersEnabled&&profile&&['gold','pro'].includes(profile.account_tier)&&<span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-rojNavy">{profile.account_tier.toUpperCase()}</span>}</div>{profile&&<p className="mt-2 text-gray-600">{t(profile.account_type==='agency'?'agency':'person')}</p>}<p className="mt-1 break-all text-sm text-gray-500" dir="ltr">{auth.user.email}</p></div></div>
 {profile?.is_identity_verified&&<p className="font-bold text-blue-700">{t('verified')}</p>}
 {profile?.is_suspended&&<p role="alert" className="rounded-xl bg-red-50 p-4">{t('suspended')}</p>}
 {failed?<AccountState lang={lang} error retry={()=>setVersion(v=>v+1)}/>:tiersEnabled&&profile&&<PlanCard key={id} lang={lang} profile={profile}/>}
 <div className="space-y-3">{links.map(([key,path,Icon])=><Link key={key} href={`/${lang}/${path}`} className="flex min-h-20 items-center gap-4 rounded-3xl bg-white px-5 py-4 hover:bg-red-50"><Icon className="h-6 w-6 shrink-0 text-rojRed"/><span className="flex-1 font-bold">{t(key)}</span><ChevronRight className="h-5 w-5 shrink-0 rtl:rotate-180"/></Link>)}
 <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5"><span className="flex items-center gap-4 font-bold"><Globe className="text-rojRed"/>{t('language')}</span><LanguageSwitcher currentLocale={lang}/></div></div>
 {actionError&&<p role="alert">{t('actionError')}</p>}<button disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setActionError(false);try{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;router.replace(`/${lang}`);router.refresh();}catch{setActionError(true);}finally{setBusy(false);}}} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-200 bg-white p-4 font-bold text-rojRed disabled:opacity-50"><LogOut/>{t('logout')}</button>
 </div>;
}
