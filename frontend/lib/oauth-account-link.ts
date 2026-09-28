/**
 * @fileOverview  Link an OAuth identity to the user who is ALREADY signed in.
 *                Auth.js alone never does this: with a live session, a provider
 *                callback either matches an existing account, matches a user
 *                by email (refused: dangerous linking is off) or registers a
 *                brand-new user, so "Link Discord" from Settings silently made
 *                or found someone else. The signIn callback now asks who holds
 *                this browser's session and attaches the provider to them.
 * @stability     evolving
 */

import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookies';

/** Auth.js splits cookies over ~4 KB into `name.0`, `name.1`, …; put them back together. */
export function joinChunkedCookie(all: { name: string; value: string }[], name: string): string | null {
  const exact = all.find((c) => c.name === name)?.value;
  if (exact) return exact;
  const chunks = all
    .filter((c) => c.name.startsWith(name + '.'))
    .map((c) => ({ i: Number(c.name.slice(name.length + 1)), v: c.value }))
    .filter((c) => Number.isInteger(c.i))
    .sort((a, b) => a.i - b.i);
  return chunks.length ? chunks.map((c) => c.v).join('') : null;
}

/** The user signed in to THIS browser, from the session cookie. Null when signed out, previewing another account, or unreadable. */
export async function currentSessionUserId(secret: string | undefined): Promise<string | null> {
  if (!secret) return null;
  try {
    const store = await cookies();
    const raw = joinChunkedCookie(store.getAll(), SESSION_COOKIE_NAME);
    if (!raw) return null;
    const token = await decode({ token: raw, secret, salt: SESSION_COOKIE_NAME });
    if (!token?.sub) return null;
    if ((token as { isImpersonating?: unknown }).isImpersonating === true) return null;
    return token.sub;
  } catch {
    return null;
  }
}

export type LinkDecision = 'not-signed-in' | 'already-linked' | 'linked-elsewhere' | 'linked';

/**
 * Decide what a provider callback means for the signed-in user. Pure apart from
 * the two injected data calls, so it is unit-tested without a database.
 */
export async function linkOauthAccountToUser({ currentUserId, provider, providerAccountId, findOwner, link }: {
  currentUserId: string | null;
  provider: string;
  providerAccountId: string;
  /** Who already owns this provider identity, if anyone. */
  findOwner: (provider: string, providerAccountId: string) => Promise<string | null>;
  /** Attach the identity to the current user. */
  link: () => Promise<void>;
}): Promise<LinkDecision> {
  if (!currentUserId) return 'not-signed-in';
  const owner = await findOwner(provider, providerAccountId);
  if (owner === currentUserId) return 'already-linked';
  if (owner) return 'linked-elsewhere';
  await link();
  return 'linked';
}

/** Only the columns the Account model has; providers add extras (expires_in, …) that Prisma would reject. */
export function accountRowFromProvider(account: Record<string, unknown>, userId: string) {
  const s = (key: string) => (typeof account[key] === 'string' ? (account[key] as string) : undefined);
  const expiresAt = typeof account.expires_at === 'number' ? account.expires_at : undefined;
  return {
    userId,
    type: s('type') ?? 'oauth',
    provider: s('provider') ?? '',
    providerAccountId: s('providerAccountId') ?? '',
    refresh_token: s('refresh_token'),
    access_token: s('access_token'),
    expires_at: expiresAt,
    token_type: s('token_type'),
    scope: s('scope'),
    id_token: s('id_token'),
    session_state: s('session_state'),
  };
}
