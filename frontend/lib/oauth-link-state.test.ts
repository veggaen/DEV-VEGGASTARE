/** @fileOverview Verification badges require account and flag evidence. @stability stable */
import { describe, expect, it } from 'vitest';
import { isOAuthProvider, oauthLinkState, oauthLinkFeedback, OAUTH_PROVIDERS } from './oauth-link-state';

describe('OAuth verification presentation', () => {
  it.each(['__proto__', 'constructor', '', null, ['github']])('rejects unknown provider %s', value => expect(isOAuthProvider(value)).toBe(false));
  for (const provider of ['google', 'github', 'discord'] as const) {
    const state = { flags: { [OAUTH_PROVIDERS[provider].flag]: false }, linkedProviders: [provider], pendingProviders: [] as string[] };
    it(`${provider}: distinguishes missing, expired, pending and verified`, () => {
      expect(oauthLinkState(provider, state)).toBe('unconfirmed');
      expect(oauthLinkFeedback(provider, state)).toContain('not verified');
      expect(oauthLinkState(provider, { ...state, pendingProviders: [provider] })).toBe('pending');
      expect(oauthLinkState(provider, { ...state, flags: { [OAUTH_PROVIDERS[provider].flag]: true } })).toBe('verified');
      expect(oauthLinkState(provider, { ...state, flags: { [OAUTH_PROVIDERS[provider].flag]: true }, linkedProviders: [] })).toBe('disconnected');
    });
  }
  it('does not invent verification for other account types', () => expect(oauthLinkState('wallet', { flags: {}, linkedProviders: ['wallet'], pendingProviders: [] })).toBe('connected'));
});
