import { supabase } from '@/lib/supabase';
export type ActiveLocation = { id:number; parent_id:number|null; names:Record<string,string>; sort_order:number; city_id:number|null };
export async function activeLocations(): Promise<ActiveLocation[]> {
  const rows: ActiveLocation[]=[];
  const size=500;
  for(let offset=0;;offset+=size){
    const {data,error}=await supabase.from('location_nodes').select('id,parent_id,names,sort_order,city_id').eq('is_active',true).order('id').range(offset,offset+size-1);
    if(error)throw error;
    rows.push(...(data ?? []) as ActiveLocation[]);
    if(!data || data.length<size)break;
  }
  return rows.sort((a,b)=>a.sort_order-b.sort_order || a.id-b.id);
}
