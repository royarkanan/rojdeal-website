import { AccountPanel } from "@/components/auth/AccountPanel";
import { i18n, type Locale } from "@/lib/i18n-config";
export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) { const { lang: requested } = await params; const lang = (i18n.locales.includes(requested as Locale) ? requested : i18n.defaultLocale) as Locale; return <div className="py-5"><AccountPanel lang={lang} /></div>; }
