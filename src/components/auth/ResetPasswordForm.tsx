"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n-config";

const copy = {
  ar: { title: "تعيين كلمة مرور جديدة", password: "كلمة المرور الجديدة", confirm: "تأكيد كلمة المرور", save: "حفظ كلمة المرور", mismatch: "كلمتا المرور غير متطابقتين.", short: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.", success: "تم تغيير كلمة المرور بنجاح.", invalid: "رابط الاستعادة غير صالح أو انتهت صلاحيته.", login: "تسجيل الدخول" },
  ku: { title: "Şîfreyeke nû saz bike", password: "Şîfreya nû", confirm: "Şîfreyê piştrast bike", save: "Şîfreyê tomar bike", mismatch: "Şîfre ne wek hev in.", short: "Şîfre divê herî kêm 8 tîp be.", success: "Şîfre bi serkeftî hat guhertin.", invalid: "Girêdan nederbasdar e an dema wê qediya.", login: "Têketin" },
  de: { title: "Neues Passwort festlegen", password: "Neues Passwort", confirm: "Passwort bestätigen", save: "Passwort speichern", mismatch: "Die Passwörter stimmen nicht überein.", short: "Das Passwort muss mindestens 8 Zeichen haben.", success: "Passwort erfolgreich geändert.", invalid: "Der Link ist ungültig oder abgelaufen.", login: "Anmelden" },
  en: { title: "Set a new password", password: "New password", confirm: "Confirm password", save: "Save password", mismatch: "Passwords do not match.", short: "Password must contain at least 8 characters.", success: "Password changed successfully.", invalid: "The recovery link is invalid or expired.", login: "Sign in" },
} as const;

export function ResetPasswordForm({ lang }: { lang: Locale }) {
  const text = copy[lang]; const [ready, setReady] = useState(false); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(false);
  const sending=useRef(false);const [checking,setChecking]=useState(true);
  useEffect(() => {
    let active=true;
    void supabase.auth.getSession().then(({data,error})=>{if(active){setReady(!error&&Boolean(data.session));setChecking(false);}}).catch(()=>{if(active){setReady(false);setChecking(false);}});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{if(active){setReady(Boolean(session));setChecking(false);}});
    return()=>{active=false;data.subscription.unsubscribe();};
  },[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(sending.current||!ready)return;setError('');
    if(password.length<8)return setError(text.short);if(password!==confirm)return setError(text.mismatch);
    sending.current=true;setBusy(true);
    try{const result=await supabase.auth.updateUser({password});if(result.error)throw result.error;setSuccess(true);setPassword('');setConfirm('');}
    catch{setError(({ar:'تعذر تغيير كلمة المرور. جرّب رابط استعادة جديداً أو تواصل مع الدعم.',ku:'Şîfre nehat guhertin. Girêdaneke nû biceribîne an bi piştgiriyê re têkilî dayne.',de:'Passwort konnte nicht geändert werden. Fordere einen neuen Link an oder kontaktiere den Support.',en:'Could not change the password. Request a new link or contact support.'})[lang]);}
    finally{sending.current=false;setBusy(false);}
  }
  if(checking)return <div role="status" className="p-8 text-center"><Loader2 className="mx-auto animate-spin"/></div>;
  return <div className="mx-auto max-w-md rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-black/[0.05]"><h1 className="mb-5 text-center text-xl font-black">{text.title}</h1>{success ? <div className="space-y-4 text-center"><p className="rounded-xl bg-emerald-50 p-3 text-emerald-700">{text.success}</p><Link href={`/${lang}/auth`} className="inline-block font-bold text-rojRed">{text.login}</Link></div> : !ready ? <p className="rounded-xl bg-red-50 p-3 text-center text-red-700">{text.invalid}</p> : <form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold">{text.password}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required dir="ltr" className="mt-1.5 h-12 w-full rounded-2xl border border-gray-200 px-3 outline-none focus:border-rojRed" /></label><label className="block text-xs font-bold">{text.confirm}<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required dir="ltr" className="mt-1.5 h-12 w-full rounded-2xl border border-gray-200 px-3 outline-none focus:border-rojRed" /></label>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rojRed font-black text-white">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{text.save}</button></form>}</div>;
}
