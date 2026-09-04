"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { homeVideos, type PlatformVideo } from "@/services/platform-content";
import type { Locale } from "@/lib/i18n-config";

const heading = {
  ar: "فيديوهات RojDeal",
  ku: "Vîdyoyên RojDeal",
  de: "RojDeal-Videos",
  en: "RojDeal videos",
};
export function HomeAdminVideos({ lang }: { lang: Locale }) {
  const [items, setItems] = useState<PlatformVideo[]>([]),
    [index, setIndex] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    void homeVideos()
      .then(rows=>setItems(rows.filter(v=>(!v.startAt || Date.parse(v.startAt)<=Date.now()) && (!v.endAt || Date.parse(v.endAt)>Date.now()))))
      .catch(() => setItems([]));
  }, []);
  if (!items.length) return null;
  const current = items[Math.min(index, items.length - 1)];
  const move = (step: number) => {
    video.current?.pause();
    setIndex((value) => (value + step + items.length) % items.length);
  };
  return (
    <section className="mx-auto w-full max-w-4xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-rojNavy">{heading[lang]}</h2>
        {items.length > 1 && (
          <span className="text-xs font-bold text-gray-500">
            {index + 1}/{items.length}
          </span>
        )}
      </div>
      <article className="relative overflow-hidden rounded-[22px] bg-rojNavy shadow-sm">
        <div className="px-4 py-3 font-black text-white">
          {current.titles[lang] ||
            current.titles.ar ||
            current.titles.en ||
            "RojDeal"}
        </div>
        <video
          key={current.id}
          ref={video}
          src={current.mediaUrl}
          controls
          playsInline
          preload="metadata"
          onEnded={() => items.length > 1 && move(1)}
          className="aspect-video max-h-[70vh] w-full bg-black object-contain"
        />
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={{ar:"السابق",ku:"Berê",de:"Zurück",en:"Previous"}[lang]}
              className="absolute start-2 top-1/2 rounded-full bg-black/55 p-2 text-white"
            >
              <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={{ar:"التالي",ku:"Piştî",de:"Weiter",en:"Next"}[lang]}
              className="absolute end-2 top-1/2 rounded-full bg-black/55 p-2 text-white"
            >
              <ChevronRight className="h-6 w-6 rtl:rotate-180" />
            </button>
          </>
        )}
      </article>
      {items.length > 1 && (
        <div className="flex justify-center gap-2">
          {items.map((item, itemIndex) => (
            <button
              type="button"
              aria-label={`${itemIndex + 1}`}
              key={item.id}
              onClick={() => setIndex(itemIndex)}
              className={`h-2 rounded-full transition-all ${itemIndex === index ? "w-7 bg-rojRed" : "w-2 bg-gray-300"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
