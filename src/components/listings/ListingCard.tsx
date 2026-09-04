"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, MapPin } from "lucide-react";
import { FavoriteButton } from "./FavoriteButton";
import type { Listing } from "@/types/listing";
import type { Locale } from "@/lib/i18n-config";
import {
  formatNumericDate,
  formatPrice,
  getDisplayTitle,
  listingLocation,
} from "@/lib/utils";

const labels = {
  ar: {
    sale: "للبيع",
    rent: "للإيجار",
    wanted: "مطلوب",
    exchange: "مبادلة",
    installment: "تقسيط",
    donation: "مجاناً",
    partnership: "شراكة",
    assignment: "تنازل",
    other: "أخرى",
    reserved: "محجوز",
    sold: "مباع",
    contact: "السعر عند التواصل",
    offers: "تقديم عرض",
    free: "مجاني",
    negotiable: "قابل للتفاوض",
    budget: "الميزانية",
  },
  ku: {
    sale: "Ji bo firotinê",
    rent: "Ji bo kirê",
    wanted: "Tê xwestin",
    exchange: "Guhertin",
    installment: "Bi qist",
    donation: "Belaş",
    partnership: "Hevkarî",
    assignment: "Devjêberdan",
    other: "Din",
    reserved: "Rezervekirî",
    sold: "Firotî",
    contact: "Bi me re têkilî daynin",
    offers: "Pêşniyar bike",
    free: "Belaş",
    negotiable: "Danûstandin",
    budget: "Budce",
  },
  de: {
    sale: "Verkauf",
    rent: "Miete",
    wanted: "Gesucht",
    exchange: "Tausch",
    installment: "Ratenzahlung",
    donation: "Kostenlos",
    partnership: "Partnerschaft",
    assignment: "Übertragung",
    other: "Andere",
    reserved: "Reserviert",
    sold: "Verkauft",
    contact: "Preis auf Anfrage",
    offers: "Angebot machen",
    free: "Kostenlos",
    negotiable: "VB",
    budget: "Budget",
  },
  en: {
    sale: "For sale",
    rent: "For rent",
    wanted: "Wanted",
    exchange: "Exchange",
    installment: "Installments",
    donation: "Free",
    partnership: "Partnership",
    assignment: "Assignment",
    other: "Other",
    reserved: "Reserved",
    sold: "Sold",
    contact: "Price on request",
    offers: "Make an offer",
    free: "Free",
    negotiable: "Negotiable",
    budget: "Budget",
  },
} as const;

export function ListingCard({
  listing,
  lang,
}: {
  listing: Listing;
  dict?: unknown;
  lang: Locale;
  layout?: "horizontal" | "grid";
}) {
  const text = labels[lang];
  const transaction = String(listing.characteristics.transactionType ?? "");
  const customTransaction = String(
    listing.characteristics.customTransaction ?? "",
  ).trim();
  const transactionLabel =
    transaction === "other" && customTransaction
      ? customTransaction
      : transaction==='lease'?({ar:'ضمان / إيجار استثماري',ku:'Kirêya dirêj',de:'Pacht',en:'Lease'})[lang]:(text as Record<string, string>)[transaction];
  const status =
    listing.status === "sold"
      ? text.sold
      : listing.status === "reserved"
        ? text.reserved
        : transactionLabel
          ? `${listing.purpose === "wanted" ? `${text.wanted}: ` : ""}${transactionLabel}`
          : listing.purpose === "wanted"
            ? text.wanted
            : listing.purpose === "rent"
              ? text.rent
              : text.sale;
  const price = formatPrice(listing, {
    contact: text.contact,
    offers: text.offers,
    free: text.free,
    negotiable: text.negotiable,
    budget: text.budget,
  });
  const place = listingLocation(listing,lang);

  return (
    <article className="relative min-w-0 overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-black/[0.04] transition hover:shadow-md">
      <Link href={`/${lang}/listings/${listing.id}`} className="block">
        <div className="relative aspect-[1.18/1] w-full overflow-hidden bg-[#F1EEEA]">
          {listing.images[0] ? (
            <Image
              src={listing.images[0]}
              alt={listing.title}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <Image
              src={
                listing.purpose === "wanted"
                  ? "/images/placeholders/listing-wanted.png"
                  : "/images/placeholders/listing-offer.png"
              }
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
            />
          )}
          <span className="absolute end-2 top-2 rounded-lg bg-rojRed px-2 py-1 text-[10px] font-black text-white sm:text-xs">
            {status}
          </span>
          {listing.seller.accountBadge && (
            <span
              className={`absolute bottom-2 end-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black ${listing.seller.accountBadge === "GOLD" ? "bg-[#FFC400] text-rojNavy" : "bg-rojNavy text-white"}`}
            >
              {listing.seller.accountBadge}
              <CheckCircle2 className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-2 p-3">
          <h3 className="line-clamp-2 min-h-10 break-words text-sm font-black leading-5 text-rojNavy sm:text-base">
            {getDisplayTitle(listing, lang)}
          </h3>
          <div className="flex min-w-0 items-center gap-1 text-xs font-semibold text-gray-600">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-rojRed" />
            <span className="truncate">{place}</span>
          </div>
          <div className="min-w-0 border-t border-gray-100 pt-2">
            <div className="w-full overflow-hidden">
              <span className="block origin-start truncate text-start text-sm font-black leading-5 text-rojRed sm:text-base">
                {price}
              </span>
            </div>
            <span className="mt-1 block text-[10px] text-gray-400 sm:text-xs">
              {formatNumericDate(listing.publishedAt)}
            </span>
          </div>
        </div>
      </Link>
      <FavoriteButton listingId={listing.id} />
    </article>
  );
}
