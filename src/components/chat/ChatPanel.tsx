"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, MoreVertical, RefreshCw, Send, X } from "lucide-react";
import { messages, sendMessage, type WebMessage, } from "@/services/web-features";
import type { Locale } from "@/lib/i18n-config";
import { supabase } from "@/lib/supabase";
import {useAccount} from "@/components/account/useAccount";
import {AccountState} from "@/components/account/AccountState";
import {displayDate} from "@/lib/admin-display";
import {CHAT_ATTACHMENT_LIMIT,cancelChatAttachment,deleteChatMessage,sendChatAttachment,type ChatSendAttempt} from '@/services/chat-actions';
const extra={ar:{attach:'إرفاق صورة أو ملف',size:'الحد الأقصى 25 ميغابايت.',me:'حذف لديّ',everyone:'حذف لدى الجميع',confirm:'تأكيد حذف الرسالة؟',remove:'إزالة المرفق',pending:'إرسال المرفق لم يكتمل؛ أعد المحاولة بنفس الملف والنص.'},ku:{attach:'Wêne an pel pêve bike',size:'Herî zêde 25 MB.',me:'Ji bo min jê bibe',everyone:'Ji bo herkesî jê bibe',confirm:'Jêbirina peyamê piştrast dikî?',remove:'Pêvekê rake',pending:'Şandina pêvekê neqediya; bi heman pel û nivîsê dîsa biceribîne.'},de:{attach:'Bild oder Datei anhängen',size:'Maximal 25 MB.',me:'Für mich löschen',everyone:'Für alle löschen',confirm:'Nachricht wirklich löschen?',remove:'Anhang entfernen',pending:'Anhang noch nicht vollständig gesendet. Mit derselben Datei und demselben Text erneut versuchen.'},en:{attach:'Attach image or file',size:'Maximum 25 MB.',me:'Delete for me',everyone:'Delete for everyone',confirm:'Delete this message?',remove:'Remove attachment',pending:'Attachment not fully sent. Retry with the same file and text.'}};
function formatBytes(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const copy = {
    ar: { placeholder: "اكتب رسالة…", send: "إرسال", failed: "تعذر تحميل المحادثة أو إرسال الرسالة.", retry: "إعادة المحاولة" },
    ku: { placeholder: "Peyam binivîse…", send: "Bişîne", failed: "Sohbet nehat barkirin an peyam nehat şandin.", retry: "Dîsa biceribîne" },
    de: { placeholder: "Nachricht schreiben…", send: "Senden", failed: "Chat konnte nicht geladen oder Nachricht nicht gesendet werden.", retry: "Erneut versuchen" },
    en: { placeholder: "Write a message…", send: "Send", failed: "The chat could not be loaded or the message could not be sent.", retry: "Try again" },
} as const;
export function ChatPanel({lang,id}:{lang:Locale;id:string}){
 const auth=useAccount();
 if(auth.loading||auth.error||!auth.user)return <AccountState lang={lang} loading={auth.loading} error={auth.error} retry={auth.retry}/>;
 return <ChatBody key={`${auth.user.id}:${id}`} lang={lang} id={id}/>;
}
function ChatBody({lang,id}:{lang:Locale;id:string}){
    const labels=extra[lang],attempt=useRef<ChatSendAttempt>({});
    const [attachment,setAttachment]=useState<File|null>(null),[deleting,setDeleting]=useState<string|null>(null);
    const [menuId,setMenuId]=useState<string|null>(null);
    const [previewUrl,setPreviewUrl]=useState<string|null>(null);
    const [attachmentPreviewUrl,setAttachmentPreviewUrl]=useState<string|null>(null);
    const sending=useRef(false),live=useRef(true),generation=useRef(0);
    const [loadError,setLoadError]=useState(false);
    useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
    const t = copy[lang], [items, setItems] = useState<WebMessage[]>([]), [loading, setLoading] = useState(true), [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), end = useRef<HTMLDivElement>(null);
    const load = useCallback(async () => {
        const current=++generation.current;
        try {
            const rows=await messages(id);
            if(live.current&&current===generation.current){setItems(rows);setLoadError(false);}
        }
        catch {
            if(live.current&&current===generation.current)setLoadError(true);
        }
        finally {
            if(live.current&&current===generation.current)setLoading(false);
        }
    }, [id]);
    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        const channel = supabase
            .channel(`web-conversation-${id}`)
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${id}`,
        }, () => void load())
            .subscribe();
        return () => {
            void supabase.removeChannel(channel);
        };
    }, [id, load]);
    useEffect(() => {
        end.current?.scrollIntoView();
    }, [items]);

    useEffect(() => {
        if (!attachment || !attachment.type.startsWith("image/")) {
            setAttachmentPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(attachment);
        setAttachmentPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [attachment]);
    if (loading)
        return <Loader2 className="mx-auto my-20 animate-spin text-rojRed"/>;
    if (loadError && items.length === 0)
        return (<div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center">
        <AlertCircle className="mx-auto mb-3 text-rojRed"/>
        <p className="font-bold">{t.failed}</p>
        <button type="button" onClick={() => void load()} className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-rojRed px-4 py-2 font-black text-white">
          <RefreshCw className="h-4 w-4"/>
          {t.retry}
        </button>
      </div>);
    return (<div className="mx-auto flex min-h-[65vh] max-w-2xl flex-col rounded-2xl bg-white p-3">
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {items.map((x) => (
          <div
            key={x.id}
            className={`flex ${x.mine ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`relative max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                x.mine ? "bg-rojRed text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  {x.body && (
                    <p className="whitespace-pre-wrap break-words px-1">
                      {x.body}
                    </p>
                  )}

                  {x.attachments?.map((a) =>
                    a.kind === "image" && a.url ? (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setPreviewUrl(a.url)}
                        className="mt-2 block max-w-full overflow-hidden rounded-xl"
                        aria-label={a.name}
                      >
                        <img
                          src={a.url}
                          alt={a.name}
                          loading="lazy"
                          className="max-h-72 w-auto max-w-full rounded-xl object-cover"
                        />
                      </button>
                    ) : (
                      <a
                        key={a.id}
                        href={a.url ?? undefined}
                        target={a.url ? "_blank" : undefined}
                        rel={a.url ? "noopener noreferrer" : undefined}
                        className={`mt-2 flex min-w-0 items-center gap-3 rounded-xl border p-3 no-underline ${
                          x.mine
                            ? "border-white/30 bg-white/10 text-white"
                            : "border-gray-200 bg-white text-gray-900"
                        }`}
                      >
                        <FileText className="h-7 w-7 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate font-bold">
                            {a.name}
                          </span>
                          {a.sizeBytes > 0 && (
                            <span className="block text-xs opacity-70">
                              {formatBytes(a.sizeBytes)}
                            </span>
                          )}
                        </span>
                      </a>
                    ),
                  )}
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="Message actions"
                    className="rounded-full p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
                    onClick={() =>
                      setMenuId((current) => current === x.id ? null : x.id)
                    }
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuId === x.id && (
                    <div className="absolute right-0 top-7 z-30 min-w-44 overflow-hidden rounded-xl border bg-white py-1 text-gray-900 shadow-xl">
                      <button
                        type="button"
                        disabled={!!deleting}
                        className="block w-full px-4 py-2 text-start text-sm hover:bg-gray-50 disabled:opacity-50"
                        onClick={async () => {
                          if (!window.confirm(labels.confirm)) return;
                          setDeleting(x.id);
                          setMenuId(null);
                          setError("");
                          try {
                            await deleteChatMessage(x.id, "me");
                            await load();
                          } catch {
                            setError(t.failed);
                          } finally {
                            setDeleting(null);
                          }
                        }}
                      >
                        {labels.me}
                      </button>

                      {x.mine && (
                        <button
                          type="button"
                          disabled={!!deleting}
                          className="block w-full px-4 py-2 text-start text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          onClick={async () => {
                            if (!window.confirm(labels.confirm)) return;
                            setDeleting(x.id);
                            setMenuId(null);
                            setError("");
                            try {
                              await deleteChatMessage(x.id, "everyone");
                              await load();
                            } catch {
                              setError(t.failed);
                            } finally {
                              setDeleting(null);
                            }
                          }}
                        >
                          {labels.everyone}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <time
                className="mt-1 block px-1 text-xs opacity-70"
                dateTime={x.createdAt}
              >
                {displayDate(x.createdAt)}
                {x.mine && x.read ? " ✓✓" : ""}
              </time>
            </div>
          </div>
        ))}
        <div ref={end}/>
      </div>
      {loadError&&<button className="p-3 text-sm text-rojRed" onClick={()=>void load()}>{t.failed} {t.retry}</button>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {attempt.current.owner&&<button type="button" disabled={busy} className="mt-2 text-sm text-rojRed" onClick={async()=>{if(sending.current)return;sending.current=true;setBusy(true);try{const result=await cancelChatAttachment(attempt.current);attempt.current={};setAttachment(null);if(result==='sent')setBody('');setError('');await load();}catch{setError(t.failed);}finally{sending.current=false;setBusy(false);}}}>{({ar:'إلغاء محاولة الإرفاق',ku:'Şandina pêvekê betal bike',de:'Anhangversuch abbrechen',en:'Cancel attachment attempt'})[lang]}</button>}
      <div className="mt-3 space-y-2 border-t pt-3"><label className="block text-sm font-bold">{labels.attach}<input type="file" disabled={busy||!!attempt.current.owner} className="mt-2 block w-full text-sm" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size<1||file.size>CHAT_ATTACHMENT_LIMIT){setError(labels.size);return;}setAttachment(file);setError('');}}/></label><p className="text-xs text-gray-600">{labels.size}</p>{attachment&&(
        <div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-2 text-sm">
          {attachmentPreviewUrl ? (
            <img
              src={attachmentPreviewUrl}
              alt={attachment.name}
              className="h-20 w-20 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white">
              <FileText className="h-7 w-7 text-gray-500" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{attachment.name}</p>
            <p className="text-xs text-gray-500">
              {formatBytes(attachment.size)}
            </p>
          </div>

          {!attempt.current.owner&&(
            <button
              type="button"
              aria-label={labels.remove}
              disabled={busy}
              onClick={()=>setAttachment(null)}
              className="rounded-full p-2 text-rojRed hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}{attempt.current.owner&&error&&<p role="status" className="text-sm">{labels.pending}</p>}</div>
      <form className="mt-3 flex gap-2 border-t pt-3" onSubmit={async (e) => {
            e.preventDefault();
            if ((!body.trim()&&!attachment) || sending.current)
                return;
            sending.current=true;
            setBusy(true);setError("");
            try {
                if(attachment)await sendChatAttachment(id,attachment,body,attempt.current);
                else await sendMessage(id, body);
                attempt.current={};setAttachment(null);
                setBody("");
                await load();
            }
            catch {
                setError(t.failed);
            }
            finally {
                setBusy(false);
                sending.current=false;
            }
        }}>
        <input maxLength={2000} disabled={busy||!!attempt.current.owner} aria-label={t.placeholder} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.placeholder} className="min-w-0 flex-1 rounded-2xl border px-4 outline-none"/>
        <button aria-label={t.send} disabled={busy} className="flex items-center gap-2 rounded-2xl bg-rojRed px-5 py-3 font-black text-white">
          <Send className="h-4 w-4"/>
          <span className="hidden sm:inline">{t.send}</span>
        </button>
      </form>

      {previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPreviewUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-3 text-white"
          >
            <X className="h-6 w-6" />
          </button>

          <img
            src={previewUrl}
            alt=""
            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>);
}
