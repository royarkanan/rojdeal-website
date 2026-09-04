import type { Locale } from './i18n-config';
const staffMessage = {
 ar:'هذا حساب إداري/موظف، لذلك يجب مراجعة طلب الحذف من قبل المسؤول الرئيسي. تواصل مع الدعم لطلب المراجعة؛ لم يُحذف الحساب.',
 ku:'Ev hesabê karmend an rêveber e. Divê xwediyê platformê daxwaza jêbirinê binirxîne. Ji bo vê yekê bi piştgiriyê re têkilî dayne; hesab nehatiye jêbirin.',
 de:'Dieses Mitarbeiterkonto kann nicht automatisch gelöscht werden. Die Löschung muss vom Hauptadministrator geprüft werden. Bitte kontaktiere den Support; das Konto wurde nicht gelöscht.',
 en:'This staff/admin account cannot be deleted automatically. The platform owner must review the request. Please contact support; the account has not been deleted.',
};
export function requiresOwnerReview(error: unknown): boolean {
 return Boolean(error && typeof error==='object' && 'message' in error && String(error.message).includes('staff_account_requires_owner_review'));
}
export function deletionError(error: unknown, lang: Locale, fallback: string): string {
 return requiresOwnerReview(error) ? staffMessage[lang] : fallback;
}
