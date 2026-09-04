import { supabase } from "@/lib/supabase";
import { expandLocations } from "@/lib/navigation";
import { activeLocations } from './locations';
import { PAGE_SIZE, pageSlice } from '@/lib/pagination';
import {locationPath} from '@/lib/location-path';
import type { IListingRepository } from "./api.interface";
import type {
  Category,
  Listing,
  ListingFilterParams,
  ListingPriceType,
  ListingStatus,
  ListingTransactionType,
} from "@/types/listing";

type JsonMap = Record<string, unknown>;
const asMap = (value: unknown): JsonMap =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonMap)
    : {};
const stringMap = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(asMap(value)).map(([key, item]) => [
      key,
      String(item ?? ""),
    ]),
  );
const numberOrNull = (value: unknown) =>
  value == null || value === "" || Number.isNaN(Number(value))
    ? null
    : Number(value);
const intValue = (value: unknown) => numberOrNull(value) ?? 0;
const normalizeSearch = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const selectColumns = `
  *,
  cities(slug, names, latitude, longitude),
  owner:profiles!listings_owner_id_fkey(account_type, display_name, business_name, avatar_url, is_identity_verified, account_tier, promotion_location_node_id, promotion_location_node_ids, last_active_at, direct_call_enabled),
  category_config:listing_categories_config!listings_category_config_id_fkey(id, category_key, names, category_field_definitions(field_key, labels, category_type_id, is_active, category_field_options(option_key,labels,is_active))),
  category_type:listing_category_types!listings_category_type_id_fkey(id, type_key, names),
  proposal:location_proposals!listings_location_proposal_id_fkey(proposed_name, kind, state),
  listing_media(*)
`;

