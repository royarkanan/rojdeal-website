"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import type { Locale } from "@/lib/i18n-config";
import { adminText, displayDate, auditDetails } from '@/lib/admin-display';
import { ListingPreview } from './ListingPreview';
import { SupportThread } from '@/components/support/SupportThread';
import { AdminMessageComposer } from './AdminMessageComposer';
import {
  adminListings,
  ADMIN_PAGE_SIZE,
  adminRequests,
  adminUsers,
  assignStaff,
  auditLog,
  locationProposals,
  moderateListing,
  pendingVideos,
  removeStaff,
  resolveSafetyReport,
  reviewLocation,
  reviewVideo,
  safetyReports,
  setAccountTier,
  staffAccounts,
  staffRoles,
  suspendAccount,
  updateRequest,
  type AdminRow,
} from "@/services/admin-operations";

export type AdminSection =
  | "users"
  | "listings"
  | "reports"
  | "support"
  | "tiers"
  | "staff"
  | "locations"
  | "media"
  | "audit";

const labels = {
  ar: {
    users: "المستخدمون",
    listings: "الإعلانات",
    reports: "البلاغات",
    support: "الدعم",
    tiers: "طلبات PRO وGOLD",
    staff: "فريق الإدارة",
    locations: "طلبات المواقع",
    media: "مراجعة الفيديو",
    audit: "سجل العمليات",
    search: "بحث",
    refresh: "تحديث",
    empty: "لا توجد نتائج",
    failed: "تعذر تنفيذ العملية",
    noteRequired: "اكتب سبباً أو ملاحظة واضحة من 5 أحرف على الأقل.",
    alreadyDecided: "تم اتخاذ قرار بشأن هذا الطلب مسبقاً.",
    saved: "تم حفظ القرار",
    approve: "موافقة",
    reject: "رفض",
    suspend: "إيقاف",
    restore: "إلغاء الإيقاف",
    remove: "حذف الصلاحية",
    email: "البريد الإلكتروني",
    role: "الدور",
    assign: "تعيين",
    note: "سبب أو ملاحظة",
    publish: "نشر",
    hide: "إخفاء",
    removeListing: "إزالة",
    standard: "Standard",
    pro: "PRO",
    gold: "GOLD",
  },
  ku: {
    users: "Bikarhêner",
    listings: "Îlan",
    reports: "Rapor",
    support: "Alîkarî",
    tiers: "Daxwazên PRO û GOLD",
    staff: "Tîma rêveberiyê",
    locations: "Daxwazên cihan",
    media: "Kontrola vîdyoyê",
    audit: "Tomara çalakiyan",
    search: "Lêgerîn",
    refresh: "Nû bike",
    empty: "Encam tune",
    failed: "Çalakî bi ser neket",
    noteRequired: "Sedem an têbîniyek bi herî kêm 5 tîpan binivîse.",
    alreadyDecided: "Ev daxwaz berê hatiye biryardan.",
    saved: "Biryar hat tomarkirin",
    approve: "Bipejirîne",
    reject: "Red bike",
    suspend: "Rawestîne",
    restore: "Vegerîne",
    remove: "Destûrê rake",
    email: "E-name",
    role: "Rol",
    assign: "Tayîn bike",
    note: "Sedem an têbinî",
    publish: "Weşîne",
    hide: "Veşêre",
    removeListing: "Rake",
    standard: "Standard",
    pro: "PRO",
    gold: "GOLD",
  },
  de: {
    users: "Benutzer",
    listings: "Anzeigen",
    reports: "Meldungen",
    support: "Support",
    tiers: "PRO-/GOLD-Anträge",
    staff: "Verwaltungsteam",
    locations: "Ortsvorschläge",
    media: "Videoprüfung",
    audit: "Aktivitätsprotokoll",
    search: "Suchen",
    refresh: "Aktualisieren",
    empty: "Keine Ergebnisse",
    failed: "Aktion fehlgeschlagen",
    noteRequired: "Gib einen Grund oder eine Notiz mit mindestens 5 Zeichen ein.",
    alreadyDecided: "Über diesen Antrag wurde bereits entschieden.",
    saved: "Entscheidung gespeichert",
    approve: "Genehmigen",
    reject: "Ablehnen",
    suspend: "Sperren",
    restore: "Entsperren",
    remove: "Rolle entfernen",
    email: "E-Mail",
    role: "Rolle",
    assign: "Zuweisen",
    note: "Grund oder Notiz",
    publish: "Veröffentlichen",
    hide: "Ausblenden",
    removeListing: "Entfernen",
    standard: "Standard",
    pro: "PRO",
    gold: "GOLD",
  },
  en: {
    users: "Users",
    listings: "Listings",
    reports: "Reports",
    support: "Support",
    tiers: "PRO/GOLD requests",
    staff: "Admin team",
    locations: "Location proposals",
    media: "Video review",
    audit: "Audit log",
    search: "Search",
    refresh: "Refresh",
    empty: "No results",
    failed: "Action failed",
    noteRequired: "Enter a reason or note of at least 5 characters.",
    alreadyDecided: "This request was already decided.",
    saved: "Decision saved",
    approve: "Approve",
    reject: "Reject",
    suspend: "Suspend",
    restore: "Restore",
    remove: "Remove role",
    email: "Email",
    role: "Role",
    assign: "Assign",
    note: "Reason or note",
    publish: "Publish",
    hide: "Hide",
    removeListing: "Remove",
    standard: "Standard",
    pro: "PRO",
    gold: "GOLD",
  },
} as const;

