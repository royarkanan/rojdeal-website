/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import {SafetyActions} from "@/components/listings/SafetyActions";
import { ListingMedia } from '@/components/listings/ListingMedia';
import { ShareListing } from '@/components/listings/ShareListing';
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/get-dictionary";
import { Locale, i18n } from "@/lib/i18n-config";
import { listingService } from "@/services";
import {
  formatNumericDate,
  formatPrice,
  getDisplayTitle,
  listingLocation,
} from "@/lib/utils";
import { MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { ListingContactActions } from "@/components/chat/ListingContactActions";
import {coordinateMapUrl} from '@/lib/geo';

interface ListingPageProps {
  params: Promise<{ lang: string; id: string }>;
}

export async function generateMetadata({ params }: ListingPageProps) {
  const { id, lang } = await params;
  const listing = await listingService.getListingById(id);
  if (!listing) return { title: "Listing Not Found" };
  return {
    title: listing.title,
    description: listing.description.slice(0, 160),
    alternates: { canonical: `/${lang}/listings/${id}`, languages:Object.fromEntries(i18n.locales.map(locale=>[locale,`/${locale}/listings/${id}`])) },
    openGraph: { title:listing.title,description:listing.description.slice(0,160),images:listing.images.slice(0,1) },
  };
}

export default async function DetailPage({ params }: ListingPageProps) {
  const resolvedParams = await params;
  const lang = (
    i18n.locales.includes(resolvedParams.lang as Locale)
      ? resolvedParams.lang
      : i18n.defaultLocale
  ) as Locale;
  const id = resolvedParams.id;
  const dict = await getDictionary(lang);
  const details = dict.listingDetails;
  const item = await listingService.getListingById(id);
  if (!item) notFound();

  const displayTitle = getDisplayTitle(item, lang);
  const mapUrl=coordinateMapUrl(item.location.latitude,item.location.longitude);
  const priceLabels =
    lang === "de"
      ? {
          contact: "Preis auf Anfrage",
          offers: "Angebot machen",
          free: "Kostenlos",
          negotiable: "VB",
          budget: "Budget",
        }
      : lang === "en"
        ? {
            contact: "Price on request",
            offers: "Make an offer",
            free: "Free",
            negotiable: "Negotiable",
            budget: "Budget",
          }
        : lang === "ku"
          ? {
              contact: "Bi me re têkilî daynin",
              offers: "Pêşniyar bike",
              free: "Belaş",
              negotiable: "Danûstandin",
              budget: "Budce",
            }
          : {
              contact: "السعر عند التواصل",
              offers: "تقديم عرض",
              free: "مجاني",
              negotiable: "قابل للتفاوض",
              budget: "الميزانية",
            };
  const priceDisplay = formatPrice(item, priceLabels);
  const formattedDate = formatNumericDate(item.publishedAt);
  const transactionKey = String(item.characteristics.transactionType ?? "");
  const transactionLabels: Record<string, Record<Locale, string>> = {
    lease: {ar:"ضمان / إيجار استثماري",ku:"Kirêya dirêj",de:"Pacht",en:"Lease"},
    sale: { ar: "بيع", ku: "Firotin", de: "Verkauf", en: "Sale" },
    rent: { ar: "إيجار", ku: "Kirê", de: "Miete", en: "Rent" },
    exchange: { ar: "مبادلة", ku: "Guhertin", de: "Tausch", en: "Exchange" },
    installment: {
      ar: "تقسيط",
      ku: "Bi qist",
      de: "Ratenzahlung",
      en: "Installments",
    },
    donation: {
      ar: "مجاناً / تبرع",
      ku: "Belaş / bexş",
      de: "Kostenlos / Spende",
      en: "Free / donation",
    },
    partnership: {
      ar: "شراكة / استثمار",
      ku: "Hevkarî",
      de: "Partnerschaft",
      en: "Partnership",
    },
    assignment: {
      ar: "تنازل",
      ku: "Devjêberdan",
      de: "Übertragung",
      en: "Assignment",
    },
  };
  const transactionLabel =
    transactionKey === "other"
      ? String(item.characteristics.customTransaction ?? "")
      : (transactionLabels[transactionKey]?.[lang] ?? "");

  const label={ar:{description:'الوصف',specs:'المواصفات',id:'معرّف الإعلان',yes:'نعم',no:'لا'},ku:{description:'Danasîn',specs:'Taybetmendî',id:'ID ya îlanê',yes:'Erê',no:'Na'},de:{description:'Beschreibung',specs:'Merkmale',id:'Anzeigen-ID',yes:'Ja',no:'Nein'},en:{description:'Description',specs:'Specifications',id:'Listing ID',yes:'Yes',no:'No'}}[lang];
  const specs=Object.entries(item.characteristicLabels??{}).flatMap(([key,names])=>{const raw=item.characteristics[key];if(raw==null||raw==='')return [];const options=item.characteristicOptions?.[key]?.[String(raw)];return [{key,name:names[lang]||names.ar||names.en||key,value:options?.[lang]||options?.ar||options?.en||(String(raw)==='true'?label.yes:String(raw)==='false'?label.no:String(raw))}];});
  return (
    <div className="grid grid-cols-1 gap-4 pb-20 md:gap-6 md:pb-12 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <ListingMedia key={item.id} images={item.images} videos={item.videos} title={displayTitle} lang={lang} purpose={item.purpose}/>
        {mapUrl&&<a className="block rounded-2xl bg-white p-4 text-sm font-bold text-rojRed underline" href={mapUrl} target="_blank" rel="noopener noreferrer">{({ar:'عرض موقع الإعلان على OpenStreetMap (خدمة خارجية)',ku:'Cihê îlanê li OpenStreetMap bibîne (xizmeta derveyî)',de:'Anzeigenstandort auf OpenStreetMap öffnen (externer Dienst)',en:'Open listing location on OpenStreetMap (external service)'})[lang]}</a>}
        <div className="bg-white rounded-roj p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h1 className="text-xl sm:text-2xl font-black text-rojNavy">
              {displayTitle}
            </h1>
            <ShareListing lang={lang} title={displayTitle}/>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 bg-rojWarmBg p-4 rounded-xl">
            <div className="text-2xl font-black text-rojRed">
              {priceDisplay}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>{formattedDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600 font-semibold">
            <MapPin className="w-4 h-4 text-rojRed" />
            <span>
              {listingLocation(item,lang)}
            </span>
          </div>
          {transactionLabel && (
            <div className="inline-flex rounded-lg bg-red-50 px-3 py-1.5 text-sm font-black text-rojRed">
              {transactionLabel}
            </div>
          )}
          <p className="break-all text-xs text-gray-500">{label.id}: <bdi>{item.publicCode||item.id}</bdi></p>
          {specs.length>0&&<section><h2 className="mb-3 font-bold">{label.specs}</h2><dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{specs.map(s=><div key={s.key} className="min-w-0 rounded-xl bg-rojWarmBg p-3"><dt className="text-sm text-gray-500">{s.name}</dt><dd className="break-words font-bold">{s.value}</dd></div>)}</dl></section>}
          <div>
            <h3 className="text-sm font-bold text-rojNavy mb-2">{label.description}</h3>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {item.description}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-roj p-6 border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-black text-sm text-rojNavy border-b pb-2">
            {details.sellerInfo}
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-50 text-rojRed font-black flex items-center justify-center text-lg">
              {item.seller.avatarUrl&&/^https:\/\//.test(item.seller.avatarUrl)?<img src={item.seller.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover"/>:item.seller.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-rojNavy text-sm">
                <Link className="hover:underline" href={`/${lang}/sellers/${item.seller.id}`}>{item.seller.name}</Link>
                {item.seller.isVerified && (
                  <CheckCircle2 className="w-4 h-4 text-rojRed" />
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {item.seller.joinedDate}
              </div>
            </div>
          </div>
          {item.contactEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.contactEmail)&&<a className="block break-all rounded-xl border p-3 text-center text-sm" href={`mailto:${encodeURIComponent(item.contactEmail)}`}>{item.contactEmail}</a>}
          <SafetyActions lang={lang} listingId={item.id} sellerId={item.seller.id}/>
          <ListingContactActions
            lang={lang}
            listingId={item.id}
            sellerId={item.seller.id}
            phone={item.contactPhone ?? ""}
            call={Boolean(item.directCallEnabled)}
            whatsapp={Boolean(item.whatsappEnabled)}
            chat={Boolean(item.chatEnabled)}
          />
        </div>
      </div>
    </div>
  );
}
