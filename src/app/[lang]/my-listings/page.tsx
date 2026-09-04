import { MyListingsPanel } from "@/components/listings/MyListingsPanel";
import { AccountPageHeader } from "@/components/account/AccountBackLink";
import { i18n, type Locale } from "@/lib/i18n-config";

export default async function MyListingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: requested } = await params;
  const lang = (
    i18n.locales.includes(requested as Locale)
      ? requested
      : i18n.defaultLocale
  ) as Locale;

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-5">
      <AccountPageHeader lang={lang} title="listings" />
      <MyListingsPanel lang={lang} showTitle={false} />
    </div>
  );
}
