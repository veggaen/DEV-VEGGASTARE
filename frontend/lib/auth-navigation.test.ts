/** @fileOverview Regression tests for auth origin and redirect safety. @stability stable */
import { describe, expect, it } from 'vitest';
import { authOrigin, safeAuthRedirect } from './auth-navigation';

describe('authentication navigation', () => {
  it('keeps local production-build email links on port 3000', () => {
    expect(authOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(authOrigin('https://www.veggat.com/')).toBe('https://www.veggat.com');
  });
  it.each(['http://localhost:3100', 'http://veggat.com', 'https://name:secret@veggat.com', 'javascript:alert(1)'])('rejects unsafe origins: %s', value => {
    expect(() => authOrigin(value)).toThrow();
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', '/auth/login', '/api/auth/signout'])('rejects unsafe callbacks: %s', value => {
    expect(safeAuthRedirect(value)).toBe('/products');
  });
  it('preserves internal deep links', () => {
    expect(safeAuthRedirect('/products/item?tab=details#buy')).toBe('/products/item?tab=details#buy');
  });
});
