import type {Locale} from './i18n-config';
const messages={
 credentials:['البريد أو كلمة المرور غير صحيحين.','E-name an şîfre ne rast e.','E-Mail oder Passwort ist falsch.','Incorrect email or password.'],
 confirm:['أكّد بريدك الإلكتروني أولاً، ثم حاول الدخول مجدداً.','Pêşî e-nameya xwe piştrast bike.','Bestätige zuerst deine E-Mail-Adresse.','Confirm your email address before signing in.'],
 rate:['محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.','Hewldanên zêde. Hinekî bisekine û dîsa biceribîne.','Zu viele Versuche. Warte kurz und versuche es erneut.','Too many attempts. Wait a little and try again.'],
 weak:['اختر كلمة مرور أقوى من 8 أحرف على الأقل.','Şîfreyeke bihêz bi herî kêm 8 tîpan hilbijêre.','Wähle ein stärkeres Passwort mit mindestens 8 Zeichen.','Choose a stronger password with at least 8 characters.'],
 network:['تعذر الاتصال. تحقق من الإنترنت وأعد المحاولة.','Girêdan bi ser neket. Înternetê kontrol bike.','Verbindung fehlgeschlagen. Prüfe deine Internetverbindung.','Connection failed. Check your internet connection.'],
 generic:['تعذر إكمال العملية. تحقق من البيانات وأعد المحاولة.','Çalakî bi ser neket. Agahiyan kontrol bike.','Vorgang fehlgeschlagen. Prüfe deine Angaben und versuche es erneut.','Could not complete the operation. Check your details and retry.'],
};
export function authFeedback(error:unknown,lang:Locale){const e=(error&&typeof error==='object'?error:{})as {code?:string;name?:string;message?:string};let key:keyof typeof messages='generic';if(e.code==='invalid_credentials')key='credentials';else if(e.code==='email_not_confirmed')key='confirm';else if(e.code?.startsWith('over_')||e.code==='rate_limit_exceeded')key='rate';else if(e.code==='weak_password')key='weak';else if(e.name==='AuthRetryableFetchError'||/failed to fetch|network/i.test(e.message??''))key='network';return messages[key][['ar','ku','de','en'].indexOf(lang)];}
