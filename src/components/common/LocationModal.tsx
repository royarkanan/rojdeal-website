"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n-config";

type LocationNode = { id: number; parent_id: number | null; kind: string; names: Record<string, string>; sort_order: number };
const labelOf = (node: LocationNode, lang: Locale) => node.names?.[lang] || node.names?.en || node.names?.ar || "";
const copy = {
  ar: { title: "اختيار الموقع", hint: "اختر المحافظة ثم المنطقة أو المدينة", all: "كل المدن", clear: "مسح", apply: "تطبيق", loading: "جاري تحميل المواقع…" },
  ku: { title: "Hilbijartina cihê", hint: "Parêzgeh û paşê herêm an bajar hilbijêre", all: "Hemû bajar", clear: "Paqij bike", apply: "Bipejirîne", loading: "Cih tên barkirin…" },
  de: { title: "Standort auswählen", hint: "Bundesland und anschließend Ort auswählen", all: "Alle Städte", clear: "Löschen", apply: "Übernehmen", loading: "Orte werden geladen…" },
  en: { title: "Choose location", hint: "Select a governorate, then an area or city", all: "All cities", clear: "Clear", apply: "Apply", loading: "Loading locations…" },
} as const;

interface Props { isOpen: boolean; onClose: () => void; selectedCity: string; onSelectCity: (city: string) => void; lang: Locale }

export function LocationModal({ isOpen, onClose, selectedCity, onSelectCity, lang }: Props) {
  const [nodes, setNodes] = useState<LocationNode[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const text = copy[lang];

  useEffect(() => {
    if (!isOpen || nodes.length) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase.from("location_nodes").select("id,parent_id,kind,names,sort_order").eq("is_active", true)
        .order("sort_order").order("id");
      setNodes((data ?? []) as LocationNode[]);
      setLoading(false);
    };
    void load();
  }, [isOpen, nodes.length]);

  const roots = useMemo(() => nodes.filter((node) => node.parent_id == null), [nodes]);
  const children = (parent: number) => nodes.filter((node) => node.parent_id === parent);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4">
      <section className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-rojWarmBg shadow-2xl sm:rounded-[24px]">
        <header className="flex items-center justify-between border-b border-black/5 bg-white p-4">
          <button onClick={() => { onSelectCity(text.all); onClose(); }} className="text-xs font-bold text-rojRed">{text.clear}</button>
          <div className="text-center"><h2 className="font-black text-rojNavy">{text.title}</h2><p className="text-[11px] text-gray-500">{text.hint}</p></div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-500"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {loading && <p className="py-8 text-center text-sm text-gray-500">{text.loading}</p>}
          {roots.map((root) => (
            <div key={root.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white">
              <button onClick={() => setExpanded(expanded === root.id ? null : root.id)} className="flex w-full items-center gap-2 px-4 py-3.5 text-start">
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-rojNavy">{labelOf(root, lang)}</span>
                <ChevronDown className={`h-5 w-5 transition ${expanded === root.id ? "rotate-180" : ""}`} />
              </button>
              {expanded === root.id && (
                <div className="space-y-1 border-t border-black/5 bg-[#FBFAF8] p-2">
                  <button onClick={() => { onSelectCity(labelOf(root, lang)); onClose(); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-white">
                    {labelOf(root, lang)}{selectedCity === labelOf(root, lang) && <Check className="h-4 w-4 text-rojRed" />}
                  </button>
                  {children(root.id).map((child) => (
                    <button key={child.id} onClick={() => { onSelectCity(`${labelOf(root, lang)} · ${labelOf(child, lang)}`); onClose(); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm hover:bg-white">
                      <span>{labelOf(child, lang)}</span>{selectedCity.includes(labelOf(child, lang)) && <Check className="h-4 w-4 text-rojRed" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
