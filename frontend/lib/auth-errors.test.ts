/** @fileOverview Public auth failures remain actionable without exposing provider data. @stability stable */
import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

describe('public authentication feedback', () => {
  it.each([undefined, null, ''])('does not invent an error when absent: %s', value => {
    expect(authErrorMessage(value)).toBeUndefined();
  });
  it.each(['OAuthSignin', 'OAuthSignInError', 'OAuthCallbackError', 'CallbackRouteError',
    'InvalidCheck', 'AccessDenied', 'Configuration', 'Verification', 'CredentialsSignin', 'SessionRequired'])
  ('gives a recovery action for %s', code => {
    expect(authErrorMessage(code)).toMatch(/try|choose|start|request|sign in/i);
    expect(authErrorMessage(code)).not.toContain(code);
  });
  it('preserves safe existing-account linking instructions', () => {
    expect(authErrorMessage('OAuthAccountNotLinked')).toContain('method you originally chose');
    expect(authErrorMessage('OAuthAccountNotLinked')).toContain('Settings');
  });
  it.each(['__proto__', 'constructor', 'toString', '<script>private-provider-detail</script>', 'secret-code-'.repeat(100)])
  ('does not echo unknown or inherited keys: %s', code => {
    expect(authErrorMessage(code)).toBe('Sign-in did not finish. Try again or choose another method.');
  });
});
