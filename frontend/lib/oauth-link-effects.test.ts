/** @fileOverview OAuth linking cannot verify another email or notify the wrong identity. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), pending: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findUnique: mock.find, update: mock.update }, pendingOAuthLink: { upsert: mock.pending } } }));
vi.mock('@/lib/mail', () => ({ sendOauthLinkConfirmationEmail: mock.send }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: vi.fn() }));
vi.stubEnv('OAUTH_LINK_REQUIRE_EMAIL_CONFIRMATION', 'true');
const { applyOauthLinkEffects } = await import('./oauth-link-effects');
const input = { userId: 'owner', userEmail: 'provider@example.test', userName: 'Provider name', userImage: null, provider: 'discord', profile: { email: 'provider@example.test', verified: true } };
beforeEach(() => {
  vi.clearAllMocks();
  mock.find.mockResolvedValue({ name: 'Account owner', email: 'primary@example.test', image: null });
  mock.update.mockResolvedValue({}); mock.pending.mockResolvedValue({ token: 'test-confirmation' }); mock.send.mockResolvedValue(undefined);
});
describe('OAuth identity effects', () => {
  it('keeps the primary email unverified when the provider uses another address', async () => {
    await applyOauthLinkEffects(input);
    expect(mock.update.mock.calls[0][0].data).not.toHaveProperty('emailVerified');
    expect(mock.send).toHaveBeenCalledWith('primary@example.test', expect.objectContaining({ userName: 'Account owner' }));
  });
  it('verifies a matching provider email', async () => {
    await applyOauthLinkEffects({ ...input, profile: { email: 'PRIMARY@example.test', verified: true } });
    expect(mock.update.mock.calls[0][0].data.emailVerified).toBeInstanceOf(Date);
  });
  it('does not verify an explicitly unverified provider email', async () => {
    await applyOauthLinkEffects({ ...input, profile: { email: 'primary@example.test', verified: false } });
    expect(mock.update.mock.calls[0][0].data).not.toHaveProperty('emailVerified');
  });
});
