"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n-config";

import {authFeedback} from "@/lib/auth-feedback";
import { authReturnPath } from "@/lib/auth-return";

type Mode = "login" | "signup" | "forgot";
const copy = {
  ar: {
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    forgot: "نسيت كلمة المرور؟",
    name: "الاسم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    min: "8 أحرف على الأقل",
    submitLogin: "دخول",
    submitSignup: "إنشاء الحساب",
    submitReset: "إرسال رابط الاستعادة",
    google: "المتابعة باستخدام Google",
    or: "أو",
    noAccount: "ليس لديك حساب؟",
    hasAccount: "لديك حساب؟",
    back: "العودة لتسجيل الدخول",
    confirm: "تم إنشاء الحساب. افتح بريدك الإلكتروني لتأكيده.",
    resetSent: "تم إرسال رابط استعادة كلمة المرور إلى بريدك.",
    generic: "تعذر إكمال العملية. تحقق من البيانات وحاول مجدداً.",
  },
  ku: {
    login: "Têketin",
    signup: "Hesab biafirîne",
    forgot: "Şîfre ji bîr kir?",
    name: "Nav",
    email: "E-name",
    password: "Şîfre",
    min: "Herî kêm 8 tîp",
    submitLogin: "Têkeve",
    submitSignup: "Hesab biafirîne",
    submitReset: "Girêdana vegerandinê bişîne",
    google: "Bi Google bidomîne",
    or: "an",
    noAccount: "Hesabê te tune?",
    hasAccount: "Hesabê te heye?",
    back: "Vegere têketinê",
    confirm: "Hesab hate afirandin. E-nameya xwe ji bo piştrastkirinê veke.",
    resetSent: "Girêdana nûkirina şîfreyê hat şandin.",
    generic: "Çalakî bi ser neket. Agahiyan kontrol bike.",
  },
  de: {
    login: "Anmelden",
    signup: "Konto erstellen",
    forgot: "Passwort vergessen?",
    name: "Name",
    email: "E-Mail",
    password: "Passwort",
    min: "Mindestens 8 Zeichen",
    submitLogin: "Anmelden",
    submitSignup: "Konto erstellen",
    submitReset: "Wiederherstellungslink senden",
    google: "Mit Google fortfahren",
    or: "oder",
    noAccount: "Noch kein Konto?",
    hasAccount: "Bereits registriert?",
    back: "Zurück zur Anmeldung",
    confirm: "Konto erstellt. Bitte bestätige deine E-Mail-Adresse.",
    resetSent: "Der Link zum Zurücksetzen wurde per E-Mail gesendet.",
    generic: "Vorgang fehlgeschlagen. Bitte Angaben prüfen.",
  },
  en: {
    login: "Sign in",
    signup: "Create account",
    forgot: "Forgot password?",
    name: "Name",
    email: "Email",
    password: "Password",
    min: "At least 8 characters",
    submitLogin: "Sign in",
    submitSignup: "Create account",
    submitReset: "Send recovery link",
    google: "Continue with Google",
    or: "or",
    noAccount: "No account yet?",
    hasAccount: "Already registered?",
    back: "Back to sign in",
    confirm: "Account created. Open your email to confirm it.",
    resetSent: "A password recovery link was sent to your email.",
    generic: "The operation failed. Check your details and try again.",
  },
} as const;

export function AuthForm({ lang, nextPath }: { lang: Locale; nextPath?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const text = copy[lang];
  const destination = authReturnPath(lang, nextPath);
  useEffect(() => {
    if (!nextPath) return;
    let active = true;
    void supabase.auth.getSession().then(({data, error}) => {
      if (active && !error && data.session) router.replace(destination);
    }).catch(() => { /* Keep the login form available on a network failure. */ });
    return () => { active = false; };
  }, [destination, nextPath, router]);

  async function googleLogin() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${destination}`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (authError) throw authError;
    } catch (problem) {
      setError(authFeedback(problem,lang));
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (authError) throw authError;
        router.replace(destination);
        router.refresh();
      } else if (mode === "signup") {
        if (password.length < 8 || name.trim().length < 2)
          throw new Error(text.generic);
        const redirect = nextPath ? `${window.location.origin}${destination}` : `${window.location.origin}/${lang}/auth`;
        const { data, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: redirect,
            data: { display_name: name.trim(), full_name: name.trim() },
          },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace(destination);
          router.refresh();
        } else setMessage(text.confirm);
      } else {
        const redirectTo = `${window.location.origin}/${lang}/auth/reset`;
        const { error: authError } = await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          { redirectTo },
        );
        if (authError) throw authError;
        setMessage(text.resetSent);
      }
    } catch (problem) {
      setError(authFeedback(problem,lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/[0.05] sm:p-7">
      <div className="mb-6 flex rounded-2xl bg-rojWarmBg p-1">
        {(["login", "signup"] as Mode[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              setError("");
              setMessage("");
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-black ${mode === item ? "bg-white text-rojRed shadow-sm" : "text-gray-500"}`}
          >
            {item === "login" ? text.login : text.signup}
          </button>
        ))}
      </div>
      <h1 className="mb-5 text-center text-xl font-black text-rojNavy">
        {mode === "login"
          ? text.login
          : mode === "signup"
            ? text.signup
            : text.forgot}
      </h1>
      {mode !== "forgot" && (
        <>
          <button
            type="button"
            onClick={() => void googleLogin()}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white font-black text-rojNavy transition hover:bg-gray-50 disabled:opacity-60"
          >
            <span className="text-lg font-black text-[#4285F4]">G</span>
            {text.google}
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            <span>{text.or}</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>
        </>
      )}
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold">{text.name}</span>
            <div className="relative">
              <UserRound className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                autoComplete="name"
                className="h-12 w-full rounded-2xl border border-gray-200 bg-white ps-10 pe-3 outline-none focus:border-rojRed"
              />
            </div>
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold">{text.email}</span>
          <div className="relative">
            <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white ps-10 pe-3 text-start outline-none focus:border-rojRed"
            />
          </div>
        </label>
        {mode !== "forgot" && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold">
              {text.password}
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                dir="ltr"
                className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-3 pe-11 text-start outline-none focus:border-rojRed"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {mode === "signup" && (
              <span className="mt-1 block text-[11px] text-gray-400">
                {text.min}
              </span>
            )}
          </label>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        )}
        <button
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rojRed font-black text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "login"
            ? text.submitLogin
            : mode === "signup"
              ? text.submitSignup
              : text.submitReset}
        </button>
      </form>
      <div className="mt-5 text-center text-xs font-bold">
        {mode === "login" ? (
          <>
            <button onClick={() => setMode("forgot")} className="text-rojRed">
              {text.forgot}
            </button>
            <div className="mt-3 text-gray-500">
              {text.noAccount}{" "}
              <button onClick={() => setMode("signup")} className="text-rojRed">
                {text.signup}
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => setMode("login")} className="text-rojRed">
            {mode === "signup" ? text.hasAccount : text.back}
          </button>
        )}
      </div>
    </div>
  );
}
