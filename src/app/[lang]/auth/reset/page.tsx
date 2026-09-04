import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { i18n, type Locale } from "@/lib/i18n-config";
export default async function ResetPage({ params }: { params: Promise<{ lang: string }> }) { const { lang: requested } = await params; const lang = (i18n.locales.includes(requested as Locale) ? requested : i18n.defaultLocale) as Locale; return <div className="py-8"><ResetPasswordForm lang={lang} /></div>; }
