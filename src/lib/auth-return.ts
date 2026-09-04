import type { Locale } from './i18n-config';

// Only destinations used by the listing flow; never accept external URLs.
export function authReturnPath(lang: Locale, next: unknown): string {
  if (typeof next !== 'string') return `/${lang}/account`;
  const listing = new RegExp(`^/${lang}/listings/(?:new|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}(?:/edit)?)$`, 'i');
  return listing.test(next) ? next : `/${lang}/account`;
}

export function needsListingLogin(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; code?: string; message?: string };
  return e.name === 'AuthSessionMissingError' ||
    ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'].includes(e.code ?? '') ||
    e.message === 'authentication_required';
}
