"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Send } from "lucide-react";
import { messages, sendMessage, type WebMessage, } from "@/services/web-features";
import type { Locale } from "@/lib/i18n-config";
import { supabase } from "@/lib/supabase";
import {useAccount} from "@/components/account/useAccount";
import {AccountState} from "@/components/account/AccountState";
import {displayDate} from "@/lib/admin-display";
import {CHAT_ATTACHMENT_LIMIT,cancelChatAttachment,deleteChatMessage,sendChatAttachment,type ChatSendAttempt} from '@/services/chat-actions';
const extra={ar:{attach:'إرفاق صورة أو ملف',size:'الحد الأقصى 25 ميغابايت.',me:'حذف لديّ',everyone:'حذف لدى الجميع',confirm:'تأكيد حذف الرسالة؟',remove:'إزالة المرفق',pending:'إرسال المرفق لم يكتمل؛ أعد المحاولة بنفس الملف والنص.'},ku:{attach:'Wêne an pel pêve bike',size:'Herî zêde 25 MB.',me:'Ji bo min jê bibe',everyone:'Ji bo herkesî jê bibe',confirm:'Jêbirina peyamê piştrast dikî?',remove:'Pêvekê rake',pending:'Şandina pêvekê neqediya; bi heman pel û nivîsê dîsa biceribîne.'},de:{attach:'Bild oder Datei anhängen',size:'Maximal 25 MB.',me:'Für mich löschen',everyone:'Für alle löschen',confirm:'Nachricht wirklich löschen?',remove:'Anhang entfernen',pending:'Anhang noch nicht vollständig gesendet. Mit derselben Datei und demselben Text erneut versuchen.'},en:{attach:'Attach image or file',size:'Maximum 25 MB.',me:'Delete for me',everyone:'Delete for everyone',confirm:'Delete this message?',remove:'Remove attachment',pending:'Attachment not fully sent. Retry with the same file and text.'}};
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
        {items.map((x) => (<div key={x.id} className={`flex ${x.mine ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${x.mine ? "bg-rojRed text-white" : "bg-gray-100"}`}>
              {x.deleted?({ar:'تم حذف الرسالة',ku:'Peyam hat jêbirin',de:'Nachricht gelöscht',en:'Message deleted'})[lang]:x.body}{x.attachments?.map(a=>a.url?<a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all underline">{a.name}</a>:<p key={a.id} className="mt-2 text-xs">{a.name} — {t.failed}</p>)}<time className="mt-1 block text-xs opacity-70" dateTime={x.createdAt}>{displayDate(x.createdAt)}{x.mine&&x.read?" ✓✓":""}</time>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">{(['me',...(x.mine&&!x.deleted?['everyone']:[])] as ('me'|'everyone')[]).map(scope=><button key={scope} type="button" disabled={!!deleting} className="underline" onClick={async()=>{if(!window.confirm(labels.confirm))return;setDeleting(x.id);setError('');try{await deleteChatMessage(x.id,scope);await load();}catch{setError(t.failed);}finally{setDeleting(null);}}}>{labels[scope]}</button>)}</div>
            </div>
          </div>))}
        <div ref={end}/>
      </div>
      {loadError&&<button className="p-3 text-sm text-rojRed" onClick={()=>void load()}>{t.failed} {t.retry}</button>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {attempt.current.owner&&<button type="button" disabled={busy} className="mt-2 text-sm text-rojRed" onClick={async()=>{if(sending.current)return;sending.current=true;setBusy(true);try{const result=await cancelChatAttachment(attempt.current);attempt.current={};setAttachment(null);if(result==='sent')setBody('');setError('');await load();}catch{setError(t.failed);}finally{sending.current=false;setBusy(false);}}}>{({ar:'إلغاء محاولة الإرفاق',ku:'Şandina pêvekê betal bike',de:'Anhangversuch abbrechen',en:'Cancel attachment attempt'})[lang]}</button>}
      <div className="mt-3 space-y-2 border-t pt-3"><label className="block text-sm font-bold">{labels.attach}<input type="file" disabled={busy||!!attempt.current.owner} className="mt-2 block w-full text-sm" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size<1||file.size>CHAT_ATTACHMENT_LIMIT){setError(labels.size);return;}setAttachment(file);setError('');}}/></label><p className="text-xs text-gray-600">{labels.size}</p>{attachment&&<div className="flex flex-wrap gap-3 break-all text-sm"><span>{attachment.name}</span>{!attempt.current.owner&&<button type="button" disabled={busy} onClick={()=>setAttachment(null)} className="text-rojRed">{labels.remove}</button>}</div>}{attempt.current.owner&&error&&<p role="status" className="text-sm">{labels.pending}</p>}</div>
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
    </div>);
}
