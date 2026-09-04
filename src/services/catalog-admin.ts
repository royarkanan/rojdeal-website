import {supabase} from '@/lib/supabase';
export type CatalogKind='categories'|'purposes'|'types'|'fields'|'options';
export type CatalogRow=Record<string,any>&{id:string};
export const catalogTables={categories:'listing_categories_config',purposes:'listing_purpose_definitions',types:'listing_category_types',fields:'category_field_definitions',options:'category_field_options'}as const;
export const catalogKeys={categories:'category_key',purposes:'purpose_key',types:'type_key',fields:'field_key',options:'option_key'}as const;
const allowed:Record<CatalogKind,string[]>={categories:['names','is_active','sort_order','allowed_purpose_keys'],purposes:['names','is_active','sort_order'],types:['names','is_active','sort_order'],fields:['labels','help_text','is_active','sort_order','category_type_id','field_type','is_required','is_filterable','is_searchable'],options:['labels','is_active','sort_order']};
export async function catalogRows(kind:CatalogKind,parent?:string):Promise<CatalogRow[]>{
 if(!Object.hasOwn(catalogTables,kind))throw new Error('invalid_catalog_kind');
 let query=supabase.from(catalogTables[kind]).select('*');
 if(kind==='types'||kind==='fields'||kind==='options'){if(!parent)return [];query=query.eq(kind==='options'?'field_id':'category_id',parent);}
 const result=await query.order('sort_order').order('id');if(result.error)throw result.error;return result.data??[];
}
export async function saveCatalogRow(kind:CatalogKind,row:Partial<CatalogRow>,parent?:string){
 if(!Object.hasOwn(catalogTables,kind))throw new Error('invalid_catalog_kind');
 // Adding new top-level categories/purposes needs the consumer mappings reviewed first.
 if(!row.id&&(kind==='categories'||kind==='purposes'))throw new Error('top_level_creation_not_supported');
 const values:Record<string,unknown>=Object.fromEntries(allowed[kind].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
 if(values.sort_order!=null&&!Number.isInteger(values.sort_order))throw new Error('invalid_order');
 if(values.max_images!=null&&(!Number.isInteger(values.max_images)||Number(values.max_images)<0||Number(values.max_images)>30))throw new Error('invalid_image_limit');
 if(values.max_video_seconds!=null&&(!Number.isInteger(values.max_video_seconds)||Number(values.max_video_seconds)<1||Number(values.max_video_seconds)>1800))throw new Error('invalid_video_limit');
 const {data:auth,error:authError}=await supabase.auth.getUser();if(authError)throw authError;if(!auth.user)throw new Error('authentication_required');
 if(kind!=='options'){values.updated_by=auth.user.id;values.updated_at=new Date().toISOString();}
 let request;
 if(row.id){request=supabase.from(catalogTables[kind]).update(values).eq('id',row.id);if(row.updated_at&&kind!=='options')request=request.eq('updated_at',row.updated_at);}
 else{const key=String(row[catalogKeys[kind]]??'');if(!/^[a-z0-9_]{1,80}$/.test(key)||kind==='types'&&key.length<2||!parent)throw new Error('invalid_catalog_key');values[catalogKeys[kind]]=key;values[kind==='options'?'field_id':'category_id']=parent;if(kind!=='options')values.created_by=auth.user.id;request=supabase.from(catalogTables[kind]).insert(values);}
 const {data,error}=await request.select('id');if(error)throw error;if(data?.length!==1)throw new Error('catalog_changed_or_denied');
}
