"use client";
import React from "react";
import Link from "next/link";
import { Locale } from "@/lib/i18n-config";
import { Logo } from "./Logo";
import { MultiLocationPicker } from "./MultiLocationPicker";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  Search,
  Home,
  Heart,
  PlusCircle,
  MessageSquare,
  User,
} from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { usePathname, useSearchParams } from "next/navigation";

export const Header: React.FC<{ lang: Locale; dict: Record<string, any> }> = ({
  lang,
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationIds=(searchParams.get('locationIds') ?? '').split(',').map(Number).filter(n=>Number.isInteger(n)&&n>0);
  return (
    <header className="sticky top-0 z-40 bg-rojWarmBg/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 pb-2.5 pt-2 sm:px-5 md:px-6 lg:px-8">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
          <Logo lang={lang} />
          <div className="flex items-center gap-2">
            <NotificationBell lang={lang} />
            <AuthButton lang={lang} />
            <LanguageSwitcher currentLocale={lang} />
          </div>
        </div>
        <form
          action={pathname === `/${lang}` || pathname === `/${lang}/search` ? pathname : `/${lang}`}
          className="grid grid-cols-[1fr_46px] gap-2"
        >
          <input type="hidden" name="category" value={searchParams.get('category') ?? ''}/>
          <input type="hidden" name="q" value={searchParams.get('q') ?? ''}/>
          {['purpose','transactionType','minPrice','maxPrice','sortBy','city','governorate'].map(key=><input key={key} type="hidden" name={key} value={searchParams.get(key)??''}/>)}
          <MultiLocationPicker key={locationIds.join(',')} lang={lang} initial={locationIds} />
          <button
            aria-label="Search"
            className="flex items-center justify-center rounded-xl bg-rojRed text-white"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>
        <nav className="hidden items-center justify-center gap-2 md:flex">
          {[
            {
              href: `/${lang}`,
              icon: Home,
              ar: "الرئيسية",
              ku: "Mal",
              de: "Start",
              en: "Home",
            },
            {
              href: `/${lang}/favorites`,
              icon: Heart,
              ar: "المفضلة",
              ku: "Bijare",
              de: "Favoriten",
              en: "Favorites",
            },
            {
              href: `/${lang}/listings/new`,
              icon: PlusCircle,
              ar: "أضف إعلاناً",
              ku: "Îlan zêde bike",
              de: "Anzeige",
              en: "Add listing",
            },
            {
              href: `/${lang}/messages`,
              icon: MessageSquare,
              ar: "الرسائل",
              ku: "Peyam",
              de: "Nachrichten",
              en: "Messages",
            },
            {
              href: `/${lang}/account`,
              icon: User,
              ar: "حسابي",
              ku: "Hesab",
              de: "Konto",
              en: "Account",
            },
          ].map(({ href, icon: Icon, ...labels }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${active ? "bg-rojRed text-white" : "hover:bg-white"}`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-white" : "text-rojRed"}`}
                  aria-hidden="true"
                />
                {labels[lang]}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
