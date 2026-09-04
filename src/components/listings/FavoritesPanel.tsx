"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { listingService } from "@/services";
import { favoriteIds } from "@/services/web-features";
import { ListingCard } from "./ListingCard";
import type { Listing } from "@/types/listing";
import type { Locale } from "@/lib/i18n-config";

const copy = {
  ar: {
    title: "المفضلة",
    empty: "لا توجد إعلانات في المفضلة.",
    login: "سجّل الدخول لعرض المفضلة.",
    failed: "تعذر تحميل المفضلة.",
    retry: "إعادة المحاولة",
  },
  ku: {
    title: "Bijare",
    empty: "Îlanên bijare tune ne.",
    login: "Ji bo bijareyan têkeve.",
    failed: "Bijare nehatin barkirin.",
    retry: "Dîsa biceribîne",
  },
  de: {
    title: "Favoriten",
    empty: "Keine gespeicherten Anzeigen.",
    login: "Bitte anmelden, um Favoriten zu sehen.",
    failed: "Favoriten konnten nicht geladen werden.",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Favorites",
    empty: "No saved listings.",
    login: "Sign in to view favorites.",
    failed: "Favorites could not be loaded.",
    retry: "Try again",
  },
} as const;

export function FavoritesPanel({
  lang,
  showTitle = true,
}: {
  lang: Locale;
  showTitle?: boolean;
}) {
  const t = copy[lang];
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"ready" | "login" | "error">("ready");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setLoading(true);
    setState("ready");

    void Promise.all([favoriteIds(), listingService.getListings()])
      .then(([ids, all]) => {
        setItems(all.filter((listing) => ids.has(listing.id)));
      })
      .catch((error: unknown) => {
        setState(
          error instanceof Error && error.message === "authentication_required"
            ? "login"
            : "error",
        );
      })
      .finally(() => setLoading(false));
  }, [reload]);

  if (loading) {
    return <Loader2 className="mx-auto my-20 animate-spin text-rojRed" />;
  }

  return (
    <section className="space-y-4">
      {showTitle && <h1 className="text-2xl font-black">{t.title}</h1>}

      {state === "login" ? (
        <div className="rounded-2xl bg-white p-8 text-center">
          <p>{t.login}</p>
          <Link
            className="mt-4 inline-block rounded-xl bg-rojRed px-5 py-3 font-black text-white"
            href={`/${lang}/auth`}
          >
            {t.login}
          </Link>
        </div>
      ) : state === "error" ? (
        <div className="rounded-2xl bg-white p-8 text-center">
          <p className="font-bold text-red-700">{t.failed}</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-rojRed px-5 py-3 font-black text-white"
            onClick={() => setReload((value) => value + 1)}
          >
            {t.retry}
          </button>
        </div>
      ) : !items.length ? (
        <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} lang={lang} />
          ))}
        </div>
      )}
    </section>
  );
}