export class SupabaseListingAdapter implements IListingRepository {
  private async mappedRows(rows:JsonMap[]):Promise<Listing[]>{
    if(!rows.length)return [];
    let showTiers=false;try{const flag=await supabase.from("platform_content").select("tier_upgrades_enabled").eq("id",true).maybeSingle();showTiers=!flag.error&&flag.data?.tier_upgrades_enabled===true;}catch{/* Fail closed for marketing only. */}
    const mapped=rows.map(row=>{const item=this.mapRow(row);return showTiers?item:{...item,seller:{...item.seller,accountBadge:null}};});
    if(!rows.some(row=>row.location_node_id))return mapped;
    // A location tree outage must not hide otherwise readable listings.
    const nodes=await activeLocations().catch(()=>[]);
    return mapped.map((item,index)=>({...item,location:{...item.location,pathNames:Object.fromEntries(['ar','ku','de','en'].map(lang=>[lang,locationPath(nodes,Number(rows[index].location_node_id),lang)]))}}));
  }
  private imageUrl(path: string) {
    if (/^https?:\/\//i.test(path)) return path;
    return supabase.storage.from("listing-images").getPublicUrl(path).data
      .publicUrl;
  }

  private mapRow(row: JsonMap): Listing {
    const media = Array.isArray(row.listing_media)
      ? [...row.listing_media].map(asMap)
      : [];
    const images = media
      .filter(
        (item) =>
          item.kind === "image" && String(item.storage_path ?? "").trim(),
      )
      .sort((a, b) => intValue(a.sort_order) - intValue(b.sort_order))
      .map((item) => this.imageUrl(String(item.storage_path).trim()));
    const city = asMap(row.cities);
    const owner = asMap(row.owner);
    const categoryConfig = asMap(row.category_config);
    const categoryType = asMap(row.category_type);
    const proposal = asMap(row.proposal);
    const attributes = stringMap(row.attributes);
    if (
      proposal.state === "pending" &&
      String(proposal.proposed_name ?? "").trim()
    ) {
      attributes.pendingLocationName = String(proposal.proposed_name).trim();
    }
    const cityNames = stringMap(city.names);
    const cityFallback = String(city.slug ?? row.area_label ?? "").trim();
    const businessName = String(owner.business_name ?? "").trim();
    const displayName = String(owner.display_name ?? "").trim();
    const sellerName =
      owner.account_type === "agency" && businessName
        ? businessName
        : displayName || String(row.seller_name ?? "").trim();
    const categoryValue = String(row.category ?? "property");
    const category: Category =
      categoryValue === "vehicle"
        ? "vehicles"
        : categoryValue === "other"
          ? "miscellaneous"
          : "real_estate";
    const direction = String(row.listing_direction ?? "offer");
    const purpose =
      direction === "wanted"
        ? "wanted"
        : row.purpose === "rent"
          ? "rent"
          : "sell";
    const state = String(row.state ?? "published");
    const status: ListingStatus =
      state === "published"
        ? "active"
        : state === "rented"
          ? "sold"
          : (([
              "draft",
              "hidden",
              "reserved",
              "sold",
              "removed",
              "rejected",
            ].includes(state)
              ? state
              : "active") as ListingStatus);
    const tier = String(owner.account_tier ?? "standard").toLowerCase();
    const accountBadge =
      tier === "gold" ? "GOLD" : tier === "pro" ? "PRO" : null;
    const priceType = (
      ["fixed", "negotiable", "contact", "offers", "free"].includes(
        String(row.price_type),
      )
        ? String(row.price_type)
        : "fixed"
    ) as ListingPriceType;

    return {
      id: String(row.id),
      publicCode: String(row.public_code ?? "") || undefined,
      characteristicLabels: Object.fromEntries((Array.isArray(categoryConfig.category_field_definitions)?categoryConfig.category_field_definitions:[]).map(asMap).filter(f=>f.is_active===true&&(!f.category_type_id||f.category_type_id===row.category_type_id)).map(f=>[String(f.field_key),stringMap(f.labels)])),
      characteristicOptions: Object.fromEntries((Array.isArray(categoryConfig.category_field_definitions)?categoryConfig.category_field_definitions:[]).map(asMap).filter(f=>f.is_active===true&&(!f.category_type_id||f.category_type_id===row.category_type_id)).map(f=>[String(f.field_key),Object.fromEntries((Array.isArray(f.category_field_options)?f.category_field_options:[]).map(asMap).filter(o=>o.is_active===true).map(o=>[String(o.option_key),stringMap(o.labels)]))])),
      title: String(row.title ?? "").trim(),
      description: String(row.description ?? ""),
      category,
      subType: String(categoryType.type_key ?? "") || undefined,
      categoryNames: stringMap(categoryConfig.names),
      categoryTypeNames: stringMap(categoryType.names),
      customSubType:
        attributes.customSubCategory ||
        attributes.customPropertyType ||
        undefined,
      purpose,
      status,
      price: numberOrNull(row.price),
      priceType,
      budgetMin: numberOrNull(row.budget_min),
      budgetMax: numberOrNull(row.budget_max),
      currency: String(row.currency ?? "USD"),
      isPriceContact: priceType === "contact",
      images,
      videos: media.filter(item=>item.kind==='video'&&item.review_status==='approved'&&item.storage_path).sort((a,b)=>intValue(a.sort_order)-intValue(b.sort_order)).map(item=>/^https?:\/\//i.test(String(item.storage_path))?String(item.storage_path):supabase.storage.from('listing-videos').getPublicUrl(String(item.storage_path)).data.publicUrl),
      location: {
        latitude:numberOrNull(row.latitude),longitude:numberOrNull(row.longitude),
        governorate: attributes.governorate || "",
        city: cityNames.ar || cityNames.en || cityFallback,
        cityNames,
        district:
          [
            attributes.district,
            attributes.village,
            attributes.pendingLocationName,
            String(row.area_label ?? ""),
          ]
            .map((part) => String(part ?? "").trim())
            .find(Boolean) || "",
      },
      publishedAt: String(row.published_at ?? row.created_at ?? ""),
      isFeatured: Boolean(row.is_featured),
      characteristics: attributes,
      viewCount: intValue(row.view_count),
      favoriteCount: intValue(row.favorite_count),
      contactPhone: String(row.contact_phone ?? ""),
      contactEmail: String(row.contact_email ?? ""),
      directCallEnabled:
        Boolean(owner.direct_call_enabled ?? true) &&
        Boolean(row.direct_call_override ?? true),
      chatEnabled: Boolean(row.chat_enabled ?? true),
      whatsappEnabled: Boolean(row.whatsapp_enabled ?? false),
      seller: {
        id: String(row.owner_id ?? ""),
        name: sellerName,
        accountBadge,
        // An agency account is self-selected; it is not proof of identity verification.
        isVerified: owner.is_identity_verified === true,
        avatarUrl: String(owner.avatar_url??"") || undefined,
        joinedDate: "",
      },
    };
  }

  async getListings(params?: ListingFilterParams): Promise<Listing[]> {
    let relevance = new Map<string, number>();
    if (params?.query?.trim()) {
      const ranked = await supabase.rpc("search_marketplace_ids", {
        search_term: params.query.trim(),
        target_market: null,
        result_limit: 500,
      });
      if (ranked.error) throw new Error('Marketplace search is unavailable. Check the search_marketplace_ids database migration.');
      if (!Array.isArray(ranked.data)) throw new Error('Invalid marketplace search response');
      if (!ranked.error && Array.isArray(ranked.data) && ranked.data.length === 0) return [];
      if (!ranked.error && Array.isArray(ranked.data))
        relevance = new Map(
          ranked.data.map((item: Record<string, unknown>) => [
            String(item.listing_id),
            Number(item.relevance ?? 0),
          ]),
        );
    }
    let query = supabase
      .from("listings")
      .select(selectColumns)
      .is('deleted_at', null)
      .in("state", ["published", "reserved"]);
    if(params?.sellerId)query=query.eq("owner_id",params.sellerId);
    if (relevance.size) query = query.in("id", Array.from(relevance.keys()));
    if (params?.category)
      query = query.eq(
        "category",
        params.category === "real_estate"
          ? "property"
          : params.category === "vehicles"
            ? "vehicle"
            : "other",
      );
    if (params?.purpose) {
      if (params.purpose === "wanted")
        query = query.eq("listing_direction", "wanted");
      else
        query = query
          .eq("purpose", params.purpose === "sell" ? "sale" : "rent")
          .eq("listing_direction", "offer");
    }
    if (params?.transactionType)
      query = query.contains("attributes", {
        transactionType: params.transactionType,
      });
    const priceBounds=[['gte','budget_max',params?.minPrice],['lte','budget_min',params?.maxPrice]] as const;
    for(const [operator,budget,bound] of priceBounds){if(bound==null)continue;if(!Number.isFinite(bound)||bound<0)throw new Error('invalid_price');
      if(params?.purpose&&params.purpose!=='wanted')query=operator==='gte'?query.gte('price',bound):query.lte('price',bound);
      else if(params?.purpose==='wanted')query=query.or(`${budget}.is.null,${budget}.${operator}.${bound}`);
      else query=query.or(`and(listing_direction.eq.offer,price.${operator}.${bound}),and(listing_direction.eq.wanted,or(${budget}.is.null,${budget}.${operator}.${bound}))`);
    }
    if (params?.locationNodeIds?.length || params?.city || params?.governorate) {
      const locations = await activeLocations();
      if (params.locationNodeIds?.length) query = query.in("location_node_id", expandLocations(locations, params.locationNodeIds));
      for (const term of [params.city, params.governorate].filter(Boolean)) {
        const matches=locations.filter(n=>Object.values(n.names).some(name=>normalizeSearch(name).includes(normalizeSearch(term)))).map(n=>n.id);
        if(!matches.length)return [];
        query=query.in('location_node_id',expandLocations(locations,matches));
      }
    }
    query =
      params?.sortBy === "price_asc"
        ? query.order("price", { ascending: true, nullsFirst: false })
        : params?.sortBy === "price_desc"
          ? query.order("price", { ascending: false, nullsFirst: false })
          : query.order("published_at", { ascending: false });
    query=query.order('id',{ascending:true});
    // Ranked search is capped by the existing database RPC. Fetch the full ranked
    // candidate set before slicing, otherwise relevance would change per page.
    const offset=((params?.page ?? 1)-1)*PAGE_SIZE;
    const { data, error } = await (relevance.size ? query.limit(500) : params?.page ? query.range(offset,offset+PAGE_SIZE) : query.limit(200));
    if (error) throw new Error(`Supabase listings: ${error.message}`);
    const results = await this.mappedRows((data??[]).map(asMap));
    if (
      relevance.size &&
      !params?.sortBy
    )
      results.sort(
        (a, b) => (relevance.get(b.id) ?? 0) - (relevance.get(a.id) ?? 0),
      );
    return relevance.size && params?.page ? pageSlice(results,params.page) : results;
  }

  async getFeaturedListings(): Promise<Listing[]> {
    const { data, error } = await supabase
      .from("listings")
      .select(selectColumns)
      .is('deleted_at',null)
      .in("state", ["published", "reserved"])
      .eq("is_featured", true)
      .order("published_at", { ascending: false })
      .limit(6);
    if (error) throw new Error(`Supabase featured listings: ${error.message}`);
    return this.mappedRows((data??[]).map(asMap));
  }

  async getListingById(id: string): Promise<Listing | null> {
    const { data, error } = await supabase
      .from("listings")
      .select(selectColumns)
      .eq("id", id)
      .is('deleted_at',null)
      .in("state", ["published", "reserved"])
      .maybeSingle();
    if (error) throw new Error(`Supabase listing: ${error.message}`);
    return data ? (await this.mappedRows([asMap(data)]))[0] : null;
  }

  async getOwnListings(): Promise<Listing[]> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("authentication_required");
    const { data, error } = await supabase
      .from("listings")
      .select(selectColumns)
      .eq("owner_id", authData.user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase own listings: ${error.message}`);
    return this.mappedRows((data??[]).map(asMap));
  }

  async setOwnListingStatus(id: string, status: ListingStatus): Promise<void> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("authentication_required");
    const state = status === "active" ? "published" : status;
    if (!["published", "hidden", "reserved", "sold"].includes(state))
      throw new Error("invalid_listing_status");
    const { error } = await supabase
      .from("listings")
      .update({ state, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", authData.user.id);
    if (error) throw new Error(`Supabase listing status: ${error.message}`);
  }

  async requestOwnListingDeletion(id: string): Promise<void> {
    const { error } = await supabase.rpc("request_listing_deletion", {
      target_listing: id,
      deletion_note: "deleted_by_listing_owner",
    });
    if (error) throw new Error(`Supabase listing deletion: ${error.message}`);
  }
}
