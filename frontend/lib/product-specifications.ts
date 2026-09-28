/** @fileOverview Separate public product facts from internal delivery configuration. @stability active */
type Specification = { key: string; value: string | number };

function entries(value: unknown): Specification[] | null {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is Specification => !!entry && typeof entry === 'object' &&
    typeof entry.key === 'string' && (typeof entry.value === 'string' || (typeof entry.value === 'number' && Number.isFinite(entry.value))));
}

export function publicProductSpecifications(value: unknown) {
  return entries(value)?.filter(entry => !entry.key.trim().startsWith('__'))
    .map(entry => ({ key: entry.key, value: String(entry.value) })) ?? null;
}

/** Ordinary edits replace public facts only; private delivery settings use their own authorized endpoint. */
export function replacePublicProductSpecifications(previous: unknown, next: Specification[]) {
  return [...next.filter(entry => !entry.key.trim().startsWith('__')),
    ...(entries(previous)?.filter(entry => entry.key.trim().startsWith('__')) ?? [])];
}
