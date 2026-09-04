"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2, Megaphone } from "lucide-react";
import { notificationLink } from "@/lib/notification-link";
import {
  markNotificationsRead,
  userNotifications,
  type UserNotification,
} from "@/services/platform-content";
import type { Locale } from "@/lib/i18n-config";

const copy = {
  ar: {
    title: "الإشعارات",
    empty: "لا توجد إشعارات حتى الآن.",
    failed: "تعذر تحميل الإشعارات.",
    login: "سجّل الدخول لرؤية إشعاراتك.",
    reload: "إعادة المحاولة",
  },
  ku: {
    title: "Agahdarî",
    empty: "Hêj agahdarî tune.",
    failed: "Agahdarî nehatin barkirin.",
    login: "Ji bo dîtina agahdariyan têkeve.",
    reload: "Dîsa biceribîne",
  },
  de: {
    title: "Benachrichtigungen",
    empty: "Noch keine Benachrichtigungen.",
    failed: "Benachrichtigungen konnten nicht geladen werden.",
    login: "Melde dich an, um Benachrichtigungen zu sehen.",
    reload: "Erneut versuchen",
  },
  en: {
    title: "Notifications",
    empty: "No notifications yet.",
    failed: "Notifications could not be loaded.",
    login: "Sign in to see your notifications.",
    reload: "Try again",
  },
} as const;

export function NotificationsPanel({
  lang,
  showTitle = true,
}: {
  lang: Locale;
  showTitle?: boolean;
}) {
  const t = copy[lang];
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await userNotifications();
      setItems(rows);

      await markNotificationsRead(
        rows.filter((item) => !item.readAt).map((item) => item.id),
      );

      window.dispatchEvent(new Event("rojdeal:notifications-read"));
    } catch (reason) {
      setError(
        reason instanceof Error &&
          reason.message === "authentication_required"
          ? t.login
          : t.failed,
      );
    } finally {
      setLoading(false);
    }
  }, [t.failed, t.login]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      {showTitle && (
        <h1 className="flex items-center gap-2 text-2xl font-black text-rojNavy">
          <Bell className="text-rojRed" />
          {t.title}
        </h1>
      )}

      {loading ? (
        <div className="rounded-3xl bg-white p-10 text-center">
          <Loader2 className="mx-auto animate-spin text-rojRed" />
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-white p-8 text-center">
          <p className="font-bold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-xl bg-rojRed px-5 py-3 font-black text-white"
          >
            {t.reload}
          </button>
        </div>
      ) : !items.length ? (
        <div className="rounded-3xl bg-white p-10 text-center text-gray-500">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const href = notificationLink(lang, item.type, item.payload);

            return (
              <article
                key={item.id}
                className={`rounded-3xl border p-5 shadow-sm ${
                  item.readAt
                    ? "border-transparent bg-white"
                    : "border-rojRed/30 bg-red-50"
                }`}
              >
                <div className="flex gap-3">
                  <div className="rounded-xl bg-rojRed/10 p-2 text-rojRed">
                    <Megaphone className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-black text-rojNavy">
                      {href ? (
                        <Link className="underline" href={href}>
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </h2>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {item.body}
                    </p>

                    <time className="mt-3 block text-xs text-gray-400">
                      {new Intl.DateTimeFormat(
                        lang === "ku" ? "ku" : lang,
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      ).format(new Date(item.createdAt))}
                    </time>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
