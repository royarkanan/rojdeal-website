"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { unreadNotificationCount } from "@/services/platform-content";
import type { Locale } from "@/lib/i18n-config";
export function NotificationBell({ lang }: {
    lang: Locale;
}) {
  const [count,setCount] = useState(0);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{void unreadNotificationCount().then(n=>{if(active)setCount(n);}).catch(()=>{});};
    refresh();
    const interval=window.setInterval(refresh,30000);
    const {data}=supabase.auth.onAuthStateChange(()=>{window.setTimeout(()=>{if(active)refresh();},0);});
    window.addEventListener('focus',refresh);
    window.addEventListener('rojdeal:notifications-read',refresh);
    return ()=>{active=false;window.clearInterval(interval);data.subscription.unsubscribe();window.removeEventListener('focus',refresh);window.removeEventListener('rojdeal:notifications-read',refresh);};
  },[]);
  const label={ar:'الإشعارات',ku:'Agahdarî',de:'Benachrichtigungen',en:'Notifications'}[lang];
  return <Link href={`/${lang}/notifications`} aria-label={`${label}: ${count}`} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-rojNavy/10 bg-white"><Bell className="h-5 w-5 text-rojNavy"/>{count>0&&<span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-rojRed px-1 text-center text-[10px] font-black leading-5 text-white">{count>99?'99+':count}</span>}</Link>;
}
