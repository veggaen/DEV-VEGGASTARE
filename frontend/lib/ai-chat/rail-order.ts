/** IDs only; titles and draft content are never persisted in browser storage. */
export function readRailOrder(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id)))].slice(0, 250) : [];
  } catch { return []; }
}
export function orderRail<T extends { id: string }>(rows: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}
export function moveRail(ids: string[], source: string, target: string): string[] {
  const from = ids.indexOf(source), to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids]; next.splice(from, 1); next.splice(to, 0, source); return next;
}
