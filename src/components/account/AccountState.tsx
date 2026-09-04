import Link from 'next/link';
import {Loader2} from 'lucide-react';
import type {Locale} from '@/lib/i18n-config';
import {accountText} from '@/lib/account-copy';
export function AccountState({lang,loading,error,retry}:{lang:Locale;loading?:boolean;error?:boolean;retry?:()=>void}){
 const t=(key:Parameters<typeof accountText>[1])=>accountText(lang,key);
 return <div className="rounded-3xl bg-white p-8 text-center" role="status">{loading?<Loader2 aria-label={t('title')} className="mx-auto animate-spin text-rojRed"/>:error?<><p>{t('error')}</p><button className="mt-4 rounded-xl bg-rojRed px-5 py-3 font-bold text-white" onClick={retry}>{t('retry')}</button></>:<><p>{t('required')}</p><Link href={`/${lang}/auth`} className="mt-4 inline-block rounded-xl bg-rojRed px-5 py-3 font-bold text-white">{t('login')}</Link></>}</div>;
}
