'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Award,ChartNoAxesCombined} from 'lucide-react';
import type {Locale} from '@/lib/i18n-config';
import {accountText,type AccountLabel} from '@/lib/account-copy';
import {ownPlan,localized,tierUpgradesEnabled,type AccountProfile,type Plan,type Subscription} from '@/services/account';
import {AccountState} from './AccountState';
export function PlanCard({lang,profile,expanded=false}:{lang:Locale;profile:AccountProfile;expanded?:boolean}){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{let live=true;void tierUpgradesEnabled().then(v=>{if(live)setVisible(v);}).catch(()=>{});return()=>{live=false;};},[]);
 const t=(key:Parameters<typeof accountText>[1])=>accountText(lang,key);
 const [data,setData]=useState<{plan:Plan|null;subscription:Subscription|null}|null>(null),[failed,setFailed]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{let live=true;setData(null);setFailed(false);void ownPlan(profile).then(d=>{if(live)setData(d);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[profile,version]);
 const benefit=(value:unknown)=>{const text=localized(value,lang);return ['core_listings','favorites','chat','higher_listing_limit','unlimited_listings','basic_analytics','advanced_analytics','priority_support','account_manager','message_support','email_support'].includes(text)?t(text as AccountLabel):text;};
 const raw=data?.subscription?.tier_key===profile.account_tier?data.subscription.expires_at:null;
 const date=raw?new Date(raw):null;
 if(!visible)return <Link className="font-bold text-rojRed" href={`/${lang}/account/analytics`}>{t('analytics')}</Link>;
 return <section className={`space-y-4 rounded-3xl p-6 ${profile.account_tier==='gold'?'bg-amber-50':'bg-white'}`}>
 <div className="flex items-center gap-4"><Award className="h-10 w-10 text-amber-500"/><div><p className="text-gray-600">{t('plan')}</p><h2 className="text-3xl font-black text-rojNavy">{localized(data?.plan?.names,lang)||profile.account_tier.toUpperCase()}</h2></div></div>
 {failed?<AccountState lang={lang} error retry={()=>setVersion(v=>v+1)}/>:!data?<AccountState lang={lang} loading/>:<>{date&&Number.isFinite(date.getTime())&&<p className="font-bold">{t('expires')}: {new Intl.DateTimeFormat(lang==='ku'?'ku-Latn':lang,{dateStyle:'long'}).format(date)}</p>}{expanded&&<p>{localized(data.plan?.descriptions,lang)}</p>}<ul className="list-inside list-disc space-y-2">{(data.plan?.benefits??[]).map((b,i)=><li key={i}>{benefit(b)}</li>)}</ul></>}
 {data?.subscription?.manager_name&&<p>{t('account_manager')}: {data.subscription.manager_name}</p>}
 <div className="flex flex-wrap gap-3">{profile.account_tier!=='standard'&&<Link className="inline-flex items-center gap-2 rounded-full border border-rojRed px-5 py-3 font-bold text-rojRed" href={`/${lang}/account/analytics`}><ChartNoAxesCombined className="h-5 w-5"/>{t('analytics')}</Link>}{!expanded&&<Link href={`/${lang}/account/subscription`} className="rounded-full bg-rojRed px-5 py-3 font-bold text-white">{t('details')}</Link>}</div>
 </section>;
}
