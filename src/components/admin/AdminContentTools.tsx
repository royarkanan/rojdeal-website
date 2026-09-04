"use client";
import { useEffect, useState } from "react";
import { Loader2, Megaphone, Plus, Save, Trash2, Upload, Video } from "lucide-react";
import type { Locale } from "@/lib/i18n-config";
import { adminVideos, generateAdminVideoPoster, saveAdminVideos, sendAdminBroadcast, uploadAdminVideo, type PlatformVideo } from "@/services/platform-content";
const copy = { ar: { messages: "إرسال إشعار من الإدارة", title: "عنوان الإشعار", body: "نص الإشعار", send: "إرسال لجميع المستخدمين", sent: "تم وضع الإشعار في قائمة الإرسال", videos: "فيديوهات الصفحة الرئيسية", add: "إضافة فيديو", upload: "رفع الفيديو", url: "رابط الفيديو", save: "حفظ الفيديوهات", saved: "تم حفظ الفيديوهات", remove: "حذف", active: "ظاهر للمستخدمين", error: "تعذر تنفيذ العملية", required: "أدخل العنوان والنص أولاً", limit: "حجم الفيديو يجب ألا يتجاوز 100 MB" }, ku: { messages: "Agahdariya rêveberiyê", title: "Sernav", body: "Naverok", send: "Ji hemû bikarhêneran re bişîne", sent: "Li bendê şandinê ye", videos: "Vîdyoyên rûpela sereke", add: "Vîdyo zêde bike", upload: "Vîdyo bar bike", url: "Girêdana vîdyoyê", save: "Vîdyoyan tomar bike", saved: "Hat tomarkirin", remove: "Jê bibe", active: "Ji bikarhêneran re xuya", error: "Çalakî bi ser neket", required: "Sernav û nivîsê binivîse", limit: "Vîdyo divê ji 100 MB kêmtir be" }, de: { messages: "Verwaltungsmitteilung senden", title: "Titel", body: "Mitteilung", send: "An alle Benutzer senden", sent: "Mitteilung zum Versand vorgemerkt", videos: "Videos auf der Startseite", add: "Video hinzufügen", upload: "Video hochladen", url: "Video-Link", save: "Videos speichern", saved: "Videos wurden gespeichert", remove: "Löschen", active: "Für Benutzer sichtbar", error: "Aktion fehlgeschlagen", required: "Titel und Nachricht eingeben", limit: "Das Video darf höchstens 100 MB groß sein" }, en: { messages: "Send administration notification", title: "Title", body: "Message", send: "Send to all users", sent: "Notification queued", videos: "Homepage videos", add: "Add video", upload: "Upload video", url: "Video URL", save: "Save videos", saved: "Videos saved", remove: "Delete", active: "Visible to users", error: "Action failed", required: "Enter a title and message", limit: "Video must not exceed 100 MB" } } as const;
const posterCopy = {
  ar: "إنشاء صورة معاينة",
  ku: "Wêneyê pêşdîtinê çêbike",
  de: "Vorschaubild erstellen",
  en: "Create preview image",
} as const;
const blank = (): PlatformVideo => ({ id: "", titles: { ar: "", ku: "", de: "", en: "" }, mediaUrl: "", posterUrl: "", active: true, startAt: null, endAt: null, sortOrder: 1000 });
export function AdminContentTools({ lang, canBroadcast, canContent }: {
    lang: Locale;
    canBroadcast: boolean;
    canContent: boolean;
}) { const [loaded,setLoaded]=useState(false); const t = copy[lang], [title, setTitle] = useState(""), [body, setBody] = useState(""), [videos, setVideos] = useState<PlatformVideo[]>([]), [busy, setBusy] = useState(""), [notice, setNotice] = useState(""); useEffect(() => { setLoaded(false); if (canContent)
    void adminVideos().then(rows=>{setVideos(rows);setLoaded(true);}).catch(() => setNotice(t.error)); }, [canContent, t.error]); const broadcast = async () => { if (busy || !window.confirm(t.send+'?')) return; if (title.trim().length < 2 || body.trim().length < 2) {
    setNotice(t.required);
    return;
} setBusy("message"); setNotice(""); try {
    await sendAdminBroadcast(title, body);
    setTitle("");
    setBody("");
    setNotice(t.sent);
}
catch {
    setNotice(t.error);
}
finally {
    setBusy("");
} }; const upload = async (index: number, file?: File) => { if (!file)
    return; if (file.size > 100 * 1024 * 1024) {
    setNotice(t.limit);
    return;
} setBusy(`upload-${index}`); try {
    const uploaded = await uploadAdminVideo(file);
    setVideos(old => old.map((v, i) => i === index ? { ...v, mediaUrl: uploaded.mediaUrl, posterUrl: uploaded.posterUrl } : v));
}
catch {
    setNotice(t.error);
}
finally {
    setBusy("");
} }; const makePoster = async (index: number) => {
  const current = videos[index];
  if (!current?.mediaUrl || busy) return;
  setBusy(`poster-${index}`);
  setNotice("");
  try {
    const posterUrl = await generateAdminVideoPoster(current.mediaUrl);
    setVideos(old => old.map((v, i) => i === index ? { ...v, posterUrl } : v));
  }
  catch {
    setNotice(t.error);
  }
  finally {
    setBusy("");
  }
}; const save = async () => { if (busy) return; if (!loaded) {setNotice(t.error);return;} if (!window.confirm(`${t.save} (${videos.length})?`)) return; if (videos.some(v => {try{return new URL(v.mediaUrl.trim()).protocol!=='https:';}catch{return true;}})) {
    setNotice(t.error);
    return;
} setBusy("videos"); setNotice(""); try {
    await saveAdminVideos(videos);
    setVideos(await adminVideos());
    setNotice(t.saved);
}
catch {
    setNotice(t.error);
}
finally {
    setBusy("");
} }; return <div className="space-y-5">{notice && <div className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{notice}</div>}{canBroadcast && <section className="rounded-[22px] bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Megaphone className="text-rojRed"/>{t.messages}</h2><div className="space-y-3"><input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={t.title} className="w-full rounded-xl border p-3"/><textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} placeholder={t.body} rows={5} className="w-full rounded-xl border p-3"/><button onClick={() => void broadcast()} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rojRed px-4 py-3 font-black text-white disabled:opacity-50">{busy === "message" ? <Loader2 className="animate-spin"/> : <Megaphone />}{t.send}</button></div></section>}{canContent && <section className="rounded-[22px] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-black"><Video className="text-rojRed"/>{t.videos}</h2><button onClick={() => setVideos(v => [...v, blank()])} className="rounded-xl bg-rojNavy p-2 text-white" aria-label={t.add}><Plus /></button></div><div className="space-y-4">{videos.map((video, index) => <div key={video.id || index} className="space-y-2 rounded-2xl border p-3">{video.mediaUrl && <video src={video.mediaUrl} poster={video.posterUrl || undefined} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black object-contain"/>}<input value={video.titles[lang] ?? ""} onChange={e => setVideos(old => old.map((v, i) => i === index ? { ...v, titles: { ...v.titles, [lang]: e.target.value } } : v))} placeholder={t.title} className="w-full rounded-xl border p-3"/><input value={video.mediaUrl} onChange={e => setVideos(old => old.map((v, i) => i === index ? { ...v, mediaUrl: e.target.value } : v))} placeholder={t.url} className="w-full rounded-xl border p-3 text-start" dir="ltr"/><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-3 font-bold text-rojRed"><Upload className="h-5 w-5"/>{busy === `upload-${index}` ? <Loader2 className="animate-spin"/> : t.upload}<input type="file" accept="video/*" className="hidden" onChange={e => void upload(index, e.target.files?.[0])}/></label>{video.mediaUrl && <button type="button" onClick={() => void makePoster(index)} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl border p-3 font-bold text-rojNavy disabled:opacity-50">{busy === `poster-${index}` && <Loader2 className="h-5 w-5 animate-spin"/>}{posterCopy[lang]}</button>}<div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={video.active} onChange={e => setVideos(old => old.map((v, i) => i === index ? { ...v, active: e.target.checked } : v))}/>{t.active}</label><button onClick={() => setVideos(old => old.filter((_, i) => i !== index))} className="flex items-center gap-1 text-sm font-bold text-red-700"><Trash2 className="h-4 w-4"/>{t.remove}</button></div></div>)}<button onClick={() => void save()} disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rojRed px-4 py-3 font-black text-white disabled:opacity-50">{busy === "videos" ? <Loader2 className="animate-spin"/> : <Save />}{t.save}</button></div></section>}</div>; }
