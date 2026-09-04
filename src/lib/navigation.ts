export function marketplaceHref(lang: string, current: Record<string, string | string[] | undefined>, category?: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === 'string' && value && key !== 'category' && key !== 'page') params.set(key, value);
  }
  if (category) params.set('category', category);
  return `/${lang}${params.size ? `?${params}` : ''}`;
}

export function expandLocations<T extends { id: number; parent_id: number | null }>(nodes: T[], selected: number[]): number[] {
  const result = new Set(selected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parent_id !== null && result.has(node.parent_id) && !result.has(node.id)) {
        result.add(node.id); changed = true;
      }
    }
  }
  return [...result];
}
