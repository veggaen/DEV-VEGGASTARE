/**
 * @fileOverview  Which flagged tokens the user chose to count anyway. Stored
 *                per browser (localStorage) as "chainId:address" keys and
 *                announced with a window event so every inventory consumer
 *                recomputes without a refetch.
 * @stability     evolving
 */

const KEY = 'veggat:trusted-tokens';
export const TRUSTED_TOKENS_EVENT = 'veggat:trustedTokensChanged';

export const trustedTokenKey = (chainId: number, address: string): string => `${chainId}:${address.toLowerCase()}`;

export function readTrustedTokens(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

export function setTokenTrusted(chainId: number, address: string, trusted: boolean): Set<string> {
  const set = readTrustedTokens();
  const key = trustedTokenKey(chainId, address);
  if (trusted) set.add(key); else set.delete(key);
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(set))); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(TRUSTED_TOKENS_EVENT));
  return set;
}

export function isTokenTrusted(chainId: number, address: string, set = readTrustedTokens()): boolean {
  return set.has(trustedTokenKey(chainId, address));
}

// ── The other direction: tokens the user flagged as scams themselves ────────

const FLAG_KEY = 'veggat:flagged-tokens';

export function readFlaggedTokens(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Flagging also drops any earlier trust; the same event tells every consumer. */
export function setTokenFlagged(chainId: number, address: string, flagged: boolean): Set<string> {
  const set = readFlaggedTokens();
  const key = trustedTokenKey(chainId, address);
  if (flagged) set.add(key); else set.delete(key);
  try {
    localStorage.setItem(FLAG_KEY, JSON.stringify(Array.from(set)));
    if (flagged) { const trusted = readTrustedTokens(); trusted.delete(key); localStorage.setItem(KEY, JSON.stringify(Array.from(trusted))); }
  } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(TRUSTED_TOKENS_EVENT));
  return set;
}

export function isTokenFlagged(chainId: number, address: string, set = readFlaggedTokens()): boolean {
  return set.has(trustedTokenKey(chainId, address));
}
