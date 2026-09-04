"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n-config";
import { deletionError, requiresOwnerReview } from '@/lib/account-deletion';
import { contactConfig } from '@/lib/contact-config';
const copy = {
  ar: {
    title: "حذف الحساب والبيانات",
    info: "يمكنك إرسال طلب حذف حسابك وبياناتك. تسجيل الطلب لا يعني اكتمال الحذف؛ تظهر حالة الطلب أدناه. تواصل مع الدعم لمعرفة حالة المعالجة أو البيانات التي يلزم الاحتفاظ بها.",
    login: "يجب تسجيل الدخول من الحساب الذي تريد حذفه.",
    reason: "سبب اختياري",
    request: "طلب حذف الحساب",
    cancel: "إلغاء طلب الحذف",
    pending: "طلب الحذف فعال ويمكن إلغاؤه خلال المهلة.",
    sent: "تم تسجيل طلب حذف الحساب.",
    done: "تم إلغاء طلب الحذف.",
    error: "تعذر تنفيذ الطلب.",
  },
  ku: {
    title: "Jêbirina hesab û daneyan",
    info: "Tu dikarî jêbirina hesab û daneyan bixwazî. Tomarkirina daxwazê nayê wê wateyê ku jêbirin qediya. Ji bo agahiyan bi piştgiriyê re têkilî dayne.",
    login: "Bi hesaba ku dixwazî jê bibî têkeve.",
    reason: "Sedema vebijarkî",
    request: "Jêbirinê bixwaze",
    cancel: "Daxwazê betal bike",
    pending: "Daxwaz çalak e.",
    sent: "Daxwaz hat tomarkirin.",
    done: "Daxwaz hat betalkirin.",
    error: "Çalakî bi ser neket.",
  },
  de: {
    title: "Konto und Daten löschen",
    info: "Hier kannst du die Löschung deines Kontos und deiner Daten beantragen. Ein erfasster Antrag bedeutet noch keine abgeschlossene Löschung. Zum Bearbeitungsstand und zu erforderlichen Aufbewahrungen kontaktiere bitte den Support.",
    login: "Melde dich mit dem zu löschenden Konto an.",
    reason: "Optionaler Grund",
    request: "Kontolöschung beantragen",
    cancel: "Löschantrag widerrufen",
    pending:
      "Der Löschantrag ist aktiv und kann in der Frist widerrufen werden.",
    sent: "Löschantrag wurde erfasst.",
    done: "Löschantrag wurde widerrufen.",
    error: "Aktion fehlgeschlagen.",
  },
  en: {
    title: "Delete account and data",
    info: "You can request deletion of your account and data here. A recorded request does not mean deletion is complete. Contact support about processing status and any required data retention.",
    login: "Sign in with the account you want to delete.",
    reason: "Optional reason",
    request: "Request account deletion",
    cancel: "Cancel deletion request",
    pending:
      "The deletion request is active and can be cancelled during the grace period.",
    sent: "Deletion request recorded.",
    done: "Deletion request cancelled.",
    error: "The action failed.",
  },
} as const;
export function AccountDeletionPanel({ lang, showTitle = true }: { lang: Locale; showTitle?: boolean }) {
  const t = copy[lang],
    [logged, setLogged] = useState<boolean | null>(null),
    [pending, setPending] = useState(false),
    [reason, setReason] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting=useRef(false);
  const [ownerReview,setOwnerReview]=useState(false);
  const [loaded,setLoaded]=useState(false);
  useEffect(() => {
    let active=true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if(!active)return;
      setLogged(Boolean(data.user));
      if (data.user) {
        const result = await supabase.rpc("get_my_account_deletion_request");
        if(!active)return;
        if(result.error){setNotice(t.error);return;}
        setPending(
          Boolean(
            result.data &&
            (Array.isArray(result.data) ? result.data.length : result.data),
          ),
        );
      }
      setLoaded(true);
    }).catch(()=>{if(active)setNotice(t.error);});
    return()=>{active=false;};
  }, [t.error]);
  const run = async (cancel: boolean) => {
    if(submitting.current || !loaded)return;
    if(!window.confirm(cancel?t.cancel:t.request))return;
    submitting.current=true;
    setBusy(true);
    setNotice("");
    try {
    const result = cancel
      ? await supabase.rpc("cancel_own_account_deletion")
      : await supabase.rpc("request_own_account_deletion", {
          deletion_reason: reason.trim() || null,
        });
    if (result.error) {setOwnerReview(requiresOwnerReview(result.error));setNotice(deletionError(result.error,lang,t.error));}
    else {
      setPending(!cancel);
      setNotice(cancel ? t.done : t.sent);
    }
    } catch {setNotice(t.error);} finally {setBusy(false);submitting.current=false;}
  };
  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-[24px] bg-white p-6 shadow-sm">
      {showTitle&&<h1 className="text-2xl font-black">{t.title}</h1>}
      <p className="leading-7 text-gray-600">{t.info}</p>
      {logged === false ? (
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="font-bold">{t.login}</p>
          <Link
            href={`/${lang}/auth`}
            className="mt-3 inline-block rounded-xl bg-rojRed px-5 py-3 font-black text-white"
          >
            {({ar:'تسجيل الدخول',ku:'Têketin',de:'Anmelden',en:'Sign in'})[lang]}
          </Link>
        </div>
      ) : pending ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-amber-50 p-4 font-bold">{t.pending}</p>
          <button
            disabled={busy}
            onClick={() => void run(true)}
            className="w-full rounded-xl border border-rojRed py-3 font-black text-rojRed"
          >
            {t.cancel}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reason}
            maxLength={2000}
            className="min-h-28 w-full rounded-xl border p-3"
          />
          <button
            disabled={busy || logged !== true || !loaded}
            onClick={() => void run(false)}
            className="w-full rounded-xl bg-red-700 py-3 font-black text-white disabled:opacity-50"
          >
            {t.request}
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-rojWarmBg p-3 font-bold">{notice}</p>
      )}
      {ownerReview && <div className="flex flex-wrap gap-4"><Link className="underline" href={`/${lang}/contact`}>{({ar:'طلب مراجعة عبر الدعم',ku:'Piştgirî',de:'Support kontaktieren',en:'Contact support'})[lang]}</Link><a className="break-all underline" href={`mailto:${contactConfig.supportEmail}?subject=${encodeURIComponent('RojDeal — staff account deletion review')}`}>{contactConfig.supportEmail}</a></div>}
    </section>
  );
}
