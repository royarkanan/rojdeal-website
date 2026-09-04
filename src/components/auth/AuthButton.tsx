"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n-config";

const labels = { ar: "دخول", ku: "Têkeve", de: "Anmelden", en: "Sign in" } as const;

export function AuthButton({ lang }: { lang: Locale }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <Link href={signedIn ? `/${lang}/account` : `/${lang}/auth`} className="flex h-9 items-center gap-1.5 rounded-xl border border-rojNavy/10 bg-white px-2.5 text-xs font-extrabold text-rojNavy">
      {signedIn ? <UserRound className="h-4 w-4 text-rojRed" /> : <LogIn className="h-4 w-4 text-rojRed" />}
      <span className="hidden sm:inline">{signedIn ? (lang === "ar" ? "حسابي" : lang === "ku" ? "Hesab" : lang === "de" ? "Konto" : "Account") : labels[lang]}</span>
    </Link>
  );
}
