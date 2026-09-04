import type {Locale} from './i18n-config';
const labels:Record<string,string[]>={
 listings:['إدارة الإعلانات','Rêveberiya îlanan','Anzeigen verwalten','Manage listings'],reports:['مراجعة البلاغات','Kontrola raporan','Meldungen prüfen','Review reports'],locations:['إدارة المواقع','Rêveberiya cihan','Orte verwalten','Manage locations'],users:['إدارة المستخدمين','Rêveberiya bikarhêneran','Nutzer verwalten','Manage users'],media:['مراجعة الفيديوهات','Kontrola vîdyoyan','Videos prüfen','Review videos'],staff:['تعيين أدوار الموظفين','Rolên karmendan','Personalrollen zuweisen','Assign staff roles'],support:['الدعم والمتابعة','Piştgirî','Support bearbeiten','Handle support'],catalog:['الأقسام والمواصفات','Kategorî û taybetmendî','Kategorien und Merkmale','Categories and fields'],markets:['الأسواق','Bazar','Märkte','Markets'],legal:['المستندات القانونية','Belgeyên qanûnî','Rechtliche Dokumente','Legal documents'],ads:['إدارة الإعلانات التجارية','Rêveberiya reklaman','Werbung verwalten','Manage advertising'],tiers:['إدارة الباقات','Rêveberiya pakêtan','Pakete verwalten','Manage plans'],audit:['قراءة سجل العمليات','Xwendina tomarê','Protokoll lesen','Read audit log'],platform_content:['محتوى المنصة وفيديوهات الرئيسية','Naveroka platformê','Plattforminhalte und Startseitenvideos','Platform content and home videos'],
};
export function permissionLabel(key:string,lang:Locale){return labels[key.split('.')[0]]?.[['ar','ku','de','en'].indexOf(lang)]??key;}
export function activeAssignment(row:{is_active?:boolean;starts_at?:string;expires_at?:string|null},now=Date.now()){
 const start=Date.parse(row.starts_at??''),end=row.expires_at==null?Infinity:Date.parse(row.expires_at);
 return row.is_active===true&&Number.isFinite(start)&&start<=now&&end>now;
}
