'use client';
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { Locale } from '@/lib/i18n-config';
export function ShareListing({lang,title}:{lang:Locale;title:string}) {
 const [status,setStatus]=useState(''),[url,setUrl]=useState('');
 const t={ar:['مشاركة الإعلان','تم نسخ الرابط','انسخ الرابط التالي'],ku:['Îlanê parve bike','Girêdan hat kopîkirin','Vê girêdanê kopî bike'],de:['Anzeige teilen','Link kopiert','Diesen Link kopieren'],en:['Share listing','Link copied','Copy this link']}[lang];
 return <div className="max-w-full"><button type="button" aria-label={t[0]} className="rounded-xl border p-3" onClick={async()=>{const link=window.location.origin+window.location.pathname;try{if(navigator.share){await navigator.share({title,url:link});return;}await navigator.clipboard.writeText(link);setStatus(t[1]);}catch(error){if(error instanceof Error&&error.name==='AbortError')return;setUrl(link);setStatus(t[2]);}}}><Share2 className="h-5 w-5"/></button>{status&&<p role="status" className="text-xs">{status}</p>}{url&&<input readOnly aria-label={t[2]} value={url} onFocus={e=>e.target.select()} className="w-full rounded border p-2" dir="ltr"/>}</div>;
}
