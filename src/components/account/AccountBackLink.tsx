import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Locale } from "@/lib/i18n-config";
import { accountText, type AccountLabel } from "@/lib/account-copy";

export function AccountBackLink({ lang }: { lang: Locale }) {
  return (
    <Link
      href={`/${lang}/account`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white text-rojNavy transition hover:border-rojRed hover:text-rojRed"
      aria-label={accountText(lang, "title")}
    >
      {lang === "ar" ? (
        <ArrowRight className="h-5 w-5" />
      ) : (
        <ArrowLeft className="h-5 w-5" />
      )}
    </Link>
  );
}

export function AccountPageHeader({
  lang,
  title,
}: {
  lang: Locale;
  title: AccountLabel;
}) {
  return (
    <div
      dir="ltr"
      className="flex min-h-20 items-center gap-4 rounded-3xl bg-white p-4 shadow-sm sm:px-6"
    >
      <AccountBackLink lang={lang} />

      <h1
        dir={lang === "ar" ? "rtl" : "ltr"}
        className={`min-w-0 flex-1 text-2xl font-black text-rojNavy ${
          lang === "ar" ? "text-right" : "text-left"
        }`}
      >
        {accountText(lang, title)}
      </h1>
    </div>
  );
}
