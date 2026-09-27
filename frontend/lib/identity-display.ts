/**
 * @fileOverview  One account, many sign-in methods. A user record carries the
 *                picture and name each linked provider gave us, plus what the
 *                user uploaded themselves; `identityNameSource` /
 *                `identityImageSource` say which one to show. This module is
 *                the single resolver, shared by the session (auth.ts) and the
 *                profile API so the header and the profile page never disagree.
 *
 *                Banner and bio live on the user record only, so they are
 *                already shared across every linked sign-in method.
 * @stability     stable
 */

export type IdentitySource = 'AUTO' | 'MANUAL' | 'GOOGLE' | 'GITHUB' | 'DISCORD';
export type IdentityEmailMode = 'PRIMARY' | 'HIDE';
export type IdentityProvider = 'google' | 'github' | 'discord';

export const IDENTITY_SOURCES: readonly IdentitySource[] = ['AUTO', 'MANUAL', 'GOOGLE', 'GITHUB', 'DISCORD'];

export interface IdentityImageFields {
  image?: string | null;
  googleProfileImage?: string | null;
  githubProfileImage?: string | null;
  discordProfileImage?: string | null;
}

export interface IdentityNameFields {
  name?: string | null;
  googleProfileName?: string | null;
  githubProfileName?: string | null;
  discordProfileName?: string | null;
}

export function sourceToProvider(source?: IdentitySource | null): IdentityProvider | null {
  if (source === 'GOOGLE') return 'google';
  if (source === 'GITHUB') return 'github';
  if (source === 'DISCORD') return 'discord';
  return null;
}

function asProvider(value?: string | null): IdentityProvider | null {
  return value === 'google' || value === 'github' || value === 'discord' ? value : null;
}

function getProviderProfile(user: IdentityNameFields & IdentityImageFields, provider: IdentityProvider) {
  if (provider === 'google') return { name: user.googleProfileName ?? null, image: user.googleProfileImage ?? null };
  if (provider === 'github') return { name: user.githubProfileName ?? null, image: user.githubProfileImage ?? null };
  return { name: user.discordProfileName ?? null, image: user.discordProfileImage ?? null };
}

export function resolveDisplayName(user: IdentityNameFields, source: IdentitySource | undefined | null, lastAuthProvider?: string | null): string | null {
  if (source === 'MANUAL') return user.name ?? null;
  const explicit = sourceToProvider(source);
  if (explicit) return getProviderProfile(user, explicit).name ?? user.name ?? null;
  const authProvider = asProvider(lastAuthProvider);
  if (authProvider) {
    const providerName = getProviderProfile(user, authProvider).name;
    if (providerName) return providerName;
  }
  return user.name ?? user.googleProfileName ?? user.githubProfileName ?? user.discordProfileName ?? null;
}

export function resolveDisplayImage(user: IdentityImageFields, source: IdentitySource | undefined | null, lastAuthProvider?: string | null): string | null {
  if (source === 'MANUAL') return user.image ?? null;
  const explicit = sourceToProvider(source);
  if (explicit) return getProviderProfile(user, explicit).image ?? user.image ?? null;
  const authProvider = asProvider(lastAuthProvider);
  if (authProvider) {
    const providerImage = getProviderProfile(user, authProvider).image;
    if (providerImage) return providerImage;
  }
  return user.image ?? user.googleProfileImage ?? user.githubProfileImage ?? user.discordProfileImage ?? null;
}

/** Every picture this account can show, keyed by the source that selects it. Null = nothing there. */
export function identityImageSources(user: IdentityImageFields) {
  return {
    manual: user.image ?? null,
    google: user.googleProfileImage ?? null,
    github: user.githubProfileImage ?? null,
    discord: user.discordProfileImage ?? null,
  };
}
export type IdentityImageSources = ReturnType<typeof identityImageSources>;
