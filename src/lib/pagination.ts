export const PAGE_SIZE = 24;
export function pageNumber(value: unknown): number {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : 1;
}
export function pageHref(path: string, params: Record<string, unknown>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (key !== 'page' && typeof value === 'string' && value) query.set(key, value);
  if (page > 1) query.set('page', String(page));
  return `${path}${query.size ? `?${query}` : ''}#results`;
}
export function pageSlice<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE + 1);
}
