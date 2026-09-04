import Link from "next/link";
import {
  Building2,
  Car,
  Grid2X2,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { getDictionary } from "@/lib/get-dictionary";
import { i18n, type Locale } from "@/lib/i18n-config";
import { listingService } from "@/services";
import { ListingCard } from "@/components/listings/ListingCard";
import { HomeAdminVideos } from "@/components/platform/HomeAdminVideos";
import { marketplaceHref } from "@/lib/navigation";
import type { Category } from "@/types/listing";
import type { ListingFilterParams } from "@/types/listing";
import { cleanSearchParams } from '@/lib/search-params';
import { pageNumber, PAGE_SIZE } from '@/lib/pagination';
import { Pagination } from '@/components/common/Pagination';

export const dynamic = "force-dynamic";

const pageCopy = {
  ar: {
    all: "الكل",
    property: "العقارات",
    vehicle: "السيارات والآليات",
    other: "أغراض متنوعة",
    latest: "أحدث الإعلانات",
    result: "إعلان",
  },
  ku: {
    all: "Hemû",
    property: "Xanî û erd",
    vehicle: "Erebe û amûr",
    other: "Tiştên cûrbecûr",
    latest: "Îlanên herî nû",
    result: "îlan",
  },
  de: {
    all: "Alle",
    property: "Immobilien",
    vehicle: "Fahrzeuge",
    other: "Verschiedenes",
    latest: "Neueste Anzeigen",
    result: "Anzeigen",
  },
  en: {
    all: "All",
    property: "Real estate",
    vehicle: "Vehicles",
    other: "Miscellaneous",
    latest: "Latest listings",
    result: "listings",
  },
} as const;

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: requested } = await params;
  const lang = (
    i18n.locales.includes(requested as Locale) ? requested : i18n.defaultLocale
  ) as Locale;
  const dict = await getDictionary(lang);
  const text = pageCopy[lang];
  const p = cleanSearchParams(await searchParams);
  const page = pageNumber(p.page);
  const category = typeof p.category === 'string' && ['real_estate', 'vehicles', 'miscellaneous'].includes(p.category) ? p.category as Category : undefined;
  const locationIds = typeof p.locationIds === 'string' ? p.locationIds : '';
  const query = typeof p.q === 'string' ? p.q : '';
  const rows = await listingService.getListings({ page, category, query, purpose:p.purpose as ListingFilterParams['purpose'], transactionType:p.transactionType as ListingFilterParams['transactionType'], minPrice:p.minPrice?Number(p.minPrice):undefined, maxPrice:p.maxPrice?Number(p.maxPrice):undefined, sortBy:p.sortBy as ListingFilterParams['sortBy'], city:p.city, governorate:p.governorate, locationNodeIds: locationIds.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0) });
  const listings=rows.slice(0,PAGE_SIZE), hasNext=rows.length>PAGE_SIZE;
  const categories = [
    { label: text.all, href: marketplaceHref(lang, p), icon: Grid2X2, active: !category },
    {
      label: text.property,
      href: marketplaceHref(lang, p, 'real_estate'),
      active: category === 'real_estate',
      icon: Building2,
    },
    {
      label: text.vehicle,
      href: marketplaceHref(lang, p, 'vehicles'),
      active: category === 'vehicles',
      icon: Car,
    },
    {
      label: text.other,
      href: marketplaceHref(lang, p, 'miscellaneous'),
      active: category === 'miscellaneous',
      icon: MoreHorizontal,
    },
  ];

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <HomeAdminVideos lang={lang} />
      <form action={`/${lang}`} method="GET" className="relative">
        <input type="hidden" name="category" value={category ?? ''} />
        <input type="hidden" name="locationIds" value={locationIds} />
        {Object.entries(p).filter(([key])=>!['category','locationIds','q','page'].includes(key)).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
        <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
        <input
          name="q"
          defaultValue={query}
          placeholder={dict.common.searchPlaceholder}
          className="h-[54px] w-full rounded-2xl border border-black/[0.07] bg-white ps-12 pe-12 text-sm font-semibold outline-none transition focus:border-rojRed"
        />
        <Link
          href={`/${lang}/search?${new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([key])=>key!=='page')))}`}
          aria-label="filters"
          className="absolute end-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-rojNavy hover:bg-rojWarmBg"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Link>
      </form>

      <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {categories.map(({ label, href, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={`flex h-[92px] w-[94px] shrink-0 flex-col items-center justify-center gap-2 rounded-[18px] border text-center sm:w-full ${active ? "border-rojRed bg-rojRed text-white" : "border-black/[0.06] bg-white text-rojNavy"}`}
          >
            <Icon className="h-6 w-6" />
            <span className="line-clamp-2 px-1 text-xs font-extrabold leading-4">
              {label}
            </span>
          </Link>
        ))}
      </nav>

      <section id="results" className="scroll-mt-48 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black text-rojNavy">{category ? categories.find(c => c.active)?.label : text.latest}</h1>
          <span className="text-xs font-semibold text-gray-500">
            {listings.length} {text.result}
          </span>
        </div>
        {listings.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                dict={dict}
                lang={lang}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] bg-white p-10 text-center text-sm text-gray-500">
            {dict.common.noResults}
          </div>
        )}
        <Pagination lang={lang} page={page} hasNext={hasNext} path={`/${lang}`} params={p}/>
      </section>
    </div>
  );
}
