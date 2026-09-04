export function notificationLink(lang: string, type: string, payload: Record<string, unknown>): string | null {
  const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
  if (uuid(payload.support_request_id)) {
    return type === 'support_request'
      ? `/${lang}/admin?section=support&request=${payload.support_request_id}`
      : `/${lang}/contact?request=${payload.support_request_id}`;
  }
  if (uuid(payload.listing_id)) return `/${lang}/listings/${payload.listing_id}`;
  return null;
}
