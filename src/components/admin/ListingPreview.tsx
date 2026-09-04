"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { Locale } from '@/lib/i18n-config';
import { adminText, displayDate } from '@/lib/admin-display';

// Uses the logged-in client and the existing RLS; hidden ads are never made public.
export function ListingPreview({ id, lang, close }: { id: string; lang: Locale; close: () => void }) {
  const [row,setRow]=useState<Record<string, any> | null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true; void supabase.from('listings').select('*,listing_media(*)').eq('id',id).maybeSingle().then(({data,error})=>{if(active){if(error || !data)setError(adminText('failed',lang));else setRow(data);}});return()=>{active=false;};},[id,lang]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[close]);
  return <div role="dialog" aria-modal="true" aria-label={adminText('openListing',lang)} className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-3" onClick={close}>
    <section className="mx-auto my-6 max-w-3xl space-y-4 rounded-2xl bg-white p-5" onClick={e=>e.stopPropagation()}>
      <button autoFocus onClick={close} className="rounded-xl border px-4 py-2" aria-label="Close">×</button>
      {error ? <p role="alert">{error}</p> : !row ? <p>…</p> : <>
        <h2 className="text-xl font-black">{row.title}</h2>
        <p dir="ltr" className="break-all text-xs">{row.public_code || row.id}</p>
        <p>{adminText(String(row.state),lang)} · {adminText(String(row.category),lang)} · {displayDate(row.created_at)}</p>
        <p className="whitespace-pre-wrap">{row.description}</p>
        <div className="grid gap-3 sm:grid-cols-2">{(row.listing_media ?? []).map((media: Record<string,any>)=>{
          const path=String(media.storage_path ?? '');
          const url=/^https:\/\//.test(path)?path:supabase.storage.from(media.kind==='video'?'listing-videos':'listing-images').getPublicUrl(path).data.publicUrl;
          return media.kind==='video'?<video key={media.id} src={url} controls preload="metadata" className="w-full rounded-xl"/>:<Image unoptimized width={800} height={600} key={media.id} src={url} alt={String(row.title)} className="h-auto w-full rounded-xl object-contain"/>;
        })}</div>
        <dl className="space-y-2">{Object.entries(row.attributes ?? {}).map(([key,value])=><div key={key}><dt className="font-bold">{key}</dt><dd>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl>
      </>}
    </section>
  </div>;
}
