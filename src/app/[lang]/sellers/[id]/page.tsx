/* eslint-disable @next/next/no-img-element */
import {notFound} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {i18n,type Locale} from '@/lib/i18n-config';
import {listingService} from '@/services';
import {getDictionary} from '@/lib/get-dictionary';
import {ListingCard} from '@/components/listings/ListingCard';
import {Pagination} from '@/components/common/Pagination';
import {pageNumber,PAGE_SIZE} from '@/lib/pagination';
export default async function SellerPage({params,searchParams}:{params:Promise<{lang:string;id:string}>;searchParams:Promise<{page?:string|string[]}>}){
 const {lang:raw,id}=await params,lang=(i18n.locales.includes(raw as Locale)?raw:i18n.defaultLocale)as Locale;
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))notFound();
 const result=await supabase.rpc('get_visible_profile',{target_user:id});if(result.error)throw new Error('Seller profile unavailable');if(!result.data||result.data.id!==id)notFound();
 const profile=result.data,page=pageNumber((await searchParams).page),dict=await getDictionary(lang),rows=await listingService.getListings({sellerId:id,page});
 const name=String(profile.account_type==='agency'?profile.business_name||profile.display_name:profile.display_name);
 const t={ar:{title:'إعلانات المعلن',empty:'لا توجد إعلانات متاحة حالياً.'},ku:{title:'Îlanên firoşkar',empty:'Niha îlan tune ne.'},de:{title:'Anzeigen des Anbieters',empty:'Aktuell keine verfügbaren Anzeigen.'},en:{title:'Seller listings',empty:'No listings currently available.'}}[lang];
 return <div className="space-y-6 pb-12"><section className="flex flex-wrap items-center gap-4 rounded-3xl bg-white p-6">{profile.avatar_url&&/^https:\/\//.test(profile.avatar_url)&&<img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover"/>}<div className="min-w-0"><h1 className="break-words text-2xl font-black">{name}</h1>{profile.account_type==='agency'&&profile.office_address&&<p className="break-words">{String(profile.office_address)}</p>}</div></section><h2 id="results" className="scroll-mt-48 text-xl font-bold">{t.title}</h2>{rows.length?<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{rows.slice(0,PAGE_SIZE).map(row=><ListingCard key={row.id} listing={row} lang={lang} dict={dict}/>)}</div>:<p>{t.empty}</p>}<Pagination lang={lang} page={page} hasNext={rows.length>PAGE_SIZE} path={`/${lang}/sellers/${id}`} params={{}}/></div>;
}
