'use client';
import {useEffect,useState} from 'react';
import {legalDocuments,acceptLegalDocument,type LegalDocument} from '@/services/legal-documents';
import {useAccount} from '@/components/account/useAccount';
import {AccountState} from '@/components/account/AccountState';
import {accountText} from '@/lib/account-copy';
import type {Locale} from '@/lib/i18n-config';
export const legalTitles={ar:'المعلومات القانونية',ku:'Agahiyên hiqûqî',de:'Rechtliche Informationen',en:'Legal information'};
export function SharedLegalDocuments({lang}:{lang:Locale}){
 const auth=useAccount(),[rows,setRows]=useState<LegalDocument[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[version,setVersion]=useState(0),[busy,setBusy]=useState(''),[accepted,setAccepted]=useState<string[]>([]),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;setLoading(true);setError(false);void legalDocuments(lang).then(r=>{if(live)setRows(r);}).catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[lang,version]);
 useEffect(()=>{setAccepted([]);},[auth.user?.id]);
 if(loading||error)return <AccountState lang={lang} loading={loading} error={error} retry={()=>setVersion(v=>v+1)}/>;
 return <section className="mx-auto max-w-3xl space-y-5 pb-12"><h1 className="text-2xl font-black">{legalTitles[lang]}</h1>{!rows.length&&<p>{accountText(lang,'empty')}</p>}{notice&&<p role="status">{notice}</p>}{rows.map(row=><article key={row.id} className="space-y-4 rounded-3xl bg-white p-6"><h2 className="break-words text-xl font-bold">{row.title}</h2><p className="text-xs text-gray-500">{row.language.toUpperCase()} · {row.version} · {new Date(row.effective_at).toLocaleDateString(lang)}</p><div className="whitespace-pre-wrap break-words leading-8">{row.content}</div>{/^https:\/\//i.test(row.public_url)&&<a href={row.public_url} target="_blank" rel="noopener noreferrer" className="block break-all text-rojRed underline">{row.public_url}</a>}{auth.user&&row.requires_acceptance&&row.id&&<button disabled={!!busy||accepted.includes(row.id)} className="rounded-xl border px-4 py-3 font-bold disabled:opacity-50" onClick={async()=>{setBusy(row.id!);setNotice('');try{await acceptLegalDocument(row.id!);setAccepted(v=>[...v,row.id!]);}catch{setNotice(accountText(lang,'actionError'));}finally{setBusy('');}}}>{accepted.includes(row.id)?({ar:'تم تسجيل الموافقة',ku:'Razîbûn hat tomarkirin',de:'Zustimmung gespeichert',en:'Acceptance recorded'})[lang]:({ar:'قرأت المستند وأوافق عليه',ku:'Min belge xwend û qebûl dikim',de:'Ich habe das Dokument gelesen und stimme zu',en:'I have read and accept this document'})[lang]}</button>}</article>)}</section>;
}
