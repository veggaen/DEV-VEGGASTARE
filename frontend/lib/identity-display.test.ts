import { describe, expect, it } from 'vitest';
import { identityImageSources, resolveDisplayImage, resolveDisplayName, sourceToProvider } from './identity-display';

const user = {
  name: 'Manual Name', image: 'https://cdn.example/manual.png',
  googleProfileName: 'Google Name', googleProfileImage: 'https://cdn.example/google.png',
  githubProfileName: 'GitHub Name', githubProfileImage: 'https://cdn.example/github.png',
  discordProfileName: null, discordProfileImage: null,
};

describe('resolveDisplayImage', () => {
  it('MANUAL shows the uploaded picture even when the session signed in with a provider', () => {
    expect(resolveDisplayImage(user, 'MANUAL', 'google')).toBe(user.image);
  });
  it('an explicit provider wins, falling back to the upload when that provider has none', () => {
    expect(resolveDisplayImage(user, 'GITHUB', 'google')).toBe(user.githubProfileImage);
    expect(resolveDisplayImage(user, 'DISCORD', 'google')).toBe(user.image);
  });
  it('AUTO follows the provider this session signed in with, then whatever the account has', () => {
    expect(resolveDisplayImage(user, 'AUTO', 'github')).toBe(user.githubProfileImage);
    expect(resolveDisplayImage(user, 'AUTO', 'discord')).toBe(user.image);
    expect(resolveDisplayImage(user, 'AUTO', undefined)).toBe(user.image);
    expect(resolveDisplayImage({ ...user, image: null }, undefined, null)).toBe(user.googleProfileImage);
    expect(resolveDisplayImage({}, 'AUTO')).toBeNull();
  });
});

describe('resolveDisplayName', () => {
  it('mirrors the image rules', () => {
    expect(resolveDisplayName(user, 'MANUAL', 'google')).toBe('Manual Name');
    expect(resolveDisplayName(user, 'GOOGLE')).toBe('Google Name');
    expect(resolveDisplayName(user, 'AUTO', 'github')).toBe('GitHub Name');
    expect(resolveDisplayName({ googleProfileName: 'Only Google' }, 'AUTO')).toBe('Only Google');
  });
});

describe('identityImageSources / sourceToProvider', () => {
  it('lists every picture the account can show, null where a method has none', () => {
    expect(identityImageSources(user)).toEqual({ manual: user.image, google: user.googleProfileImage, github: user.githubProfileImage, discord: null });
    expect(identityImageSources({})).toEqual({ manual: null, google: null, github: null, discord: null });
  });
  it('maps sources to providers and nothing else', () => {
    expect(sourceToProvider('GOOGLE')).toBe('google');
    expect(sourceToProvider('MANUAL')).toBeNull();
    expect(sourceToProvider(undefined)).toBeNull();
  });
});
