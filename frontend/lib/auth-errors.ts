/** @fileOverview Public authentication feedback; never echo provider diagnostics. @stability stable */
const MESSAGES: Readonly<Record<string, string>> = {
  OAuthSignin: 'Could not start sign-in. Try again or choose another method.',
  OAuthSignInError: 'Could not start sign-in. Try again or choose another method.',
  OAuthCallbackError: 'Sign-in did not finish. Try again or choose another method.',
  CallbackRouteError: 'Sign-in did not finish. Try again or choose another method.',
  InvalidCheck: 'Your sign-in session expired. Please start again.',
  AccessDenied: 'Sign-in was cancelled or access was not granted. Choose a method to try again.',
  Configuration: 'This sign-in method is not available right now. Try another method, or explore the free demo without an account.',
  Verification: 'This sign-in link is invalid or expired. Please request a new one.',
  CredentialsSignin: 'Email or password is incorrect. Please try again.',
  SessionRequired: 'Please sign in to continue.',
  OAuthAccountNotLinked: 'This email uses a different sign-in method. Sign in using the method you originally chose, then manage linked accounts in Settings.',
  OAuthAccountLinkedElsewhere: 'That account is already linked to a different Veggat user. Unlink it there first, or use another account.',
};

export function authErrorMessage(code?: string | null): string | undefined {
  if (!code) return undefined;
  return Object.hasOwn(MESSAGES, code)
    ? MESSAGES[code]
    : 'Sign-in did not finish. Try again or choose another method.';
}
