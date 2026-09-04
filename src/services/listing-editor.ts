import { supabase } from "@/lib/supabase";
import {activeLocations} from './locations';

export type TransactionType =
  | "sale"
  | "rent"
  | "lease"
  | "exchange"
  | "installment"
  | "donation"
  | "partnership"
  | "assignment"
  | "other";
export type ListingDraft = {
  title: string;
  description: string;
  category: "property" | "vehicle" | "other";
  categoryTypeId: string | null;
  direction: "offer" | "wanted";
  transactionType: TransactionType;
  customTransaction: string;
  price: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  priceType: "fixed" | "negotiable" | "contact" | "offers" | "free";
  currency: string;
  locationNodeId: number;
  latitude?:number|null;
  longitude?:number|null;
  phone: string;
  email?: string;
  directCall: boolean;
  whatsapp: boolean;
  chat: boolean;
  attributes: Record<string, string | number | boolean>;
};
export type LocationChoice = { id: number; name: string };
export function draftCoordinates(draft:Pick<ListingDraft,'latitude'|'longitude'>){
 const latitude=draft.latitude??null,longitude=draft.longitude??null;
 if(latitude===null&&longitude===null)return {latitude:null,longitude:null};
 if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('invalid_coordinates');
 return {latitude,longitude};
}
export type CatalogOption = {
  key: string;
  labels: Record<string, string>;
};
export type CatalogField = {
  id: string;
  categoryTypeId: string | null;
  key: string;
  labels: Record<string, string>;
  helpText: Record<string, string>;
  type: "short_text" | "long_text" | "number" | "select" | "boolean" | "date" | "year";
  required: boolean;
  options: CatalogOption[];
};
export type CatalogType = {
  id: string;
  key: string;
  names: Record<string, string>;
  videoPolicy?: string;
};
export type CatalogCategory = {
  id: string;
  key: ListingDraft["category"];
  names: Record<string, string>;
  types: CatalogType[];
  fields: CatalogField[];
  maxImages:number;
  maxVideoSeconds:number;
  maxVideoBytes:number;
  videoPolicy:string;
  platformVideoPolicy:string;
};
export function catalogMediaLimits(raw:Record<string,any>){
  const clamp=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,Math.floor(value))):fallback;
  return {maxImages:clamp(raw.max_images,12,0,30),maxVideoSeconds:clamp(raw.max_video_seconds,300,1,1800),maxVideoBytes:clamp(raw.settings?.video_compression?.max_upload_bytes,48*1024*1024,8*1024*1024,1024*1024*1024)};
}
export function listingVideoPolicy(category:Pick<CatalogCategory,'videoPolicy'|'platformVideoPolicy'|'types'>,typeId:string|null){
  if(category.platformVideoPolicy==='hidden')return 'hidden';
  const type=category.types.find(t=>t.id===typeId)?.videoPolicy;
  const policy=type&&type!=='inherit'?type:category.videoPolicy;
  return policy&&policy!=='inherit'?policy:category.platformVideoPolicy;
}

async function user() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("authentication_required");
  return data.user;
}
const names = (value: unknown, lang: string) => {
  const map =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return String(map[lang] || map.ar || map.en || "");
};

export async function locationChoices(lang: string): Promise<LocationChoice[]> {
  const data=await activeLocations(),byId=new Map(data.map(row=>[row.id,row]));
  return data.filter(row=>row.city_id!=null)
    .map((row) => {
      const path:string[]=[],seen=new Set<number>();let node:typeof row|undefined=row;
      while(node&&!seen.has(node.id)){seen.add(node.id);path.unshift(names(node.names,lang));node=node.parent_id==null?undefined:byId.get(node.parent_id);}
      return {id:row.id,name:path.filter(Boolean).join(' — ')};
    })
    .filter((item) => item.name);
}

