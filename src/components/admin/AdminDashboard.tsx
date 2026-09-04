"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ShieldCheck,
  Users,
  FileText,
  Flag,
  MapPin,
  Video,
  Headphones,
  BadgeDollarSign,
  ScrollText,
} from "lucide-react";
import { adminAccess } from "@/services/web-features";
import type { Locale } from "@/lib/i18n-config";
import { AdminContentTools } from "@/components/admin/AdminContentTools";
import { AdminLegalPages } from "@/components/admin/AdminLegalPages";
import {
  AdminOperations,
  type AdminSection,
} from "@/components/admin/AdminOperations";

import {AdminCatalog} from "./AdminCatalog";
import {AdminMarkets} from './AdminMarkets';
import {AdminScopedAssignment} from './AdminScopedAssignment';
import {AdminTextOverrides} from "./AdminTextOverrides";
import {AdminSharedLegal} from "./AdminSharedLegal";
import {StaffRoleGuide} from "./StaffRoleGuide";
import {StaffScopeDetails} from "./StaffScopeDetails";
import {useAccount} from "@/components/account/useAccount";
import {AccountState} from "@/components/account/AccountState";
const copy = {
  ar: {
    title: "لوحة الإدارة",
    denied: "لا تملك صلاحية الدخول إلى الإدارة.",
    login: "يجب تسجيل الدخول أولاً.",
    owner: "مالك المنصة",
    role: "الدور",
    listings: "الإعلانات",
    reports: "البلاغات",
    locations: "المواقع",
    users: "المستخدمون",
    media: "مراجعة الفيديو",
    staff: "فريق الإدارة",
    support: "الدعم",
    tiers: "PRO وGOLD",
    audit: "سجل العمليات",
    note: "تظهر فقط الأقسام التي منحها لك مالك المنصة.",
  },
  ku: {
    title: "Rêveberî",
    denied: "Destûra rêveberiyê tune ye.",
    login: "Pêşî têkeve.",
    owner: "Xwediyê platformê",
    role: "Rol",
    listings: "Îlan",
    reports: "Rapor",
    locations: "Cih",
    users: "Bikarhêner",
    media: "Vîdyo",
    staff: "Tîm",
    support: "Alîkarî",
    tiers: "PRO û GOLD",
    audit: "Tomar",
    note: "Tenê beşên destûrdayî tên nîşandan.",
  },
  de: {
    title: "Verwaltung",
    denied: "Du hast keine Verwaltungsberechtigung.",
    login: "Bitte zuerst anmelden.",
    owner: "Plattforminhaber",
    role: "Rolle",
    listings: "Anzeigen",
    reports: "Meldungen",
    locations: "Orte",
    users: "Benutzer",
    media: "Videoprüfung",
    staff: "Verwaltungsteam",
    support: "Support",
    tiers: "PRO und GOLD",
    audit: "Protokoll",
    note: "Es werden nur deine freigegebenen Bereiche angezeigt.",
  },
  en: {
    title: "Administration",
    denied: "You do not have administrative access.",
    login: "Sign in first.",
    owner: "Platform owner",
    role: "Role",
    listings: "Listings",
    reports: "Reports",
    locations: "Locations",
    users: "Users",
    media: "Video review",
    staff: "Admin team",
    support: "Support",
    tiers: "PRO and GOLD",
    audit: "Audit log",
    note: "Only areas granted to you are shown.",
  },
} as const;
const sections = [
  { key: "listings", icon: FileText },
  { key: "reports", icon: Flag },
  { key: "locations", icon: MapPin },
  { key: "users", icon: Users },
  { key: "media", icon: Video },
  { key: "staff", icon: ShieldCheck },
  { key: "support", icon: Headphones },
  { key: "tiers", icon: BadgeDollarSign },
  { key: "audit", icon: ScrollText },
] as const;
export function AdminDashboard({lang}:{lang:Locale}){const auth=useAccount();if(auth.loading||auth.error||!auth.user)return <AccountState lang={lang} loading={auth.loading} error={auth.error} retry={auth.retry}/>;return <Dashboard key={auth.user.id} lang={lang}/>;}
function Dashboard({ lang }: { lang: Locale }) {
  const t = copy[lang],
    [state, setState] = useState<Awaited<
      ReturnType<typeof adminAccess>
    > | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [activeSection, setActiveSection] = useState<AdminSection>("listings");
  useEffect(() => {
    const requested=new URLSearchParams(window.location.search).get('section');
    if (sections.some(s=>s.key===requested)) setActiveSection(requested as AdminSection);
    let live=true;
    const refresh=()=>{void adminAccess().then(v=>{if(live){setState(v);setError(false);}}).catch(()=>{if(live){setState(null);setError(true);}}).finally(()=>{if(live)setLoading(false);});};
    refresh();window.addEventListener("focus",refresh);
    return()=>{live=false;window.removeEventListener("focus",refresh);};
  }, []);
  useEffect(() => {
    if (!state?.allowed) return;
    const allowed = sections
      .map((item) => item.key)
      .filter((key) => state.owner || state.permissions[key]);
    if (!allowed.includes(activeSection) && allowed[0])
      setActiveSection(allowed[0]);
  }, [activeSection, state]);
  if (loading)
    return <Loader2 className="mx-auto my-20 animate-spin text-rojRed" />;
  if(error)return <AccountState lang={lang} error retry={()=>window.location.reload()}/>;
  if (!state?.allowed)
    return (
      <div className="rounded-2xl bg-white p-8 text-center font-bold text-red-700">
        {t.denied}
      </div>
    );
  const canBroadcast =
    state.owner || state.permissions.platform_content === true;
  const canContent =
    state.owner ||
    state.permissions.platform_content === true ||
    state.permissions["platform_content.manage"] === true;
  return (
    <section className="space-y-5">
      <div className="rounded-[24px] bg-rojNavy p-6 text-white">
        <h1 className="text-2xl font-black">{t.title}</h1>
        <p className="mt-2 text-sm opacity-80">
          {t.note}
        </p>
        <p className="mt-1 text-xs opacity-60">{t.note}</p>
      </div>
      <StaffRoleGuide lang={lang} owner={state.owner} permissions={state.permissions}/>
      <StaffScopeDetails lang={lang}/>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {sections
          .filter((s) => state.owner || state.permissions[s.key])
          .map(({ key, icon: Icon }) => (
            <button
              type="button"
              key={key}
              onClick={() => {
                setActiveSection(key);
                document
                  .getElementById("admin-operations")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`rounded-2xl p-5 text-start shadow-sm transition ${
                activeSection === key
                  ? "bg-rojRed text-white"
                  : "bg-white hover:-translate-y-0.5"
              }`}
            >
              <Icon
                className={`mb-3 h-7 w-7 ${activeSection === key ? "text-white" : "text-rojRed"}`}
              />
              <strong>{t[key]}</strong>
            </button>
          ))}
      </div>
      <div id="admin-operations" className="scroll-mt-36">
        <AdminOperations
          lang={lang}
          owner={state.owner}
          permissions={state.permissions}
          selectedSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>
      <AdminContentTools
        lang={lang}
        canBroadcast={canBroadcast}
        canContent={canContent}
      />
      {(state.owner||state.permissions.catalog)&&<AdminCatalog lang={lang}/>}
      {(state.owner||state.permissions.markets===true)&&<AdminMarkets lang={lang}/>}
      {(state.owner||state.permissions.staff===true)&&<AdminScopedAssignment lang={lang}/>}
      {(state.owner||state.permissions.legal)&&<AdminSharedLegal lang={lang}/>}
      {canContent&&<AdminTextOverrides lang={lang}/>}
      {canContent && <AdminLegalPages lang={lang} />}
    </section>
  );
}
