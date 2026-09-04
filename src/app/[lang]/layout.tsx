import React from "react";
import { i18n, isRTL, Locale } from "@/lib/i18n-config";
import { getDictionary } from "@/lib/get-dictionary";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";
import { MobileBottomBar } from "@/components/common/MobileBottomBar";
import "@/app/globals.css";
import { siteUrl, siteCopy } from '@/lib/site';

export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const resolvedParams = await params;
  const lang = (
    i18n.locales.includes(resolvedParams.lang as Locale)
      ? resolvedParams.lang
      : i18n.defaultLocale
  ) as Locale;
  return {
    metadataBase: new URL(siteUrl),
    title: {
      template: "%s | RojDeal",
      default: siteCopy[lang].title,
    },
    description: siteCopy[lang].description,
    manifest: "/manifest.webmanifest",
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const resolvedParams = await params;
  const lang = (
    i18n.locales.includes(resolvedParams.lang as Locale)
      ? resolvedParams.lang
      : i18n.defaultLocale
  ) as Locale;
  const dict = await getDictionary(lang);
  const rtl = isRTL(lang);

  return (
    <html lang={lang} dir={rtl ? "rtl" : "ltr"}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7912194394831020"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className="bg-rojWarmBg text-rojNavy min-h-screen flex flex-col font-sans">
        <React.Suspense fallback={<div className="h-32" aria-busy="true" />}>
          <Header lang={lang} dict={dict} />
        </React.Suspense>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-3 sm:px-5 md:px-6 lg:px-8">
          {children}
        </main>
        <Footer lang={lang} dict={dict} />
        <MobileBottomBar lang={lang} />
      </body>
    </html>
  );
}
