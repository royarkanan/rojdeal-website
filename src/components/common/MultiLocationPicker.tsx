"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, MapPin, Minus, Search, X } from "lucide-react";
import { activeLocations } from '@/services/locations';
import { expandLocations } from '@/lib/navigation';
import type { Locale } from "@/lib/i18n-config";

type Node = {
  id: number;
  parent_id: number | null;
  names: Record<string, string>;
  sort_order: number;
};
const text = {
  ar: {
    label: "المحافظة أو المدينة",
    all: "كل المدن",
    search: "ابحث داخل المدن…",
    apply: "تطبيق",
    clear: "إلغاء الكل",
    selected: "محدد",
  },
  ku: {
    label: "Parêzgeh an bajar",
    all: "Hemû bajar",
    search: "Li bajaran bigere…",
    apply: "Bipejirîne",
    clear: "Hemû paqij bike",
    selected: "hilbijartî",
  },
  de: {
    label: "Provinz oder Stadt",
    all: "Alle Städte",
    search: "Orte durchsuchen…",
    apply: "Übernehmen",
    clear: "Alle löschen",
    selected: "ausgewählt",
  },
  en: {
    label: "Governorate or city",
    all: "All cities",
    search: "Search locations…",
    apply: "Apply",
    clear: "Clear all",
    selected: "selected",
  },
} as const;

const nameOf = (node: Node, lang: Locale) =>
  node.names?.[lang] || node.names?.ar || node.names?.en || "";

