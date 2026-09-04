import { AuthForm } from "@/components/auth/AuthForm";
import { i18n, type Locale } from "@/lib/i18n-config";
export default async function AuthPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { lang: requested } = await params;
  const query = await searchParams;
  const lang = (i18n.locales.includes(requested as Locale) ? requested : i18n.defaultLocale) as Locale;
  return <div className="py-5 sm:py-10"><AuthForm lang={lang} nextPath={typeof query.next === 'string' ? query.next : undefined} /></div>;
}
