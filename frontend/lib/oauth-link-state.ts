/** @fileOverview Shared, evidence-based OAuth verification states. @stability stable */
export const OAUTH_PROVIDERS = {
  google: { label: 'Google', flag: 'hasGoogleAuth' },
  github: { label: 'GitHub', flag: 'hasGithubAuth' },
  discord: { label: 'Discord', flag: 'hasDiscordAuth' },
} as const;
export type OAuthProvider = keyof typeof OAUTH_PROVIDERS;
export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === 'string' && Object.hasOwn(OAUTH_PROVIDERS, value);
}
export interface OAuthVerificationState {
  flags: Partial<Record<typeof OAUTH_PROVIDERS[OAuthProvider]['flag'], boolean>>;
  linkedProviders: string[];
  pendingProviders: string[];
}
export function oauthLinkState(provider: string, data: OAuthVerificationState) {
  if (!data.linkedProviders.includes(provider)) return 'disconnected';
  if (!isOAuthProvider(provider)) return 'connected';
  if (data.flags[OAUTH_PROVIDERS[provider].flag] === true) return 'verified';
  return data.pendingProviders.includes(provider) ? 'pending' : 'unconfirmed';
}
export function oauthLinkFeedback(provider: OAuthProvider, data: OAuthVerificationState) {
  const label = OAUTH_PROVIDERS[provider].label;
  switch (oauthLinkState(provider, data)) {
    case 'verified': return `${label} is connected and verified.`;
    case 'pending': return `${label} is connected. Email confirmation is still required.`;
    case 'unconfirmed': return `${label} is connected but not verified. Request a new confirmation email.`;
    default: return `${label} linking did not finish. Try connecting again.`;
  }
}
