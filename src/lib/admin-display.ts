import type { Locale } from './i18n-config';
const words: Record<string, [string, string, string, string]> = {
  listing_deleted:['حذف الإعلان','Îlan hat jêbirin','Anzeige gelöscht','Listing deleted'],
  direct_message_queued:['إشعار بانتظار الإرسال','Agahdarî li bendê ye','Benachrichtigung zum Versand vorgemerkt','Notification queued for delivery'],
  deleted_by_listing_owner:['حذف بواسطة صاحب الإعلان','Ji hêla xwediyê îlanê ve hat jêbirin','Vom Anzeigeninhaber gelöscht','Deleted by listing owner'],
  reason:['السبب','Sedem','Grund','Reason'],retention_days:['مدة الاحتفاظ بالأيام','Rojên hilanînê','Aufbewahrung in Tagen','Retention in days'],
  archive_delete_after:['حذف الأرشيف بعد','Jêbirina arşîvê piştî','Archivlöschung nach','Archive deletion after'],
  job_id:['معرّف مهمة الإرسال','ID ya şandinê','Versandauftrags-ID','Delivery job ID'],channel:['قناة الإرسال','Kanala şandinê','Versandkanal','Delivery channel'],notification:['إشعار داخل الحساب','Agahdariya hesabê','Kontobenachrichtigung','In-account notification'],
  refreshFailed:['تم حفظ الإجراء، لكن تعذّر تحديث القائمة. أعد تحميلها.','Çalakî hat tomarkirin lê lîste nehat nûkirin. Dîsa bar bike.','Aktion gespeichert, Liste konnte nicht aktualisiert werden. Lade sie erneut.','Action saved, but the list could not refresh. Reload it.'],
  property: ['عقارات','Emlak','Immobilien','Real estate'], vehicle: ['سيارات وآليات','Erebe','Fahrzeuge','Vehicles'], other: ['أغراض متنوعة','Tiştên din','Verschiedenes','Miscellaneous'],
  published: ['منشور','Weşandî','Veröffentlicht','Published'], hidden: ['مخفي','Veşartî','Ausgeblendet','Hidden'], removed: ['مزال','Rakiriye','Entfernt','Removed'], draft: ['مسودة','Reşnivîs','Entwurf','Draft'], reserved: ['محجوز','Veqetandî','Reserviert','Reserved'], sold: ['مباع','Firotî','Verkauft','Sold'],
  open: ['جديد','Nû','Neu','New'], reviewing: ['قيد المعالجة','Di kontrolê de','In Bearbeitung','In progress'], resolved: ['تم الحل','Çareserkirî','Gelöst','Resolved'], closed: ['مغلق','Girtî','Geschlossen','Closed'],
  account_tier_changed: ['تغيير مستوى الحساب','Guhertina pakêtê','Kontostufe geändert','Account tier changed'], platform_videos_replaced: ['حفظ قائمة فيديوهات الرئيسية','Tomarkirina vîdyoyan','Startseitenvideos gespeichert','Homepage videos saved'],
  tier: ['مستوى الحساب','Pakêt','Kontostufe','Account tier'], count: ['عدد الفيديوهات','Hejmara vîdyoyan','Anzahl Videos','Video count'], location_node_id: ['المنطقة','Herêm','Region','Region'],
  actor: ['الموظف','Karmend','Mitarbeiter','Staff member'], target: ['العنصر المتأثر','Armanc','Betroffenes Element','Affected item'],
  openListing: ['فتح الإعلان','Îlanê veke','Anzeige öffnen','Open listing'], searchListing: ['عنوان أو رقم الإعلان','Sernav an ID','Titel oder Anzeigen-ID','Title or listing ID'],
  support: ['الدعم والمتابعة','Piştgirî','Support und Verlauf','Support and replies'], send: ['إرسال','Bişîne','Senden','Send'], reply: ['الرد والمتابعة','Bersiv','Antworten / Verlauf','Reply / history'],
  empty: ['لا توجد رسائل','Peyam tune','Keine Nachrichten','No messages'], failed: ['تعذر تنفيذ العملية؛ لم تُحفظ التغييرات','Çalakî bi ser neket','Aktion fehlgeschlagen; nicht gespeichert','Action failed; changes not saved'],
  confirm: ['تأكيد تنفيذ العملية؟','Piştrast bike?','Aktion bestätigen?','Confirm this action?'],
};
export function adminText(key: string, lang: Locale): string { return words[key]?.[['ar','ku','de','en'].indexOf(lang)] ?? key; }
export function displayDate(value: unknown): string {
  const d = new Date(String(value ?? ''));
  if (!Number.isFinite(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
export function auditDetails(value: unknown, lang: Locale): string {
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).map(([k,v]) => `${adminText(k,lang)}: ${v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : k.endsWith('_after')||k.endsWith('_at') ? displayDate(v) : adminText(String(v),lang)}`).join(' · ');
}
