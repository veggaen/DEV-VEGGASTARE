/** @fileOverview Regression checks for the installed Auth.js token parser. @stability stable */
import { describe, expect, it } from 'vitest';
import { encode, getToken } from 'next-auth/jwt';

const secret = 'disposable-unit-test-secret-not-an-app-credential';
const cookieName = 'authjs.session-token';

describe('Auth.js security patch regressions', () => {
  it.each(['%', '%E0%A4%A', '%GG', 'not-a-jwt'])('rejects malformed Bearer %s without throwing', async value => {
    const req = new Request('http://localhost:3000/api/private', { headers: { Authorization: `Bearer ${value}` } });
    await expect(getToken({ req, secret, cookieName })).resolves.toBeNull();
  });

  it('still reads valid encrypted session cookies and rejects a different secret', async () => {
    const token = await encode({ token: { sub: 'synthetic-security-test' }, secret, salt: cookieName });
    const req = new Request('http://localhost:3000/api/private', { headers: { Cookie: `${cookieName}=${token}` } });
    expect((await getToken({ req, secret, cookieName }))?.sub).toBe('synthetic-security-test');
    await expect(getToken({ req, secret: 'different-disposable-test-secret', cookieName })).resolves.toBeNull();
  });
});