export function MultiLocationPicker({
  lang,
  name = "locationIds",
  initial = [],
}: {
  lang: Locale;
  name?: string;
  initial?: number[];
}) {
  const t = text[lang];
  const [nodes, setNodes] = useState<Node[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>(initial);
  const [draft, setDraft] = useState<number[]>(initial);
  const [draftAll, setDraftAll] = useState(initial.length === 0);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active=true;
    void activeLocations().then(data=>{if(active){setFailed(false);setNodes(data);}}).catch(()=>{if(active)setFailed(true);});
    return ()=>{active=false;};
  }, []);

  const roots = useMemo(
    () => nodes.filter((node) => node.parent_id == null),
    [nodes],
  );
  const descendants = (id: number): Node[] => {
    const ids=new Set(expandLocations(nodes,[id]));ids.delete(id);
    return nodes.filter(node=>ids.has(node.id));
  };
  const visible = (node: Node) =>
    !query.trim() ||
    nameOf(node, lang)
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()) ||
    descendants(node.id).some((child) =>
      nameOf(child, lang)
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    );
  const selectedNames = selected
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is Node => Boolean(node))
    .map((node) => nameOf(node, lang));
  const summary =
    selected.length === 0
      ? t.all
      : selected.length === 1
        ? selectedNames[0] || t.all
        : `${selected.length} ${t.selected}`;
  const targets = (id: number) => {
    return [id, ...descendants(id).map(node=>node.id)];
  };
  const checked = (id: number) =>
    draftAll || targets(id).every((target) => draft.includes(target));
  const partiallyChecked = (id: number) =>
    !draftAll &&
    targets(id).some((target) => draft.includes(target)) &&
    !checked(id);
  const toggle = (id: number) => {
    setDraftAll(false);
    setDraft((value) => {
      const ids = targets(id);
      const current = draftAll ? nodes.map((node) => node.id) : value;
      const ancestors: number[] = [];
      let parent = nodes.find(node => node.id === id)?.parent_id;
      while (parent != null && !ancestors.includes(parent)) {
        ancestors.push(parent);
        parent = nodes.find(node => node.id === parent)?.parent_id;
      }
      return ids.every((target) => current.includes(target))
        ? current.filter(
            (item) => !ids.includes(item) && !ancestors.includes(item),
          )
        : Array.from(new Set([...current, ...ids]));
    });
  };

  return (
    <div className="relative min-w-0">
      <input type="hidden" name={name} value={selected.join(",")} />
      <button
        type="button"
        aria-expanded={open}
        onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}
        onClick={() => {
          setDraft(expandLocations(nodes,selected));
          setDraftAll(selected.length === 0);
          setOpen((value) => !value);
        }}
        className="flex h-12 w-full min-w-0 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold"
      >
        <MapPin className="h-4 w-4 shrink-0 text-rojRed" />
        <span className="min-w-0 flex-1 truncate text-start">{summary}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-[70]" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
          <section className="flex max-h-[min(65dvh,620px)] w-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-rojWarmBg shadow-2xl">
            <header className="flex items-center justify-between border-b bg-white p-4">
              <button
                type="button"
                onClick={() => {
                  setDraftAll(false);
                  setDraft([]);
                }}
                className="text-xs font-black text-rojRed"
              >
                {t.clear}
              </button>
              <h2 className="font-black">{t.label}</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X />
              </button>
            </header>
            <div className="relative m-3">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className="h-11 w-full rounded-xl border bg-white ps-10 pe-3"
              />
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-3">
              {failed && <p role="alert">{lang==='ar'?'تعذر تحميل المواقع':lang==='de'?'Orte konnten nicht geladen werden':lang==='ku'?'Cih nehatin barkirin':'Locations could not be loaded'}</p>}
              <button
                type="button"
                role="checkbox"
                aria-checked={draftAll}
                onClick={() => {
                  setDraftAll(true);
                  setDraft([]);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-start"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border ${draftAll ? "border-rojRed bg-rojRed text-white" : ""}`}
                >
                  {draftAll && <Check className="h-4 w-4" />}
                </span>
                <strong>{t.all}</strong>
              </button>
              {roots.filter(visible).map((root) => (
                <div
                  key={root.id}
                  className="overflow-hidden rounded-2xl border bg-white"
                >
                  <div className="flex items-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={
                        partiallyChecked(root.id) ? "mixed" : checked(root.id)
                      }
                      onClick={() => toggle(root.id)}
                      className="flex flex-1 items-center gap-3 p-3 text-start"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${checked(root.id) ? "border-rojRed bg-rojRed text-white" : ""}`}
                      >
                        {checked(root.id) ? (
                          <Check className="h-4 w-4" />
                        ) : partiallyChecked(root.id) ? (
                          <Minus className="h-4 w-4" />
                        ) : null}
                      </span>
                      <strong>{nameOf(root, lang)}</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((value) =>
                          value.includes(root.id)
                            ? value.filter((id) => id !== root.id)
                            : [...value, root.id],
                        )
                      }
                      className="p-3"
                    >
                      <ChevronDown
                        className={`transition ${expanded.includes(root.id) ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                  {(expanded.includes(root.id) || query.trim()) && (
                    <div className="space-y-1 border-t bg-[#FBFAF8] p-2">
                      {descendants(root.id)
                        .filter(
                          (child) =>
                            !query.trim() ||
                            nameOf(child, lang)
                              .toLocaleLowerCase()
                              .includes(query.trim().toLocaleLowerCase()),
                        )
                        .map((child) => (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={
                              partiallyChecked(child.id)
                                ? "mixed"
                                : checked(child.id)
                            }
                            key={child.id}
                            onClick={() => toggle(child.id)}
                            className="flex w-full items-center gap-3 rounded-xl p-2.5 text-start hover:bg-white"
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded border ${checked(child.id) || partiallyChecked(child.id) ? "border-rojRed bg-rojRed text-white" : ""}`}
                            >
                              {checked(child.id) ? (
                                <Check className="h-4 w-4" />
                              ) : partiallyChecked(child.id) ? (
                                <Minus className="h-4 w-4" />
                              ) : null}
                            </span>
                            {nameOf(child, lang)}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <footer className="border-t bg-white p-3">
              <button
                type="button"
                disabled={!draftAll && draft.length === 0}
                onClick={() => {
                  setSelected(draftAll ? [] : draft);
                  setOpen(false);
                }}
                className="w-full rounded-xl bg-rojRed py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.apply} (
                {draftAll
                  ? t.all
                  : draft.length === 1
                    ? nameOf(
                        nodes.find((node) => node.id === draft[0]) ??
                          ({ names: {} } as Node),
                        lang,
                      )
                    : `${draft.length} ${t.selected}`}
                )
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
