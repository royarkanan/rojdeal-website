import { ListingEditor } from "@/components/listings/ListingEditor"; import { i18n,type Locale } from "@/lib/i18n-config";
export default async function Page({params}:{params:Promise<{lang:string}>}){const {lang:raw}=await params;const lang=(i18n.locales.includes(raw as Locale)?raw:i18n.defaultLocale) as Locale;return <div className="py-4"><ListingEditor lang={lang}/></div>}
