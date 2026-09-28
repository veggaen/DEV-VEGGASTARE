import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));

import { accountRowFromProvider, joinChunkedCookie, linkOauthAccountToUser } from './oauth-account-link';

describe('linkOauthAccountToUser', () => {
  const base = { provider: 'discord', providerAccountId: '42' };

  it('leaves the normal sign-in flow alone when nobody is signed in', async () => {
    const link = vi.fn();
    expect(await linkOauthAccountToUser({ ...base, currentUserId: null, findOwner: async () => null, link })).toBe('not-signed-in');
    expect(link).not.toHaveBeenCalled();
  });

  it('attaches a fresh identity to the signed-in user', async () => {
    const link = vi.fn(async () => {});
    expect(await linkOauthAccountToUser({ ...base, currentUserId: 'u1', findOwner: async () => null, link })).toBe('linked');
    expect(link).toHaveBeenCalledTimes(1);
  });

  it('is idempotent for an identity the user already linked', async () => {
    const link = vi.fn();
    expect(await linkOauthAccountToUser({ ...base, currentUserId: 'u1', findOwner: async () => 'u1', link })).toBe('already-linked');
    expect(link).not.toHaveBeenCalled();
  });

  it('refuses an identity that belongs to another user', async () => {
    const link = vi.fn();
    expect(await linkOauthAccountToUser({ ...base, currentUserId: 'u1', findOwner: async () => 'u2', link })).toBe('linked-elsewhere');
    expect(link).not.toHaveBeenCalled();
  });
});

describe('joinChunkedCookie', () => {
  it('prefers the whole cookie and otherwise joins the chunks in order', () => {
    expect(joinChunkedCookie([{ name: 's', value: 'abc' }], 's')).toBe('abc');
    expect(joinChunkedCookie([{ name: 's.1', value: 'B' }, { name: 's.0', value: 'A' }, { name: 'other', value: 'x' }], 's')).toBe('AB');
    expect(joinChunkedCookie([{ name: 'other', value: 'x' }], 's')).toBeNull();
  });
});

describe('accountRowFromProvider', () => {
  it('keeps only the Account columns and drops provider extras', () => {
    const row = accountRowFromProvider({ provider: 'discord', type: 'oauth', providerAccountId: '42', access_token: 'tok', expires_at: 1700000000, expires_in: 604800, scope: 'identify email', guilds: [] }, 'u1');
    expect(row).toEqual({
      userId: 'u1', type: 'oauth', provider: 'discord', providerAccountId: '42', refresh_token: undefined, access_token: 'tok',
      expires_at: 1700000000, token_type: undefined, scope: 'identify email', id_token: undefined, session_state: undefined,
    });
    expect('expires_in' in row).toBe(false);
  });
});
