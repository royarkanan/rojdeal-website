import { cleanSearchParams } from './search-params';
const toWeb: Record<string,string> = {property:'real_estate',vehicle:'vehicles',other:'miscellaneous',real_estate:'real_estate',vehicles:'vehicles',miscellaneous:'miscellaneous'};
const toApp: Record<string,string> = {real_estate:'property',vehicles:'vehicle',miscellaneous:'other'};
export function sharedSearchFilters(raw: Record<string,string>): Record<string,unknown> | null {
 const p=cleanSearchParams(raw);
 if(p.locationIds || p.governorate || p.transactionType || p.purpose==='wanted' || p.sortBy && p.sortBy!=='newest')return null;
 return {query:p.q||'',...(p.city?{city_slug:p.city}:{}),...(p.category?{category:toApp[p.category],category_key:toApp[p.category]}:{}),...(p.purpose?{purpose:p.purpose==='sell'?'sale':p.purpose}:{}),...(p.minPrice?{min_price:Number(p.minPrice)}:{}),...(p.maxPrice?{max_price:Number(p.maxPrice)}:{})};
}
export function savedSearchParams(raw: unknown): Record<string,string> | null {
 if(!raw || typeof raw!=='object' || Array.isArray(raw))return null;
 const f=raw as Record<string,unknown>, category=String(f.category_key || f.category || '');
 if(category && !Object.prototype.hasOwnProperty.call(toWeb,category)) return null;
 for(const key of ['min_price','max_price'])if(f[key]!=null&&(String(f[key]).trim()===''||!Number.isFinite(Number(f[key]))||Number(f[key])<0))return null;
 if(f.purpose && !['sale','rent'].includes(String(f.purpose)))return null;
 // Do not silently drop unknown active filters and broaden a saved search.
 const known=new Set(['query','city_slug','category','category_key','category_names','purpose','min_price','max_price']);
 if(Object.entries(f).some(([key,value])=>!known.has(key)&&value!=null&&value!==''))return null;
 const p:Record<string,string>={};
 for(const [from,to] of [['query','q'],['city_slug','city'],['min_price','minPrice'],['max_price','maxPrice']])if(f[from]!=null)p[to]=String(f[from]);
 if(category)p.category=toWeb[category];
 if(f.purpose)p.purpose=f.purpose==='sale'?'sell':'rent';
 return cleanSearchParams(p);
}
