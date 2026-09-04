import {ActiveFilters} from '@/components/common/ActiveFilters';
import {SaveSearch} from '@/components/account/SaveSearch';
import { getDictionary } from "@/lib/get-dictionary";
import { type Locale, i18n } from "@/lib/i18n-config";
import { listingService } from "@/services";
import type {
  Category,
  ListingPurpose,
  ListingTransactionType,
} from "@/types/listing";
import { ListingCard } from "@/components/listings/ListingCard";
import { Filter, Search } from "lucide-react";
import { MultiLocationPicker } from "@/components/common/MultiLocationPicker";
import { cleanSearchParams } from '@/lib/search-params';
import { pageNumber, PAGE_SIZE } from '@/lib/pagination';
import { Pagination } from '@/components/common/Pagination';

type Params = {
  page?: string;
  q?: string;
  category?: Category;
  purpose?: ListingPurpose;
  transactionType?: ListingTransactionType;
  governorate?: string;
  city?: string;
  locationIds?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: "newest" | "price_asc" | "price_desc";
};
const copy = {
  ar: {
    title: "البحث والتصفية",
    result: "نتيجة",
    empty: "لم يتم العثور على نتائج",
    q: "ابحث عن عقار، سيارة، مدينة أو معلن…",
    category: "كل الأقسام",
    realEstate: "العقارات",
    vehicles: "السيارات والآليات",
    misc: "أغراض متنوعة",
    purpose: "كل أنواع الطلب",
    sell: "للبيع",
    rent: "للإيجار",
    wanted: "مطلوب",
    transaction: "كل طرق الصفقة",
    exchange: "مبادلة",
    installment: "تقسيط",
    donation: "مجاناً / تبرع",
    partnership: "شراكة / استثمار",
    assignment: "تنازل",
    otherTransaction: "أخرى",
    governorate: "المحافظة",
    city: "المدينة أو المنطقة",
    min: "أقل سعر",
    max: "أعلى سعر",
    newest: "الأحدث",
    priceAsc: "السعر: من الأقل",
    priceDesc: "السعر: من الأعلى",
    apply: "تطبيق البحث والفلاتر",
    clear: "مسح الفلاتر",
  },
  ku: {
    title: "Lêgerîn û parzûn",
    result: "encam",
    empty: "Tu encam nehat dîtin",
    q: "Li mal, erebe, bajar an firoşkar bigere…",
    category: "Hemû beş",
    realEstate: "Emlak",
    vehicles: "Erebe û makîne",
    misc: "Tiştên cuda",
    purpose: "Hemû cure",
    sell: "Ji bo firotinê",
    rent: "Ji bo kirê",
    wanted: "Tê xwestin",
    transaction: "Hemû cureyên danûstandinê",
    exchange: "Guhertin",
    installment: "Bi qist",
    donation: "Belaş / bexş",
    partnership: "Hevkarî / veberhênan",
    assignment: "Devjêberdan",
    otherTransaction: "Din",
    governorate: "Parêzgeh",
    city: "Bajar an herêm",
    min: "Bihayê herî kêm",
    max: "Bihayê herî zêde",
    newest: "Herî nû",
    priceAsc: "Biha: ji kêm",
    priceDesc: "Biha: ji zêde",
    apply: "Lêgerînê bike",
    clear: "Parzûnan paqij bike",
  },
  de: {
    title: "Suche und Filter",
    result: "Ergebnisse",
    empty: "Keine Ergebnisse gefunden",
    q: "Immobilie, Fahrzeug, Ort oder Anbieter suchen…",
    category: "Alle Kategorien",
    realEstate: "Immobilien",
    vehicles: "Fahrzeuge und Maschinen",
    misc: "Verschiedenes",
    purpose: "Alle Angebotstypen",
    sell: "Verkauf",
    rent: "Miete",
    wanted: "Gesucht",
    transaction: "Alle Geschäftsarten",
    exchange: "Tausch",
    installment: "Ratenzahlung",
    donation: "Kostenlos / Spende",
    partnership: "Partnerschaft / Investition",
    assignment: "Übertragung",
    otherTransaction: "Andere",
    governorate: "Provinz",
    city: "Stadt oder Region",
    min: "Mindestpreis",
    max: "Höchstpreis",
    newest: "Neueste",
    priceAsc: "Preis: aufsteigend",
    priceDesc: "Preis: absteigend",
    apply: "Suche und Filter anwenden",
    clear: "Filter löschen",
  },
  en: {
    title: "Search and filters",
    result: "results",
    empty: "No results found",
    q: "Search property, vehicle, place or seller…",
    category: "All categories",
    realEstate: "Real estate",
    vehicles: "Vehicles and machinery",
    misc: "Miscellaneous",
    purpose: "All listing types",
    sell: "For sale",
    rent: "For rent",
    wanted: "Wanted",
    transaction: "All transaction types",
    exchange: "Exchange",
    installment: "Installments",
    donation: "Free / donation",
    partnership: "Partnership / investment",
    assignment: "Assignment",
    otherTransaction: "Other",
    governorate: "Governorate",
    city: "City or area",
    min: "Minimum price",
    max: "Maximum price",
    newest: "Newest",
    priceAsc: "Price: low to high",
    priceDesc: "Price: high to low",
    apply: "Apply search and filters",
    clear: "Clear filters",
  },
} as const;
const number = (value?: string) =>
  value && Number.isFinite(Number(value)) ? Number(value) : undefined;
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: raw } = await params;
  const lang = (
    i18n.locales.includes(raw as Locale) ? raw : i18n.defaultLocale
  ) as Locale;
  const p = cleanSearchParams(await searchParams) as Params,
    t = copy[lang],
    dict = await getDictionary(lang);
  const page=pageNumber(p.page);
  const rows = await listingService.getListings({
    page,
    query: p.q,
    category: p.category,
    purpose: p.purpose,
    transactionType: p.transactionType,
    governorate: p.governorate,
    city: p.city,
    locationNodeIds: (p.locationIds ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0),
    minPrice: number(p.minPrice),
    maxPrice: number(p.maxPrice),
    sortBy: p.sortBy,
  });
  const listings=rows.slice(0,PAGE_SIZE), hasNext=rows.length>PAGE_SIZE;
  const field =
    "h-12 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-rojRed";
  return (
    <div className="space-y-5 pb-20 md:pb-12">
      <form
        key={JSON.stringify(p)}
        method="GET"
        action={`/${lang}/search`}
        className="space-y-3 rounded-[22px] bg-white p-4 shadow-sm"
      >
        <h1 className="text-xl font-black text-rojNavy">{t.title}</h1>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={p.q}
            placeholder={t.q}
            className={`${field} w-full ps-11`}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            name="category"
            defaultValue={p.category ?? ""}
            className={field}
          >
            <option value="">{t.category}</option>
            <option value="real_estate">{t.realEstate}</option>
            <option value="vehicles">{t.vehicles}</option>
            <option value="miscellaneous">{t.misc}</option>
          </select>
          <select
            name="purpose"
            defaultValue={p.purpose ?? ""}
            className={field}
          >
            <option value="">{t.purpose}</option>
            <option value="sell">{t.sell}</option>
            <option value="rent">{t.rent}</option>
            <option value="wanted">{t.wanted}</option>
          </select>
          <select
            name="transactionType"
            defaultValue={p.transactionType ?? ""}
            className={field}
          >
            <option value="">{t.transaction}</option>
            <option value="lease">{({ar:'ضمان / إيجار استثماري',ku:'Kirêya dirêj',de:'Pacht',en:'Lease'})[lang]}</option>
            <option value="exchange">{t.exchange}</option>
            <option value="installment">{t.installment}</option>
            <option value="donation">{t.donation}</option>
            <option value="partnership">{t.partnership}</option>
            <option value="assignment">{t.assignment}</option>
            <option value="other">{t.otherTransaction}</option>
          </select>
          <MultiLocationPicker key={p.locationIds ?? ''} lang={lang} initial={(p.locationIds ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0)} />
          <input
            name="minPrice"
            type="number"
            min="0"
            defaultValue={p.minPrice}
            placeholder={t.min}
            className={field}
          />
          <input
            name="maxPrice"
            type="number"
            min="0"
            defaultValue={p.maxPrice}
            placeholder={t.max}
            className={field}
          />
          <select
            name="sortBy"
            defaultValue={p.sortBy ?? ""}
            className={field}
          >
            <option value="">{({ar:'الأنسب للبحث / الأحدث',ku:'Li gorî lêgerînê / herî nû',de:'Relevanz / Neueste',en:'Relevance / newest'})[lang]}</option>
            <option value="newest">{t.newest}</option>
            <option value="price_asc">{t.priceAsc}</option>
            <option value="price_desc">{t.priceDesc}</option>
          </select>
          <div className="flex gap-2">
            <button className="min-w-0 flex-1 rounded-xl bg-rojRed px-3 font-black text-white">
              {t.apply}
            </button>
            <a
              href={`/${lang}/search`}
              className="flex items-center rounded-xl border px-3 text-xs font-bold"
            >
              {t.clear}
            </a>
          </div>
        </div>
      </form>
      <ActiveFilters lang={lang} params={p}/>
      <SaveSearch key={JSON.stringify(p)} lang={lang} params={p}/>
      <div id="results" className="scroll-mt-48 flex items-center justify-between">
        <h2 className="text-lg font-black text-rojNavy">{t.title}</h2>
        <span className="text-xs font-bold text-gray-500">
          {listings.length} {t.result}
        </span>
      </div>
      {listings.length === 0 ? (
        <div className="rounded-[22px] bg-white p-12 text-center">
          <Filter className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h3 className="font-bold text-rojNavy">{t.empty}</h3>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {listings.map((item) => (
            <ListingCard key={item.id} listing={item} dict={dict} lang={lang} />
          ))}
        </div>
      )}
      <Pagination lang={lang} page={page} hasNext={hasNext} path={`/${lang}/search`} params={p}/>
    </div>
  );
}