export async function listingCatalog(): Promise<CatalogCategory[]> {
  const platform=await supabase.from('platform_content').select('listing_video_policy').eq('id',true).maybeSingle();
  if(platform.error)throw platform.error;
  const { data, error } = await supabase
    .from("listing_categories_config")
    .select(
      "id,category_key,names,sort_order,video_policy,max_images,max_video_seconds,settings,listing_category_types(id,type_key,names,video_policy,is_active,sort_order),category_field_definitions(id,category_type_id,field_key,labels,help_text,field_type,is_required,is_active,sort_order,category_field_options(option_key,labels,is_active,sort_order))",
    )
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((raw) => {
    const row = raw as Record<string, any>;
    const types = (Array.isArray(row.listing_category_types)
      ? row.listing_category_types
      : []
    )
      .filter((item: any) => item.is_active === true)
      .sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order))
      .map((item: any) => ({
        id: String(item.id),
        key: String(item.type_key),
        names: (item.names ?? {}) as Record<string, string>,
        videoPolicy: String(item.video_policy??'inherit'),
      }));
    const fields = (Array.isArray(row.category_field_definitions)
      ? row.category_field_definitions
      : []
    )
      .filter((item: any) => item.is_active === true)
      .sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order))
      .map((item: any) => ({
        id: String(item.id),
        categoryTypeId: item.category_type_id
          ? String(item.category_type_id)
          : null,
        key: String(item.field_key),
        labels: (item.labels ?? {}) as Record<string, string>,
        helpText: (item.help_text ?? {}) as Record<string, string>,
        type: String(item.field_type) as CatalogField["type"],
        required: item.is_required === true,
        options: (Array.isArray(item.category_field_options)
          ? item.category_field_options
          : []
        )
          .filter((option: any) => option.is_active === true)
          .sort(
            (a: any, b: any) => Number(a.sort_order) - Number(b.sort_order),
          )
          .map((option: any) => ({
            key: String(option.option_key),
            labels: (option.labels ?? {}) as Record<string, string>,
          })),
      }));
    return {
      id: String(row.id),
      key: String(row.category_key) as ListingDraft["category"],
      names: (row.names ?? {}) as Record<string, string>,
      types,
      fields,
      ...catalogMediaLimits(row),videoPolicy:String(row.video_policy??'inherit'),platformVideoPolicy:String(platform.data?.listing_video_policy??'review'),
    };
  });
}

async function categoryConfig(category: ListingDraft["category"]) {
  const key =
    category === "property"
      ? "property"
      : category === "vehicle"
        ? "vehicle"
        : "other";
  const { data,error } = await supabase
    .from("listing_categories_config")
    .select("id,category_key,video_policy,max_images,max_video_seconds,settings,listing_category_types(id,video_policy,is_active)")
    .eq("is_active", true)
    .eq("category_key", key)
    .limit(1)
    .maybeSingle();
  if(error)throw error;if(!data)throw new Error('category_unavailable');
  return data;
}
async function validateVideoPolicy(config:Awaited<ReturnType<typeof categoryConfig>>,typeId:string|null){
  const platform=await supabase.from('platform_content').select('listing_video_policy').eq('id',true).maybeSingle();
  if(platform.error)throw platform.error;
  const policy=listingVideoPolicy({videoPolicy:config.video_policy??'inherit',platformVideoPolicy:platform.data?.listing_video_policy??'review',types:(config.listing_category_types??[]).filter(t=>t.is_active).map(t=>({id:t.id,key:'',names:{},videoPolicy:t.video_policy}))},typeId);
  if(policy==='hidden')throw new Error('video_disabled');
}

type MediaCheckpoint = { id: string; path: string; attempted: boolean; uploaded: boolean; recorded: boolean; previousPaths?:string[] };
export type ListingSaveProgress = {
  ownerId?: string;
  listingId?: string;
  created?: boolean;
  media: Map<File, MediaCheckpoint>;
};
export function listingSaveProgress(): ListingSaveProgress { return { media: new Map() }; }
function bindProgress(progress: ListingSaveProgress, ownerId: string, listingId?: string) {
  if (progress.ownerId && progress.ownerId !== ownerId) throw new Error('draft_owner_changed');
  if (listingId && progress.listingId && progress.listingId !== listingId) throw new Error('draft_owner_changed');
  progress.ownerId = ownerId;
  if (listingId) progress.listingId = listingId;
}

