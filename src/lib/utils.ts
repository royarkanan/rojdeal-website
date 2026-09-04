import type { Listing, ListingPriceType } from "@/types/listing";

export function formatNumericDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

const currencySymbol: Record<string, string> = { USD: "$", EUR: "€", SYP: "ل.س" };

export function formatPrice(
  listing: Pick<Listing, "price" | "currency" | "priceType" | "budgetMin" | "budgetMax" | "purpose">,
  labels: { contact: string; offers: string; free: string; negotiable: string; budget: string },
) {
  if (listing.purpose === "wanted" && (listing.budgetMin != null || listing.budgetMax != null)) {
    const range = [listing.budgetMin, listing.budgetMax]
      .filter((value): value is number => value != null)
      .map((value) => value.toLocaleString("en-US"))
      .join(" – ");
    return `${labels.budget}: ${range} ${currencySymbol[listing.currency] ?? listing.currency}`;
  }
  const special: Partial<Record<ListingPriceType, string>> = {
    contact: labels.contact,
    offers: labels.offers,
    free: labels.free,
  };
  if (listing.priceType && special[listing.priceType]) return special[listing.priceType]!;
  if (listing.price == null) return labels.contact;
  const base = `${listing.price.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currencySymbol[listing.currency] ?? listing.currency}`;
  return listing.priceType === "negotiable" ? `${base} · ${labels.negotiable}` : base;
}

export function localizedName(names: Record<string, string> | undefined, lang: string, fallback = "") {
  return names?.[lang]?.trim() || names?.en?.trim() || names?.ar?.trim() || fallback;
}

export function listingLocation(listing:Listing,lang:string){
  return listing.location.pathNames?.[lang] || [...new Set([listing.location.governorate,localizedName(listing.location.cityNames,lang,listing.location.city),listing.location.district].filter(Boolean))].join(' — ');
}

export function getDisplayTitle(listing: Listing, lang: string) {
  const attributes = listing.characteristics;
  const subCategory = String(attributes.subCategory ?? "").trim();
  const custom = String(attributes.customSubCategory ?? attributes.customPropertyType ?? "").trim();
  const isOther = ["other", "otherProperty", "otherVehicle"].includes(subCategory);
  const type = isOther ? custom : localizedName(listing.categoryTypeNames, lang, listing.subType ?? "");
  return type && !listing.title.includes(type) ? `${type} – ${listing.title}` : listing.title;
}
