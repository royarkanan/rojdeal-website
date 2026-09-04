'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {activeAssignment} from '@/lib/staff-display';
import {accountText} from '@/lib/account-copy';
import type {Locale} from '@/lib/i18n-config';
type Named={names:Record<string,string>};
type Assignment={id:string;is_active:boolean;starts_at:string;expires_at:string|null;role:Named|null;market:Named|null;location:Named|null;category:Named|null;market_id:string|null;location_node_id:number|null;category_id:string|null};
const copy={ar:['نطاقات تعيينك','الدولة / السوق','الموقع','القسم','حتى','غير مقيّد','تعيين إداري','اسم غير متاح'],ku:['Sînorên tayînkirina te','Welat / bazar','Cih','Beş','Heta','Bê sînor','Tayînkirina rêveberî','Nav nayê dîtin'],de:['Deine Zuweisungsbereiche','Land / Markt','Standort','Kategorie','Bis','Unbeschränkt','Verwaltungszuweisung','Name nicht verfügbar'],en:['Your assignment scopes','Country / market','Location','Category','Until','Unrestricted','Staff assignment','Name unavailable']};
export function StaffScopeDetails({lang}:{lang:Locale}){
 const t=copy[lang],[rows,setRows]=useState<Assignment[]>([]),[failed,setFailed]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{let live=true;setFailed(false);void(async()=>{
  const auth=await supabase.auth.getUser();if(auth.error)throw auth.error;if(!auth.data.user)throw new Error('authentication_required');
  const result=await supabase.from('staff_assignments').select('id,is_active,starts_at,expires_at,market_id,location_node_id,category_id,role:staff_roles(names),market:markets(names),location:location_nodes(names),category:listing_categories_config(names)').eq('user_id',auth.data.user.id).eq('is_active',true);
  if(result.error)throw result.error;
  if(live)setRows((result.data as unknown as Assignment[]??[]).filter(row=>activeAssignment(row)));
 })().catch(()=>{if(live){setRows([]);setFailed(true);}});return()=>{live=false;};},[version]);
 const name=(value:Named|null)=>value?.names?.[lang]||value?.names?.en||value?.names?.ar||t[7];
 if(failed)return <p role="alert" className="rounded-xl bg-white p-3">{accountText(lang,'error')} <button className="underline" onClick={()=>setVersion(v=>v+1)}>{accountText(lang,'retry')}</button></p>;
 if(!rows.length)return null;
 return <section className="space-y-3 rounded-2xl bg-white p-5"><h2 className="font-bold">{t[0]}</h2><div className="grid gap-3 md:grid-cols-2">{rows.map(row=><article key={row.id} className="rounded-xl border p-3"><h3 className="font-bold">{row.role?name(row.role):t[6]}</h3><dl className="mt-2 text-sm">{([[1,'market'],[2,'location'],[3,'category']]as const).map(([label,key])=><div key={key} className="flex flex-wrap gap-2"><dt>{t[label]}:</dt><dd>{(key==='market'?row.market_id:key==='location'?row.location_node_id:row.category_id)?name(row[key]):t[5]}</dd></div>)}<div className="flex flex-wrap gap-2"><dt>{t[4]}:</dt><dd>{row.expires_at?new Date(row.expires_at).toLocaleString(lang==='ku'?'en':lang):t[5]}</dd></div></dl></article>)}</div></section>;
}
