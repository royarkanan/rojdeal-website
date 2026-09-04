"use client";
import { useEffect, useState } from "react";
import { FileText, Loader2, Save } from "lucide-react";
import type { Locale } from "@/lib/i18n-config";
import {
  allManagedPages,
  saveManagedPage,
  type ManagedPageKey,
  type ManagedPageValues,
} from "@/services/platform-content";
const languages = ["ar", "ku", "de", "en"] as const;
const names = {
  ar: {
    about: "عن RojDeal",
    safety: "السلامة",
    privacy: "الخصوصية",
    terms: "الشروط",
    imprint: "بيانات الناشر",
  },
  ku: {
    about: "Derbarê RojDeal",
    safety: "Ewlehî",
    privacy: "Nepenî",
    terms: "Merc",
    imprint: "Agahiyên weşanger",
  },
  de: {
    about: "Über RojDeal",
    safety: "Sicherheit",
    privacy: "Datenschutz",
    terms: "Bedingungen",
    imprint: "Impressum",
  },
  en: {
    about: "About RojDeal",
    safety: "Safety",
    privacy: "Privacy",
    terms: "Terms",
    imprint: "Legal notice",
  },
} as const;
const copy = {
  ar: {
    heading: "إدارة صفحات الموقع",
    language: "اللغة",
    title: "عنوان الصفحة",
    content: "محتوى الصفحة",
    save: "حفظ الصفحة",
    saved: "تم الحفظ والربط بالموقع",
    failed: "تعذر الحفظ",
    hint: "اترك الحقل فارغًا لاستخدام النص الأساسي.",
  },
  ku: {
    heading: "Rêveberiya rûpelan",
    language: "Ziman",
    title: "Sernav",
    content: "Naverok",
    save: "Tomar bike",
    saved: "Hat tomarkirin",
    failed: "Tomarkirin bi ser neket",
    hint: "Ji bo nivîsa bingehîn vala bihêle.",
  },
  de: {
    heading: "Webseiten verwalten",
    language: "Sprache",
    title: "Seitentitel",
    content: "Seiteninhalt",
    save: "Speichern",
    saved: "Gespeichert und verbunden",
    failed: "Speichern fehlgeschlagen",
    hint: "Leer lassen, um den Standardtext zu verwenden.",
  },
  en: {
    heading: "Manage website pages",
    language: "Language",
    title: "Page title",
    content: "Page content",
    save: "Save",
    saved: "Saved and connected",
    failed: "Could not save",
    hint: "Leave empty to use the default text.",
  },
} as const;
export function AdminLegalPages({ lang }: { lang: Locale }) {
  const t = copy[lang],
    [page, setPage] = useState<ManagedPageKey>("about"),
    [editLang, setEditLang] = useState<Locale>(lang),
    [pages, setPages] = useState<Record<
      ManagedPageKey,
      ManagedPageValues
    > | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    void allManagedPages()
      .then(setPages)
      .catch(() => setNotice(t.failed));
  }, [t.failed]);
  if (!pages && notice) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{notice}</p>;
  if (!pages) return <Loader2 className="mx-auto animate-spin text-rojRed" />;
  const value = pages[page][editLang] ?? { title: "", content: "" };
  const update = (field: "title" | "content", next: string) =>
    setPages(
      (old) =>
        old && {
          ...old,
          [page]: { ...old[page], [editLang]: { ...value, [field]: next } },
        },
    );
  return (
    <section className="rounded-[22px] bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
        <FileText className="text-rojRed" />
        {t.heading}
      </h2>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {(Object.keys(names[lang]) as ManagedPageKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${page === key ? "bg-rojNavy text-white" : "bg-rojWarmBg"}`}
          >
            {names[lang][key]}
          </button>
        ))}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-bold">{t.language}:</span>
        {languages.map((key) => (
          <button
            key={key}
            onClick={() => setEditLang(key)}
            className={`rounded-lg px-3 py-2 text-xs font-black uppercase ${editLang === key ? "bg-rojRed text-white" : "border"}`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <input
          value={value.title}
          onChange={(e) => update("title", e.target.value)}
          maxLength={160}
          placeholder={t.title}
          className="w-full rounded-xl border p-3"
        />
        <textarea
          value={value.content}
          onChange={(e) => update("content", e.target.value)}
          maxLength={20000}
          rows={12}
          placeholder={t.content}
          className="w-full rounded-xl border p-3 leading-7"
        />
        <p className="text-xs text-gray-500">{t.hint}</p>
        {notice && (
          <p className="rounded-xl bg-rojWarmBg p-3 text-sm font-bold">
            {notice}
          </p>
        )}
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setNotice("");
            try {
              await saveManagedPage(page, pages[page]);
              setNotice(t.saved);
            } catch {
              setNotice(t.failed);
            } finally {
              setBusy(false);
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rojRed px-4 py-3 font-black text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Save />}
          {t.save}
        </button>
      </div>
    </section>
  );
}
