'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { Locale } from '@/lib/i18n-config';
export function ListingMedia({images,videos=[],title,lang,purpose='offer'}:{images:string[];videos?:string[];title:string;lang:Locale;purpose?:string}) {
 const [index,setIndex]=useState(0);
 const media=[...images.map(url=>({url,video:false})),...videos.map(url=>({url,video:true}))];
 const selected=media[index]??media[0];
 const labels={ar:['السابق','التالي','لا توجد وسائط'],ku:['Berê','Piştî','Medya tune ye'],de:['Zurück','Weiter','Keine Medien'],en:['Previous','Next','No media']}[lang];
 return <section className="space-y-2" aria-label={title}>
   <div className="relative aspect-video overflow-hidden rounded-roj bg-gray-100">
     {!selected?<Image src={purpose==='wanted'?'/images/placeholders/listing-wanted.png':'/images/placeholders/listing-offer.png'} alt={labels[2]} fill priority sizes="(max-width: 768px) 100vw, 66vw" className="object-cover"/>:selected.video?<video key={selected.url} src={selected.url} controls playsInline preload="metadata" className="h-full w-full object-contain"/>:<Image unoptimized src={selected.url} alt={title} fill priority sizes="(max-width: 768px) 100vw, 66vw" className="object-contain"/>}
   </div>
   {media.length>1 && <nav className="flex items-center justify-center gap-4"><button type="button" className="min-h-11 rounded-xl border px-4" onClick={()=>setIndex(i=>(i-1+media.length)%media.length)}>{labels[0]}</button><span aria-live="polite">{index+1} / {media.length}</span><button type="button" className="min-h-11 rounded-xl border px-4" onClick={()=>setIndex(i=>(i+1)%media.length)}>{labels[1]}</button></nav>}
 </section>;
}
