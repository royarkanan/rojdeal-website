import { supabase } from "@/lib/supabase";

export type PlatformVideo = {
  id: string;
  titles: Record<string, string>;
  mediaUrl: string;
  active: boolean;
  startAt: string | null;
  endAt: string | null;
  sortOrder: number;
};

export type UserNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

export async function homeVideos(): Promise<PlatformVideo[]> {
  const { data, error } = await supabase
    .from("platform_media_items")
    .select("id,titles,media_url,is_active,start_at,end_at,sort_order")
    .eq("placement_key", "home_carousel")
    .eq("media_type", "video")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    titles: (row.titles && typeof row.titles === "object"
      ? row.titles
      : {}) as Record<string, string>,
    mediaUrl: String(row.media_url ?? ""),
    active: row.is_active === true,
    startAt: row.start_at ? String(row.start_at) : null,
    endAt: row.end_at ? String(row.end_at) : null,
    sortOrder: Number(row.sort_order ?? 1000),
  }));
}

export async function adminVideos(): Promise<PlatformVideo[]> {
  const { data, error } = await supabase
    .from("platform_media_items")
    .select("id,titles,media_url,is_active,start_at,end_at,sort_order")
    .eq("placement_key", "home_carousel")
    .eq("media_type", "video")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    titles: (row.titles ?? {}) as Record<string, string>,
    mediaUrl: String(row.media_url ?? ""),
    active: row.is_active === true,
    startAt: row.start_at ? String(row.start_at) : null,
    endAt: row.end_at ? String(row.end_at) : null,
    sortOrder: Number(row.sort_order ?? 1000),
  }));
}

export async function userNotifications(): Promise<UserNotification[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("authentication_required");
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,read_at,created_at,payload")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
  }));
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", auth.user.id);
  if (error) throw error;
}

export async function unreadNotificationCount() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function sendAdminBroadcast(title: string, body: string) {
  const { error } = await supabase.rpc("queue_admin_broadcast", {
    message_title: title.trim(),
    message_body: body.trim(),
    delivery_channel: "notification",
  });
  if (error) throw error;
}

export async function saveAdminVideos(videos: PlatformVideo[]) {
  const items = videos.map((video, index) => ({
    id: video.id || undefined,
    titles: video.titles,
    media_url: video.mediaUrl.trim(),
    is_active: video.active,
    start_at: video.startAt || null,
    end_at: video.endAt || null,
    sort_order: index * 10,
    display_style: {
      titlePlacement: "overlayTop",
      titleSize: "medium",
      titleTheme: "brand",
      titleAnimation: "static",
      autoAdvance: true,
      loopPlaylist: true,
      autoPlay: false,
      controlsAutoHideSeconds: 3,
    },
  }));
  const { error } = await supabase.rpc("replace_home_platform_videos", {
    items,
  });
  if (error) throw error;
}

export async function uploadAdminVideo(file: File) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("authentication_required");
  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${auth.user.id}/web-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from("platform-content")
    .upload(path, file, { contentType: file.type || "video/mp4" });
  if (error) throw error;
  return supabase.storage.from("platform-content").getPublicUrl(path).data
    .publicUrl;
}

export type ManagedPageKey =
  "about" | "safety" | "privacy" | "terms" | "imprint";
export type ManagedPageValues = Record<
  string,
  { title: string; content: string }
>;

export async function managedPage(page: ManagedPageKey, lang: string) {
  const keys = [`web_${page}_title`, `web_${page}_content`];
  const { data, error } = await supabase
    .from("app_text_overrides")
    .select("text_key,values")
    .in("text_key", keys)
    .eq("is_active", true);
  if (error) throw error;
  const rows = Object.fromEntries(
    (data ?? []).map((row) => [
      String(row.text_key),
      row.values as Record<string, string>,
    ]),
  );
  return {
    title: String(rows[`web_${page}_title`]?.[lang] ?? "").trim(),
    content: String(rows[`web_${page}_content`]?.[lang] ?? "").trim(),
  };
}

export async function allManagedPages(): Promise<
  Record<ManagedPageKey, ManagedPageValues>
> {
  const { data, error } = await supabase
    .from("app_text_overrides")
    .select("text_key,values")
    .like("text_key", "web_%");
  if (error) throw error;
  const result = {} as Record<ManagedPageKey, ManagedPageValues>;
  for (const page of [
    "about",
    "safety",
    "privacy",
    "terms",
    "imprint",
  ] as ManagedPageKey[]) {
    const title = (data ?? []).find(
      (row) => row.text_key === `web_${page}_title`,
    )?.values as Record<string, string> | undefined;
    const content = (data ?? []).find(
      (row) => row.text_key === `web_${page}_content`,
    )?.values as Record<string, string> | undefined;
    result[page] = Object.fromEntries(
      ["ar", "ku", "de", "en"].map((lang) => [
        lang,
        {
          title: String(title?.[lang] ?? ""),
          content: String(content?.[lang] ?? ""),
        },
      ]),
    ) as ManagedPageValues;
  }
  return result;
}

export async function saveManagedPage(
  page: ManagedPageKey,
  values: ManagedPageValues,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("authentication_required");
  const titles = Object.fromEntries(
    Object.entries(values).map(([lang, value]) => [lang, value.title.trim()]),
  );
  const contents = Object.fromEntries(
    Object.entries(values).map(([lang, value]) => [lang, value.content.trim()]),
  );
  const { error } = await supabase.from("app_text_overrides").upsert(
    [
      {
        text_key: `web_${page}_title`,
        values: titles,
        is_active: true,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      },
      {
        text_key: `web_${page}_content`,
        values: contents,
        is_active: true,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "text_key" },
  );
  if (error) throw error;
}