async function uploadMedia(ownerId: string, listingId: string, file: File,
  kind: 'image' | 'video', progress: ListingSaveProgress, extra: Record<string, number>) {
  let checkpoint = progress.media.get(file);
  if (!checkpoint) {
    const id = crypto.randomUUID();
    const extension = kind === 'video' ? (file.name.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4') :
      (file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg');
    checkpoint = { id, path: `${ownerId}/${listingId}/web-${id}.${extension}`, attempted: false, uploaded: false, recorded: false };
    progress.media.set(file, checkpoint);
  }
  if (checkpoint.recorded) return checkpoint.id;
  // A lost response may have followed a successful insert. Check its stable ID before retrying.
  if (checkpoint.attempted) {
    const found = await supabase.from('listing_media').select('id').eq('id', checkpoint.id)
      .eq('listing_id', listingId).eq('owner_id', ownerId).maybeSingle();
    if (found.error) throw found.error;
    if (found.data) { checkpoint.recorded = true; return checkpoint.id; }
  }
  const bucket = kind === 'image' ? 'listing-images' : 'listing-videos';
  const mimeType = kind === 'image' ? file.type : (checkpoint.path.endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
  if (!checkpoint.uploaded) {
    const retry = checkpoint.attempted;
    checkpoint.attempted = true;
    const uploaded = await supabase.storage.from(bucket).upload(checkpoint.path, file, { contentType: mimeType, upsert: false });
    // Only a retry of this exact, randomly generated path can reuse an existing object.
    if (uploaded.error && !(retry && String(uploaded.error.statusCode) === '409')) throw uploaded.error;
    checkpoint.uploaded = true;
  }
  const recorded = await supabase.from('listing_media').insert({
    id: checkpoint.id, listing_id: listingId, owner_id: ownerId, kind,
    storage_path: checkpoint.path, mime_type: mimeType, size_bytes: file.size, ...extra,
  });
  if (recorded.error) throw recorded.error;
  checkpoint.recorded = true;
  return checkpoint.id;
}

async function uploadImages(ownerId: string, listingId: string, files: File[], progress: ListingSaveProgress,maxImages=12) {
  const existing = await supabase.from('listing_media').select('id,sort_order').eq('listing_id',listingId).eq('owner_id',ownerId).eq('kind','image');
  if (existing.error) throw existing.error;
  const ids = new Set((existing.data ?? []).map(row => row.id));
  const pending = files.filter(file => {
    const checkpoint = progress.media.get(file);
    if (checkpoint && ids.has(checkpoint.id)) checkpoint.recorded = true;
    return !checkpoint?.recorded;
  });
  if ((existing.data?.length ?? 0) + pending.length > maxImages) throw new Error('image_limit');
  const start = (existing.data ?? []).reduce((max,row) => Math.max(max,Number(row.sort_order)||0),-1)+1;
  for (let index = 0; index < pending.length; index++) {
    const file = pending[index];
    if (!file.type.startsWith('image/')) throw new Error('invalid_image');
    await uploadMedia(ownerId, listingId, file, 'image', progress, { sort_order: start + index });
  }
}

async function uploadVideo(
  ownerId: string,
  listingId: string,
  file: File,
  durationSeconds: number,
  progress: ListingSaveProgress = listingSaveProgress(),
  limits={maxVideoBytes:48*1024*1024,maxVideoSeconds:300},
) {
  if (
    !file.type.startsWith("video/") ||
    file.size > limits.maxVideoBytes ||
    !Number.isFinite(durationSeconds) || durationSeconds<=0 || durationSeconds > limits.maxVideoSeconds
  )
    throw new Error("invalid_video");
  let checkpoint=progress.media.get(file);
  if(!checkpoint){const id=crypto.randomUUID();checkpoint={id,path:`${ownerId}/${listingId}/web-${id}.${file.type==='video/quicktime'?'mov':'mp4'}`,attempted:false,uploaded:false,recorded:false,previousPaths:[]};progress.media.set(file,checkpoint);}
  const current=await supabase.from('listing_media').select('id,storage_path').eq('listing_id',listingId).eq('owner_id',ownerId).eq('kind','video');
  if(current.error)throw current.error;
  const committed=(current.data??[]).find(row=>row.storage_path===checkpoint.path);
  if(committed){checkpoint.id=committed.id;checkpoint.recorded=true;}
  else {
    checkpoint.previousPaths=[...new Set([...(checkpoint.previousPaths??[]),...(current.data??[]).map(row=>row.storage_path)])];
    if(!checkpoint.uploaded){
      const retry=checkpoint.attempted;checkpoint.attempted=true;
      const upload=await supabase.storage.from('listing-videos').upload(checkpoint.path,file,{contentType:file.type,upsert:false});
      if(upload.error&&!(retry&&String(upload.error.statusCode)==='409'))throw upload.error;
      checkpoint.uploaded=true;
    }
    // The app's RPC replaces the row atomically. Inserting a second video first
    // would fail the shared only_one_listing_video_allowed trigger.
    const saved=await supabase.rpc('replace_own_listing_video',{target_listing:listingId,new_storage_path:checkpoint.path,new_mime_type:file.type,new_size_bytes:file.size,new_duration_seconds:Math.round(durationSeconds)});
    if(saved.error)throw saved.error;
    checkpoint.recorded=true;
  }
  const paths=(checkpoint.previousPaths??[]).filter(path=>path!==checkpoint.path&&path.startsWith(`${ownerId}/${listingId}/`));
  for(const [previousFile,previous] of progress.media)if(paths.includes(previous.path))progress.media.delete(previousFile);
  if(paths.length){try{await supabase.storage.from('listing-videos').remove(paths);}catch{/* Replacement is committed; orphan cleanup must not turn it into a failed send. */}}
}

export class SavedDraftError extends Error {
  constructor(public listingId: string, public problem?: unknown) { super('draft_saved_upload_or_publish_failed'); }
}

export async function createListing(
  draft: ListingDraft,
  files: File[],
  video?: { file: File; duration: number } | null,
  progress: ListingSaveProgress = listingSaveProgress(),
) {
  const owner = await user();
  bindProgress(progress, owner.id);
  const coordinates=draftCoordinates(draft);
  const resolvedCity = await supabase.rpc("resolve_listing_city", {
    selected_location_node: draft.locationNodeId,
    selected_latitude: coordinates.latitude,
    selected_longitude: coordinates.longitude,
  });
  if (resolvedCity.error || resolvedCity.data == null)
    throw resolvedCity.error ?? new Error("location_required");
  const config = await categoryConfig(draft.category),configId=config.id,limits=catalogMediaLimits(config);
  if(video)await validateVideoPolicy(config,draft.categoryTypeId);
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,business_name,account_type")
    .eq("id", owner.id)
    .single();
  const sellerName = String(
    profile?.account_type === "agency"
      ? profile?.business_name
      : profile?.display_name || owner.email?.split("@")[0] || "RojDeal",
  );
  const values = {
      owner_id: owner.id,
      city_id: resolvedCity.data,
      location_node_id: draft.locationNodeId,
      ...coordinates,
      category: draft.category,
      category_config_id: configId,
      category_type_id: draft.categoryTypeId,
      category_key: draft.category,
      purpose: ['rent','lease'].includes(draft.transactionType) ? "rent" : "sale",
      listing_direction: draft.direction,
      state: "draft",
      title: draft.title.trim(),
      description: draft.description.trim(),
      seller_name: sellerName,
      price:
        draft.priceType === "contact" ||
        draft.priceType === "free" ||
        draft.transactionType === "donation"
          ? null
          : draft.price,
      price_type:
        draft.transactionType === "donation" ? "free" : draft.priceType,
      budget_min: draft.direction==='wanted' ? draft.budgetMin??null : null,
      budget_max: draft.direction==='wanted' ? draft.budgetMax??null : null,
      currency: draft.currency,
      contact_phone: (draft.directCall||draft.whatsapp)&&draft.phone.trim()?draft.phone.trim():null,
      contact_email: draft.email?.trim().toLowerCase()||null,
      direct_call_override: draft.directCall && Boolean(draft.phone.trim()),
      chat_enabled: draft.chat,
      whatsapp_enabled: draft.whatsapp && Boolean(draft.phone.trim()),
      attributes: {
        ...draft.attributes,
        transactionType: draft.transactionType,
        customTransaction:
          draft.transactionType === "other"
            ? draft.customTransaction.trim()
            : null,
      },
    };
  const retry = Boolean(progress.listingId);
  progress.listingId ??= crypto.randomUUID();
  const id = progress.listingId;
  if (retry) {
    const existing = await supabase.from('listings').select('id,state').eq('id', id).eq('owner_id', owner.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (progress.created && !existing.data) throw new Error('draft_unavailable');
    if (existing.data && !['draft','published'].includes(existing.data.state)) throw new Error('draft_unavailable');
    progress.created = Boolean(existing.data);
    // Publishing may have succeeded even if its response was lost.
    if (existing.data?.state === 'published') values.state = 'published';
  }
  if (progress.created) {
    const updated = await supabase.from('listings').update(values).eq('id', id).eq('owner_id', owner.id).eq('state',values.state).select('id').single();
    if (updated.error) throw new SavedDraftError(id, updated.error);
  } else {
    const inserted = await supabase.from('listings').insert({ ...values, id }).select('id').single();
    if (inserted.error) throw inserted.error;
    progress.created = true;
  }
  try {
  await uploadImages(owner.id, id, files, progress,limits.maxImages);
  if (video)
    await uploadVideo(owner.id, id, video.file, video.duration, progress,limits);
  if(values.state === "draft") {
  const { error: publishError } = await supabase
    .from("listings")
    .update({
      state: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", owner.id).eq("state", "draft").select('id').single();
  if (publishError) throw publishError;
  }
  return id;
  } catch (problem) {
    // Preserve the existing draft rather than creating duplicates on retry.
    throw new SavedDraftError(id, problem);
  }
}

export async function rawOwnListing(id: string) {
  const owner = await user();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id,title,description,category,category_type_id,purpose,listing_direction,price,price_type,budget_min,budget_max,currency,location_node_id,latitude,longitude,contact_phone,contact_email,direct_call_override,whatsapp_enabled,chat_enabled,attributes",
    )
    .eq("id", id)
    .eq("owner_id", owner.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateListing(
  id: string,
  draft: ListingDraft,
  files: File[],
  video?: { file: File; duration: number } | null,
  progress: ListingSaveProgress = listingSaveProgress(),
) {
  const owner = await user();
  bindProgress(progress, owner.id, id);
  const coordinates=draftCoordinates(draft);
  const resolved=await supabase.rpc('resolve_listing_city',{selected_location_node:draft.locationNodeId,selected_latitude:coordinates.latitude,selected_longitude:coordinates.longitude});
  if(resolved.error||resolved.data==null)throw resolved.error??new Error('location_required');
  const config=await categoryConfig(draft.category),configId=config.id,limits=catalogMediaLimits(config);
  if(video)await validateVideoPolicy(config,draft.categoryTypeId);
  const { error } = await supabase
    .from("listings")
    .update({
      category:draft.category,category_key:draft.category,category_config_id:configId,listing_direction:draft.direction,
      ...coordinates,
      purpose:["rent","lease"].includes(draft.transactionType)?"rent":"sale",city_id:resolved.data,location_node_id:draft.locationNodeId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      price:
        draft.priceType === "contact" ||
        draft.priceType === "free" ||
        draft.transactionType === "donation"
          ? null
          : draft.price,
      price_type:
        draft.transactionType === "donation" ? "free" : draft.priceType,
      budget_min: draft.direction==='wanted' ? draft.budgetMin??null : null,
      budget_max: draft.direction==='wanted' ? draft.budgetMax??null : null,
      currency: draft.currency,
      contact_phone: (draft.directCall||draft.whatsapp)&&draft.phone.trim()?draft.phone.trim():null,
      contact_email: draft.email?.trim().toLowerCase()||null,
      direct_call_override: draft.directCall && Boolean(draft.phone.trim()),
      chat_enabled: draft.chat,
      whatsapp_enabled: draft.whatsapp && Boolean(draft.phone.trim()),
      attributes: {
        ...draft.attributes,
        transactionType: draft.transactionType,
        customTransaction:
          draft.transactionType === "other"
            ? draft.customTransaction.trim()
            : null,
      },
      category_type_id: draft.categoryTypeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", owner.id).select('id').single();
  if (error) throw error;
  if (files.length) await uploadImages(owner.id, id, files, progress,limits.maxImages);
  if (video) await uploadVideo(owner.id, id, video.file, video.duration, progress,limits);
}
