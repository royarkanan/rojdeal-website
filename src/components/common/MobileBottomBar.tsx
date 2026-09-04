"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, PlusCircle, MessageSquare, User } from "lucide-react";

export const MobileBottomBar: React.FC<{ lang: string }> = ({ lang }) => {
  const pathname = usePathname();
  const labels =
    lang === "de"
      ? ["Start", "Favoriten", "Anzeige", "Nachrichten", "Konto"]
      : lang === "en"
        ? ["Home", "Favorites", "Add listing", "Messages", "Account"]
        : lang === "ku"
          ? ["Mal", "Bijare", "Îlan zêde bike", "Peyam", "Hesab"]
          : ["الرئيسية", "المفضلة", "أضف إعلاناً", "الرسائل", "حسابي"];

  const navItems = [
    { label: labels[0], icon: Home, href: "/" + lang },
    { label: labels[1], icon: Heart, href: "/" + lang + "/favorites" },
    {
      label: labels[2],
      icon: PlusCircle,
      href: "/" + lang + "/listings/new",
      highlight: true,
    },
    { label: labels[3], icon: MessageSquare, href: "/" + lang + "/messages" },
    { label: labels[4], icon: User, href: "/" + lang + "/account" },
  ];

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid min-h-[82px] grid-cols-5 items-center border-t border-gray-200 bg-white/95 px-1 shadow-lg backdrop-blur md:hidden">
      {navItems.map((item, idx) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (idx === 4 && pathname.startsWith(item.href + '/')) || (idx === 3 && pathname.startsWith(item.href + '/'));
        return (
          <Link
            key={idx}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition " +
              (isActive ? "text-rojRed font-black" : "text-gray-500")
            }
          >
            <Icon className="h-7 w-7" aria-hidden="true" />
            <span className="max-w-full truncate text-xs font-bold">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
