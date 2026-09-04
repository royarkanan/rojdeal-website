import { supabase } from "@/lib/supabase";

export type PlatformVideo = {
  id: string;
  titles: Record<string, string>;
  mediaUrl: string;
  posterUrl: string;
  active: boolean;
  startAt: string | null;
  endAt: string | null;
  sortOrder: number;
};

function posterUrlFromStyle(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const poster = (value as Record<string, unknown>).posterUrl;
  return typeof poster === "string" ? poster : "";
}

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
    .select("id,titles,media_url,display_style,is_active,start_at,end_at,sort_order")
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
    posterUrl: posterUrlFromStyle(row.display_style),
    active: row.is_active === true,
    startAt: row.start_at ? String(row.start_at) : null,
    endAt: row.end_at ? String(row.end_at) : null,
    sortOrder: Number(row.sort_order ?? 1000),
  }));
}

export async function adminVideos(): Promise<PlatformVideo[]> {
  const { data, error } = await supabase
    .from("platform_media_items")
    .select("id,titles,media_url,display_style,is_active,start_at,end_at,sort_order")
    .eq("placement_key", "home_carousel")
    .eq("media_type", "video")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    titles: (row.titles ?? {}) as Record<string, string>,
    mediaUrl: String(row.media_url ?? ""),
    posterUrl: posterUrlFromStyle(row.display_style),
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
      posterUrl: video.posterUrl.trim() || null,
    },
  }));
  const { error } = await supabase.rpc("replace_home_platform_videos", {
    items,
  });
  if (error) throw error;
}

async function createVideoPosterBlob(file: Blob): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("browser_required");

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<Blob>((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";

      let finished = false;
      let candidates: number[] = [];
      let candidateIndex = 0;
      let bestTime = 0;
      let bestScore = -1;
      let phase: "scan" | "capture" = "scan";

      const timer = window.setTimeout(() => {
        if (!finished) {
          finished = true;
          reject(new Error("video_poster_timeout"));
        }
      }, 30000);

      const fail = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        reject(new Error("video_poster_failed"));
      };

      const frameScore = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 27;

        const context = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (!context) return -1;

        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;

          let brightnessSum = 0;
          let visiblePixels = 0;
          let contrastSum = 0;
          let previousBrightness = 0;

          const count = pixels.length / 4;

          for (let i = 0; i < pixels.length; i += 4) {
            const brightness =
              pixels[i] * 0.2126 +
              pixels[i + 1] * 0.7152 +
              pixels[i + 2] * 0.0722;

            brightnessSum += brightness;

            if (brightness > 18) {
              visiblePixels += 1;
            }

            if (i > 0) {
              contrastSum += Math.abs(brightness - previousBrightness);
            }

            previousBrightness = brightness;
          }

          const averageBrightness = brightnessSum / count;
          const visibleRatio = visiblePixels / count;
          const averageContrast = contrastSum / Math.max(1, count - 1);

          return (
            averageBrightness +
            visibleRatio * 80 +
            Math.min(averageContrast, 40)
          );
        } catch {
          return -1;
        }
      };

      const encodeCurrentFrame = () => {
        if (finished || !video.videoWidth || !video.videoHeight) {
          fail();
          return;
        }

        const maxWidth = 1280;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          fail();
          return;
        }

        try {
          context.drawImage(video, 0, 0, width, height);
        } catch {
          fail();
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              fail();
              return;
            }

            if (finished) return;

            finished = true;
            window.clearTimeout(timer);
            resolve(blob);
          },
          "image/jpeg",
          0.86,
        );
      };

      const seekTo = (time: number) => {
        try {
          video.currentTime = time;
        } catch {
          fail();
        }
      };

      video.onerror = fail;

      video.onseeked = () => {
        if (finished) return;

        if (phase === "capture") {
          encodeCurrentFrame();
          return;
        }

        const score = frameScore();

        if (score > bestScore) {
          bestScore = score;
          bestTime = video.currentTime;
        }

        candidateIndex += 1;

        if (candidateIndex < candidates.length) {
          seekTo(candidates[candidateIndex]);
          return;
        }

        phase = "capture";

        if (Math.abs(video.currentTime - bestTime) < 0.02) {
          encodeCurrentFrame();
        } else {
          seekTo(bestTime);
        }
      };

      video.onloadedmetadata = () => {
        const duration =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : 0;

        if (duration <= 0) {
          fail();
          return;
        }

        const rawCandidates =
          duration >= 8
            ? [
                1,
                2,
                3,
                duration * 0.25,
                duration * 0.5,
                duration * 0.75,
              ]
            : [
                duration * 0.15,
                duration * 0.3,
                duration * 0.5,
                duration * 0.7,
                duration * 0.85,
              ];

        const maxTime = Math.max(0.05, duration - 0.05);

        candidates = Array.from(
          new Set(
            rawCandidates.map((time) =>
              Number(
                Math.min(Math.max(time, 0.05), maxTime).toFixed(3),
              ),
            ),
          ),
        );

        if (!candidates.length) {
          fail();
          return;
        }

        candidateIndex = 0;
        seekTo(candidates[0]);
      };

      video.src = objectUrl;
      video.load();
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadPosterBlob(userId: string, poster: Blob) {
  const path = `${userId}/web-${Date.now()}-poster.jpg`;
  const { error } = await supabase.storage
    .from("platform-content")
    .upload(path, poster, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });
  if (error) throw error;

  return supabase.storage.from("platform-content").getPublicUrl(path).data
    .publicUrl;
}

export async function uploadAdminVideo(file: File) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("authentication_required");

  const poster = await createVideoPosterBlob(file);
  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const videoPath = `${auth.user.id}/web-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from("platform-content")
    .upload(videoPath, file, {
      contentType: file.type || "video/mp4",
      cacheControl: "31536000",
    });
  if (error) throw error;

  try {
    const posterUrl = await uploadPosterBlob(auth.user.id, poster);
    const mediaUrl = supabase.storage
      .from("platform-content")
      .getPublicUrl(videoPath).data.publicUrl;

    return { mediaUrl, posterUrl };
  } catch (error) {
    await supabase.storage.from("platform-content").remove([videoPath]);
    throw error;
  }
}

export async function generateAdminVideoPoster(mediaUrl: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("authentication_required");

  const response = await fetch(mediaUrl);
  if (!response.ok) throw new Error("video_download_failed");

  const videoBlob = await response.blob();
  const poster = await createVideoPosterBlob(videoBlob);
  return uploadPosterBlob(auth.user.id, poster);
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
