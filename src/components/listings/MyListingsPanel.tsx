"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { listingService } from "@/services";
import { formatPrice, getDisplayTitle } from "@/lib/utils";
import type { Locale } from "@/lib/i18n-config";
import type { Listing, ListingStatus } from "@/types/listing";

const copy = {
  ar: {
    title: "إعلاناتي",
    empty: "لم تضف أي إعلان بعد.",
    error: "تعذر تحميل إعلاناتك. حاول مجددًا.",
    retry: "إعادة المحاولة",
    open: "عرض",
    edit: "تعديل",
    status: "حالة الإعلان",
    active: "منشور",
    hidden: "مخفي",
    reserved: "محجوز",
    sold: "مباع",
    draft: "مسودة",
    removed: "محذوف",
    rejected: "مرفوض",
    remove: "حذف",
    confirm: "هل تريد حذف هذا الإعلان نهائيًا؟",
    failed: "تعذر تنفيذ العملية.",
    contact: "السعر عند التواصل",
    offers: "تلقي عروض",
    free: "مجاني",
    negotiable: "قابل للتفاوض",
    budget: "الميزانية",
  },
  ku: {
    title: "Îlanên min",
    empty: "Te hîn îlanek çênekiriye.",
    error: "Îlan nehatin barkirin.",
    retry: "Dîsa biceribîne",
    open: "Bibîne",
    edit: "Biguherîne",
    status: "Rewş",
    active: "Weşandî",
    hidden: "Veşartî",
    reserved: "Veqetandî",
    sold: "Firotî",
    draft: "Pêşnivîs",
    removed: "Jêbirî",
    rejected: "Redkirî",
    remove: "Jêbirin",
    confirm: "Tu dixwazî vî îlanî jê bibî?",
    failed: "Operasyon bi ser neket.",
    contact: "Bi têkiliyê re",
    offers: "Pêşniyar",
    free: "Belaş",
    negotiable: "Danûstandin",
    budget: "Bûdce",
  },
  de: {
    title: "Meine Anzeigen",
    empty: "Du hast noch keine Anzeige erstellt.",
    error: "Deine Anzeigen konnten nicht geladen werden.",
    retry: "Erneut versuchen",
    open: "Öffnen",
    edit: "Bearbeiten",
    status: "Status",
    active: "Veröffentlicht",
    hidden: "Ausgeblendet",
    reserved: "Reserviert",
    sold: "Verkauft",
    draft: "Entwurf",
    removed: "Gelöscht",
    rejected: "Abgelehnt",
    remove: "Löschen",
    confirm: "Diese Anzeige wirklich löschen?",
    failed: "Die Aktion konnte nicht ausgeführt werden.",
    contact: "Preis auf Anfrage",
    offers: "Angebote",
    free: "Kostenlos",
    negotiable: "Verhandelbar",
    budget: "Budget",
  },
  en: {
    title: "My listings",
    empty: "You have not created a listing yet.",
    error: "Your listings could not be loaded.",
    retry: "Try again",
    open: "Open",
    edit: "Edit",
    status: "Status",
    active: "Published",
    hidden: "Hidden",
    reserved: "Reserved",
    sold: "Sold",
    draft: "Draft",
    removed: "Deleted",
    rejected: "Rejected",
    remove: "Delete",
    confirm: "Delete this listing?",
    failed: "The action could not be completed.",
    contact: "Contact for price",
    offers: "Offers",
    free: "Free",
    negotiable: "Negotiable",
    budget: "Budget",
  },
} as const;

const editableStatuses: ListingStatus[] = [
  "active",
  "hidden",
  "reserved",
  "sold",
];

export function MyListingsPanel({ lang, showTitle = true }: { lang: Locale; showTitle?: boolean }) {
  const text = copy[lang];
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setItems(await listingService.getOwnListings());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const changeStatus = async (item: Listing, status: ListingStatus) => {
    setBusy(item.id);
    try {
      await listingService.setOwnListingStatus(item.id, status);
      setItems((old) =>
        old.map((x) => (x.id === item.id ? { ...x, status } : x)),
      );
    } catch {
      window.alert(text.failed);
    } finally {
      setBusy(null);
    }
  };
  const remove = async (item: Listing) => {
    if (!window.confirm(text.confirm)) return;
    setBusy(item.id);
    try {
      await listingService.requestOwnListingDeletion(item.id);
      setItems((old) => old.filter((x) => x.id !== item.id));
    } catch {
      window.alert(text.failed);
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-rojRed" />
      </div>
    );
  if (error)
    return (
      <div className="rounded-[22px] bg-white p-8 text-center">
        <p>{text.error}</p>
        <button
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-rojRed px-5 py-3 font-black text-white"
        >
          {text.retry}
        </button>
      </div>
    );
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      {showTitle&&<h1 className="text-2xl font-black text-rojNavy">{text.title}</h1>}
      {!items.length ? (
        <div className="rounded-[22px] bg-white p-10 text-center text-gray-500">
          {text.empty}
        </div>
      ) : (
        items.map((item) => {
          const mutable = editableStatuses.includes(item.status);
          return (
            <article
              key={item.id}
              className="rounded-[22px] bg-white p-4 shadow-sm sm:flex sm:items-center sm:gap-4"
            >
              <div className="h-36 w-full overflow-hidden rounded-2xl bg-[#f4eee8] sm:h-28 sm:w-36 sm:shrink-0">
                {item.images[0] ? (
                  <Image
                    src={item.images[0]}
                    alt=""
                    width={288}
                    height={224}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pt-3 sm:pt-0">
                <h2 className="truncate font-black text-rojNavy">
                  {getDisplayTitle(item, lang)}
                </h2>
                <p className="mt-1 text-sm font-bold text-rojRed">
                  {formatPrice(item, text)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {mutable ? (
                    <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold">
                      <span>{text.status}</span>
                      <select
                        value={item.status}
                        disabled={busy === item.id}
                        onChange={(e) =>
                          void changeStatus(
                            item,
                            e.target.value as ListingStatus,
                          )
                        }
                        className="bg-transparent outline-none"
                      >
                        {editableStatuses.map((status) => (
                          <option key={status} value={status}>
                            {text[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold">
                      {text[item.status]}
                    </span>
                  )}
                  {(item.status === "active" || item.status === "reserved") && (
                    <Link
                      href={`/${lang}/listings/${item.id}`}
                      className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold"
                    >
                      <Eye className="h-4 w-4" />
                      {text.open}
                    </Link>
                  )}
                  {item.status !== "removed" && (
                    <Link href={`/${lang}/listings/${item.id}/edit`} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold">
                      <Pencil className="h-4 w-4" />{text.edit}
                    </Link>
                  )}
                  {item.status !== "removed" && (
                    <button
                      disabled={busy === item.id}
                      onClick={() => void remove(item)}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-rojRed"
                    >
                      <Trash2 className="h-4 w-4" />
                      {text.remove}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