const value = (row: AdminRow, ...keys: string[]) =>
  keys.map((key) => row[key]).find((item) => item != null && item !== "");
const short = (item: unknown) => {
  if (item == null) return "";
  if (typeof item === "object") return JSON.stringify(item);
  return String(item);
};

export function AdminOperations({
  lang,
  owner,
  permissions,
  selectedSection,
  onSectionChange,
}: {
  lang: Locale;
  owner: boolean;
  permissions: Record<string, boolean>;
  selectedSection?: AdminSection;
  onSectionChange?: (section: AdminSection) => void;
}) {
  const t = labels[lang];
  const available = useMemo(
    () =>
      (
        [
          "users",
          "listings",
          "reports",
          "support",
          "tiers",
          "staff",
          "locations",
          "media",
          "audit",
        ] as AdminSection[]
      ).filter((key) => owner || permissions[key] === true),
    [owner, permissions],
  );
  const [section, setSection] = useState<AdminSection>(
    selectedSection ?? available[0] ?? "listings",
  );
  const [items, setItems] = useState<AdminRow[]>([]);
  const [roles, setRoles] = useState<AdminRow[]>([]);
  const [query, setQuery] = useState("");
  const [page,setPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const loadGeneration=useRef(0);
  const paginated=['listings','support','tiers'].includes(section);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState('');
  const [thread, setThread] = useState('');
  useEffect(()=>{
    const request=new URLSearchParams(window.location.search).get('request');
    if(request && /^[0-9a-f-]{36}$/i.test(request)) {setThread(request);setQuery(request);}
  },[]);

  const load = useCallback(async () => {
    if (!available.includes(section)) return;
    const generation=++loadGeneration.current;
    setBusy(true);
    setNotice("");
    try {
      const result =
        section === "users"
          ? await adminUsers(query)
          : section === "listings"
            ? await adminListings(query,page)
            : section === "reports"
              ? await safetyReports("open")
              : section === "support"
                ? await adminRequests("support_requests",page,query)
                : section === "tiers"
                  ? await adminRequests("promotion_requests",page)
                  : section === "staff"
                    ? await staffAccounts()
                    : section === "locations"
                      ? await locationProposals()
                      : section === "media"
                        ? await pendingVideos()
                        : await auditLog(query);
      if(generation!==loadGeneration.current)return;
      setHasMore(paginated && result.length>ADMIN_PAGE_SIZE);
      setItems(paginated?result.slice(0,ADMIN_PAGE_SIZE):result);
      if (section === "staff") {
        const nextRoles = await staffRoles();
        if(generation!==loadGeneration.current)return;
        setRoles(nextRoles);
        if (nextRoles[0])
          setStaffRole(
            (current) => current || String(nextRoles[0].role_key ?? ""),
          );
      }
      return true;
    } catch (error) {
      if(generation!==loadGeneration.current)return;
      console.error("ADMIN LOAD FAILED", error);
      setNotice(t.failed);
      setItems([]);
      setHasMore(false);
      return false;
    } finally {
      if(generation===loadGeneration.current)setBusy(false);
    }
  }, [query, section, t.failed, available, page, paginated]);

  useEffect(()=>{setPage(0);},[query,section]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedSection && available.includes(selectedSection))
      setSection(selectedSection);
  }, [available, selectedSection]);

  const roleWarning = ({ar:'هذا الإجراء يستبدل جميع تعيينات الموظف الحالية بالدور المختار دون نطاق جغرافي. هل تؤكد؟',ku:'Ev çalakî hemû erkên heyî diguherîne û erka hilbijartî bê sînorê herêmê dide. Piştrast dike?',de:'Alle bisherigen Rollenzuweisungen werden durch die gewählte Rolle ohne Gebietsbeschränkung ersetzt. Bestätigen?',en:'This replaces all current assignments with the selected role without a geographic restriction. Confirm?'})[lang];
  const act = async (action: () => Promise<void>, confirmation=adminText('confirm',lang)) => {
    if (busy || !window.confirm(confirmation)) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
      const refreshed=await load();
      setNotice(refreshed?t.saved:adminText("refreshFailed",lang));
    } catch (error) {
      console.error("ADMIN ACTION FAILED", error);
      const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error);
      setNotice(
        message.includes("decision_note_required")
          ? t.noteRequired
          : message.includes("promotion_request_already_decided")
            ? t.alreadyDecided
            : t.failed,
      );
    } finally {
      setBusy(false);
    }
  };

  const reason = () => note.trim() || window.prompt(t.note)?.trim() || "";
  const primary = (row: AdminRow) =>
    short(
      value(
        row,
        "display_name",
        "title",
        "subject",
        "proposed_name",
        "email",
        "reason_key",
        "action",
        "id",
      ),
    );
  const secondary = (row: AdminRow) =>
    [
      value(
        row,
        "email",
        "contact_email",
        "target_type",
        "category",
        "state",
        "role",
        "requested_tier",
      ),
      value(row, "phone", "contact_phone", "target_id", "created_at"),
    ]
      .map(short)
      .filter(Boolean)
      .join(" · ");

  return (
    <section className="space-y-4 rounded-[24px] bg-white p-3 shadow-sm sm:p-5">
      {preview && <ListingPreview id={preview} lang={lang} close={()=>setPreview('')} />}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {available.map((key) => (
          <button
            key={key}
            onClick={() => {
              setSection(key);
              onSectionChange?.(key);
              setQuery("");
              setNotice("");
            }}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ${section === key ? "bg-rojRed text-white" : "bg-rojWarmBg"}`}
          >
            {t[key]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {(section === "users" || section === "audit" || section === 'listings' || section === 'support') && (
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
              placeholder={section === 'listings' ? adminText('searchListing',lang) : t.search}
              className="h-11 w-full rounded-xl border ps-10 pe-3"
            />
          </div>
        )}
        <button
          onClick={() => void load()}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border px-4 font-black"
        >
          <RefreshCw className="h-4 w-4" />
          {t.refresh}
        </button>
      </div>
      {section === "staff" && (
        <div className="grid gap-2 rounded-2xl bg-rojWarmBg p-3 md:grid-cols-4">
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 md:col-span-4">{roleWarning}</p>
          <input
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
            placeholder={t.email}
            className="rounded-xl border p-3"
            dir="ltr"
          />
          <select
            value={staffRole}
            onChange={(e) => setStaffRole(e.target.value)}
            className="rounded-xl border p-3"
          >
            {roles.map((role) => (
              <option key={String(role.role_key)} value={String(role.role_key)}>
                {short(
                  (role.names as Record<string, unknown> | undefined)?.[lang] ??
                    role.role_key,
                )}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.note}
            className="rounded-xl border p-3"
          />
          <button
            disabled={!staffEmail || !staffRole || busy}
            onClick={() =>
              void act(() => assignStaff(staffEmail, staffRole, note), `${staffEmail}\n${roleWarning}`)
            }
            className="rounded-xl bg-rojNavy p-3 font-black text-white disabled:opacity-50"
          >
            {t.assign}
          </button>
        </div>
      )}
      {notice && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold">{notice}</p>
      )}
      {busy && items.length === 0 ? (
        <Loader2 className="mx-auto my-12 animate-spin text-rojRed" />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-gray-500">{t.empty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((row, index) => {
            const id = short(row.id);
            const email = short(row.email);
            const suspended = row.is_suspended === true;
            const requestState = short(row.state);
            const requestOpen =
              requestState === "pending" || requestState === "contacted";
            return (
              <article
                key={id || index}
                className="min-w-0 rounded-2xl border p-4"
              >
                <strong className="block break-words text-rojNavy">
                  {section === 'audit' ? adminText(short(row.action),lang) : primary(row)}
                </strong>
                <p className="mt-1 break-words text-xs text-gray-500">
                  {section === 'listings' ? `${adminText(short(row.category),lang)} · ${adminText(short(row.state),lang)} · ${displayDate(row.created_at)}` : section === 'audit' ? `${short(row.actor_name || row.actor_email)} · ${displayDate(row.created_at)}` : secondary(row)}
                </p>
                {section === 'listings' && <p className="mt-2 break-all text-xs"><span dir="ltr">{short(row.public_code || row.id)}</span> · {short((row.owner as AdminRow | null)?.display_name || (row.owner as AdminRow | null)?.business_name)}</p>}
                {section === 'audit' && <p className="mt-2 break-all text-xs">{adminText('target',lang)}: {short(row.target_id)}</p>}
                {row.message != null && (
                  <p className="mt-2 text-sm">{short(row.message)}</p>
                )}
                {row.details != null && (
                  <p className="mt-2 break-words text-sm">{section === 'audit' ? auditDetails(row.details,lang) : short(row.details)}</p>
                )}
                {section === 'support' && <><button className="mt-3 rounded-xl border px-3 py-2" onClick={()=>setThread(thread===id?'':id)}>{adminText('reply',lang)}</button>{thread===id && <SupportThread requestId={id} lang={lang}/>}</>}
                {section === 'users' && <AdminMessageComposer userId={id} lang={lang}/>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {section === 'listings' && <button onClick={()=>setPreview(id)} className="rounded-lg bg-rojNavy px-3 py-2 text-sm text-white">{adminText('openListing',lang)}</button>}
                  {section === "users" && (
                    <>
                      <button
                        onClick={() =>
                          void act(() =>
                            suspendAccount(id, !suspended, reason()),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {suspended ? t.restore : t.suspend}
                      </button>
                      {(["standard", "pro", "gold"] as const).map((tier) => (
                        <button
                          key={tier}
                          onClick={() =>
                            void act(() => setAccountTier(email, tier))
                          }
                          className="rounded-lg border px-3 py-1.5 text-xs font-black"
                        >
                          {t[tier]}
                        </button>
                      ))}
                    </>
                  )}
                  {section === "listings" && (
                    <>
                      <button
                        onClick={() =>
                          void act(() => moderateListing(id, "published", note))
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.publish}
                      </button>
                      <button
                        onClick={() =>
                          void act(() =>
                            moderateListing(id, "hidden", reason()),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.hide}
                      </button>
                      <button
                        onClick={() =>
                          void act(() =>
                            moderateListing(id, "removed", reason()),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black text-red-700"
                      >
                        {t.removeListing}
                      </button>
                    </>
                  )}
                  {section === "reports" && (
                    <>
                      <button
                        onClick={() =>
                          void act(() =>
                            resolveSafetyReport(id, "resolved", reason()),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.approve}
                      </button>
                      <button
                        onClick={() =>
                          void act(() =>
                            resolveSafetyReport(id, "dismissed", reason()),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.reject}
                      </button>
                    </>
                  )}
                  {(section === "support" || section === "tiers") &&
                    (section === "support" || requestOpen) && (
                    <>
                      <button
                        onClick={() =>
                          void act(() =>
                            updateRequest(
                              section === "support"
                                ? "support_requests"
                                : "promotion_requests",
                              id,
                              section === "tiers" ? "approved" : "resolved",
                              reason(),
                            ),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.approve}
                      </button>
                      <button
                        onClick={() =>
                          void act(() =>
                            updateRequest(
                              section === "support"
                                ? "support_requests"
                                : "promotion_requests",
                              id,
                              section === 'support' ? 'closed' : 'rejected',
                              reason(),
                            ),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.reject}
                      </button>
                    </>
                  )}
                  {section === "staff" && row.assignment_id != null && (
                    <button
                      onClick={() =>
                        void act(() =>
                          removeStaff(String(row.assignment_id), reason()),
                        )
                      }
                      className="rounded-lg border px-3 py-1.5 text-xs font-black text-red-700"
                    >
                      {t.remove}
                    </button>
                  )}
                  {section === "locations" && (
                    <>
                      <button
                        onClick={() =>
                          void act(() => reviewLocation(id, true, note))
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.approve}
                      </button>
                      <button
                        onClick={() =>
                          void act(() => reviewLocation(id, false, reason()))
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.reject}
                      </button>
                    </>
                  )}
                  {section === "media" && (
                    <>
                      <button
                        onClick={() =>
                          void act(() =>
                            reviewVideo(String(row.listing_id), true, note),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.approve}
                      </button>
                      <button
                        onClick={() =>
                          void act(() =>
                            reviewVideo(
                              String(row.listing_id),
                              false,
                              reason(),
                            ),
                          )
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      >
                        {t.reject}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {paginated && <nav aria-label="Pagination" className="flex items-center justify-center gap-4"><button disabled={busy||page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} className="rounded-xl border px-4 py-2 disabled:opacity-40">{({ar:'السابق',ku:'Berê',de:'Zurück',en:'Previous'})[lang]}</button><span>{page+1}</span><button disabled={busy||!hasMore} onClick={()=>setPage(p=>p+1)} className="rounded-xl border px-4 py-2 disabled:opacity-40">{({ar:'التالي',ku:'Pêş',de:'Weiter',en:'Next'})[lang]}</button></nav>}
    </section>
  );
}
