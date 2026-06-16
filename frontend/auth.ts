import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { cookies } from "next/headers"

import { dbPrisma } from "@/lib/db"
import authConfig from "@/auth.config"
import { UserRole } from "@/generated/prisma/browser"
import { getUserById } from "@/data/user"
import { getTwoFactorConfirmationByUserId } from "@/data/two-factor-confirmation"
import { getAccountByUserId } from "./lib/account"
import { recalculateVerificationTier } from "@/lib/verification-recalc"
import { sendOauthLinkConfirmationEmail } from "@/lib/mail"


// Console.log PREFIX
const LOG_PREFIX = '[auth.ts] '
const isDev = process.env.NODE_ENV !== 'production'
const requireOauthEmailConfirmation =
  process.env.OAUTH_LINK_REQUIRE_EMAIL_CONFIRMATION === 'true' ||
  (!isDev && process.env.OAUTH_LINK_REQUIRE_EMAIL_CONFIRMATION !== 'false');

type IdentitySource = 'AUTO' | 'MANUAL' | 'GOOGLE' | 'GITHUB' | 'DISCORD';
type IdentityEmailMode = 'PRIMARY' | 'HIDE';
type IdentityProvider = 'google' | 'github' | 'discord';

function sourceToProvider(source?: IdentitySource): IdentityProvider | null {
  if (source === 'GOOGLE') return 'google';
  if (source === 'GITHUB') return 'github';
  if (source === 'DISCORD') return 'discord';
  return null;
}

function getProviderProfile(user: {
  googleProfileName?: string | null;
  googleProfileImage?: string | null;
  githubProfileName?: string | null;
  githubProfileImage?: string | null;
  discordProfileName?: string | null;
  discordProfileImage?: string | null;
}, provider: IdentityProvider) {
  if (provider === 'google') {
    return {
      name: user.googleProfileName ?? null,
      image: user.googleProfileImage ?? null,
    };
  }
  if (provider === 'github') {
    return {
      name: user.githubProfileName ?? null,
      image: user.githubProfileImage ?? null,
    };
  }
  return {
    name: user.discordProfileName ?? null,
    image: user.discordProfileImage ?? null,
  };
}

function resolveDisplayName(user: {
  name?: string | null;
  googleProfileName?: string | null;
  githubProfileName?: string | null;
  discordProfileName?: string | null;
}, source: IdentitySource | undefined, lastAuthProvider?: string): string | null {
  if (source === 'MANUAL') return user.name ?? null;

  const explicitProvider = sourceToProvider(source);
  if (explicitProvider) {
    return getProviderProfile(user, explicitProvider).name ?? user.name ?? null;
  }

  const authProvider =
    lastAuthProvider === 'google' || lastAuthProvider === 'github' || lastAuthProvider === 'discord'
      ? lastAuthProvider
      : null;

  if (authProvider) {
    const providerName = getProviderProfile(user, authProvider).name;
    if (providerName) return providerName;
  }

  return (
    user.name ??
    user.googleProfileName ??
    user.githubProfileName ??
    user.discordProfileName ??
    null
  );
}

function resolveDisplayImage(user: {
  image?: string | null;
  googleProfileImage?: string | null;
  githubProfileImage?: string | null;
  discordProfileImage?: string | null;
}, source: IdentitySource | undefined, lastAuthProvider?: string): string | null {
  if (source === 'MANUAL') return user.image ?? null;

  const explicitProvider = sourceToProvider(source);
  if (explicitProvider) {
    return getProviderProfile(user, explicitProvider).image ?? user.image ?? null;
  }

  const authProvider =
    lastAuthProvider === 'google' || lastAuthProvider === 'github' || lastAuthProvider === 'discord'
      ? lastAuthProvider
      : null;

  if (authProvider) {
    const providerImage = getProviderProfile(user, authProvider).image;
    if (providerImage) return providerImage;
  }

  return (
    user.image ??
    user.googleProfileImage ??
    user.githubProfileImage ??
    user.discordProfileImage ??
    null
  );
}

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL

if (!isDev && !authSecret) {
  console.error(`${LOG_PREFIX} Missing AUTH_SECRET (or NEXTAUTH_SECRET). OAuth will fail.`)
}

if (!isDev && !authUrl) {
  console.warn(`${LOG_PREFIX} Missing AUTH_URL (or NEXTAUTH_URL). Set it to https://www.veggat.com for production.`)
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut
} = NextAuth({
    secret: authSecret,
    trustHost: true,
    debug: false,
    pages: {
      signIn: '/auth/login',
      error: '/auth/error',
    },
    // Cookie config — use NextAuth's DEFAULT names (authjs.*). We previously
    // renamed the session cookie to a versioned name to dodge the old
    // JWTSessionError, but that desynced the edge middleware (which detects auth
    // by cookie name) and created a cascade of "logged-in seen as logged-out"
    // bugs. The original JWT-decryption error is long gone (the next-auth upgrade
    // shipped weeks ago), so defaults are correct and self-consistent now.
    //
    // We still define the OAuth security-check cookies (pkceCodeVerifier, state,
    // nonce) explicitly with consistent secure attributes, because leaving them
    // implicit caused "InvalidCheck: pkceCodeVerifier value could not be parsed"
    // on the GitHub/Discord (OAuth+PKCE) callbacks.
    cookies: (() => {
      const secure = process.env.AUTH_URL?.startsWith('https') ?? false;
      const prefix = secure ? '__Secure-' : '';
      const base = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
      return {
        sessionToken: { name: `${prefix}authjs.session-token`, options: base },
        pkceCodeVerifier: {
          name: `${prefix}authjs.pkce.code_verifier`,
          options: { ...base, maxAge: 60 * 15 },
        },
        state: { name: `${prefix}authjs.state`, options: { ...base, maxAge: 60 * 15 } },
        nonce: { name: `${prefix}authjs.nonce`, options: base },
      };
    })(),
    events: {
      async signOut(message){
        //console.log(`event.signOut token:`,message)

        if ('token' in message && message.token) {
          const token = await message.token;
          // signOut event fires for every logout — DO NOT delete Account records here.
          // OAuth Account records are permanent links and should only be removed
          // via explicit "unlink" actions (/api/auth/unlink-oauth).
          // Previously this code deleted the oldest Account on every sign-out,
          // which broke OAuth provider linking, the AppKit→NextAuth auto-bridge,
          // and the verification tier system.
          void token; // keep for future use (e.g. audit logging)
        }

      },
      async linkAccount({ user, profile, account }){
        const provider = account.provider as 'google' | 'github' | 'discord' | string;
        const profileAny = profile as Record<string, unknown> | null;
        const providerProfileName =
          typeof profileAny?.name === 'string'
            ? profileAny.name
            : typeof user?.name === 'string'
              ? user.name
              : undefined;
        const providerProfileImage =
          typeof profileAny?.image === 'string'
            ? profileAny.image
            : typeof profileAny?.picture === 'string'
              ? profileAny.picture
              : typeof profileAny?.avatar_url === 'string'
                ? profileAny.avatar_url
                : typeof user?.image === 'string'
                  ? user.image
                  : undefined;
        const providerProfileEmail =
          typeof profileAny?.email === 'string'
            ? profileAny.email
            : typeof user?.email === 'string'
              ? user.email
              : undefined;

        // Mark emailVerified, but DO NOT clobber existing identity fields on link.
        // Users may have intentionally customized name/avatar/email in settings.
        // We only backfill missing values from the OAuth profile.
        if (user?.id) {
          const current = await dbPrisma.user.findUnique({
            where: { id: user.id },
            select: { name: true, image: true, email: true },
          });

          await dbPrisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: new Date(),
              name: current?.name ?? user.name ?? profile.name ?? undefined,
              image: current?.image ?? profile.image ?? user.image ?? undefined,
              email: current?.email ?? user.email ?? undefined,
              ...(provider === 'google'
                ? {
                    googleProfileName: providerProfileName,
                    googleProfileImage: providerProfileImage,
                    googleProfileEmail: providerProfileEmail,
                  }
                : {}),
              ...(provider === 'github'
                ? {
                    githubProfileName: providerProfileName,
                    githubProfileImage: providerProfileImage,
                    githubProfileEmail: providerProfileEmail,
                  }
                : {}),
              ...(provider === 'discord'
                ? {
                    discordProfileName: providerProfileName,
                    discordProfileImage: providerProfileImage,
                    discordProfileEmail: providerProfileEmail,
                  }
                : {}),
            }
          });
        }

        // For named OAuth providers: create a pending link record and send confirmation email.
        // hasXxxAuth is only set to true after the user clicks the confirm link in the email.
        if (
          user?.id &&
          user.email &&
          (provider === 'google' || provider === 'github' || provider === 'discord')
        ) {
          if (!requireOauthEmailConfirmation) {
            const flagKey =
              provider === 'google'
                ? 'hasGoogleAuth'
                : provider === 'github'
                  ? 'hasGithubAuth'
                  : 'hasDiscordAuth';

            await dbPrisma.user.update({
              where: { id: user.id },
              data: { [flagKey]: true },
            });
            await dbPrisma.pendingOAuthLink.deleteMany({
              where: { userId: user.id, provider },
            });
            await recalculateVerificationTier(user.id, { [flagKey]: true });
            return;
          }

          // Upsert: replace any existing pending record for this provider (e.g. re-linking)
          const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
          const pending = await dbPrisma.pendingOAuthLink.upsert({
            where: { userId_provider: { userId: user.id, provider } },
            update: { token: crypto.randomUUID(), expires },
            create: { userId: user.id, provider, expires },
          });

          try {
            await sendOauthLinkConfirmationEmail(user.email, {
              provider: provider as 'google' | 'github' | 'discord',
              userName: user.name,
              token: pending.token,
            });
          } catch (err) {
            console.error(`${LOG_PREFIX} linkAccount: failed to send confirmation email`, err);
          }
        }
      },
    },
    callbacks: {
        async signIn({ user, account, profile, email, credentials }) {
          if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn`);

          // Allow OAuth without email verification. Consider a change to this logic if in the future we want to be adding more login providers
          if ( account?.provider !== 'credentials' ){
            if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn: OAuth provider`)
            return true;
          }
          
          if (user.id) {
            const existingUser = await getUserById(user.id);
            // Prevent sign in without email verification aka 1fa check
            if (!existingUser?.emailVerified){
              if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn: email not verified`)
              return false;
            };
            // 2fa check
            if ( existingUser.isTwoFactorEnabled ) {
              const twoFactorConfirmation = await getTwoFactorConfirmationByUserId(existingUser.id)
              if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn: 2fa check`)
              if (!twoFactorConfirmation) return false

              // Reject if the 2FA confirmation is older than 10 minutes
              const TEN_MINUTES_MS = 10 * 60 * 1000;
              const confirmationAge = Date.now() - new Date(twoFactorConfirmation.createdAt).getTime();
              if (confirmationAge > TEN_MINUTES_MS) {
                if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn: 2fa confirmation expired (${Math.round(confirmationAge / 1000)}s old)`);
                await dbPrisma.twoFactorConfirmation.delete({
                  where: { id: twoFactorConfirmation.id }
                });
                return false;
              }
              
              // delete two factor confirmation for next sign in
              await dbPrisma.twoFactorConfirmation.delete({
                where: { id: twoFactorConfirmation.id }
              });

            };
          } // unsure if I should add a 'return false' in a 'else' statment here or just continue to return true below. Reason, no 'user.id' being present?
          
          return true;
        },
        async session({ session, user, token }) {
          // If JWT was invalidated (user deleted or tokenVersion mismatch),
          // clear the session so the client detects it as logged-out
          if (!token.sub) {
            return session;
          }

          if (token.sub && session.user) {
            session.user.id = token.sub as string;
          }; 

          if (session.user ) {
            session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean;
          };
          
          if (token.referredBy && session.user ) {
            session.user.referredBy = token.referredBy as string;
          };

          if (token.role && session.user ) {
            session.user.role = token.role as UserRole;
          };

          if (token.name && session.user ) {
            session.user.name = token.name as string;
          };

          if (token.email && session.user ) {
            session.user.email = token.email as string;
          };

          if (token.image && session.user ) {
            session.user.image = token.image as string;
          };
          
          if (token.isOAuth && session.user ) {
            session.user.isOAuth = token.isOAuth as boolean;
          };

			if (session.user) {
				session.user.web3ModeEnabled = token.web3ModeEnabled as boolean;
			}

          if (session.user) {
            session.user.identityNameSource = token.identityNameSource as IdentitySource | undefined;
            session.user.identityImageSource = token.identityImageSource as IdentitySource | undefined;
            session.user.emailDisplayMode = token.emailDisplayMode as IdentityEmailMode | undefined;

            if (typeof token.displayName === 'string' || token.displayName === null) {
              session.user.name = (token.displayName as string | null) ?? session.user.name;
            }
            if (typeof token.displayImage === 'string' || token.displayImage === null) {
              session.user.image = (token.displayImage as string | null) ?? session.user.image;
            }
          }

          // Pass impersonation info through to the session
          if (session.user) {
            session.user.isImpersonating = token.isImpersonating as boolean || false;
            session.user.impersonatingFromId = token.impersonatingFromId as string | undefined;
            session.user.impersonatingFromName = token.impersonatingFromName as string | undefined;
          }
          
          //console.log(`${LOG_PREFIX} callbacks.session: `,{session, sessionToken: token})
          return session
        },
        async jwt({ token, user, account, profile, isNewUser }) {

          if (!token.sub) return token;

          // ── Impersonation check ──────────────────────────────────────
          // If the OWNER has started an impersonation session, the JWT
          // callback swaps the token to represent the target user while
          // preserving the owner's original identity in extra fields.
          try {
            const cookieStore = await cookies();
            const impersonateOwnerId  = cookieStore.get('x-impersonate-owner-id')?.value;
            const impersonateOwnerName = cookieStore.get('x-impersonate-owner-name')?.value;
            const impersonateTargetId = cookieStore.get('x-impersonate-target-id')?.value;

            if (impersonateOwnerId && impersonateTargetId) {
              // Load the target user
              const targetUser = await getUserById(impersonateTargetId);
              if (targetUser) {
                const targetAccount = await getAccountByUserId(targetUser.id);
                
                // Swap the token to represent the target user
                token.sub = targetUser.id;
                token.isTwoFactorEnabled = targetUser.isTwoFactorEnabled;
                token.referredBy = targetUser.referredBy;
                token.role = targetUser.role;
                token.name = targetUser.name;
                token.email = targetUser.email;
                token.image = targetUser.image;
                token.isOAuth = !!targetAccount;
                token.web3ModeEnabled = targetUser.web3ModeEnabled;

                // Attach impersonation metadata so the session knows
                token.isImpersonating = true;
                token.impersonatingFromId = impersonateOwnerId;
                token.impersonatingFromName = impersonateOwnerName || 'Owner';

                return token;
              }
            }
          } catch {
            // cookies() can throw in edge cases (e.g. during build);
            // fall through to normal flow
          }

          // ── Normal flow ──────────────────────────────────────────────
          // Run both DB lookups in parallel to halve latency to remote DB
          const [existingUser, existingAccount] = await Promise.all([
            getUserById(token.sub),
            getAccountByUserId(token.sub),
          ]);

          // If user was deleted (e.g. DB wipe), invalidate the session
          if (!existingUser) {
            if (isDev) console.log(`${LOG_PREFIX} jwt: user ${token.sub} not found — invalidating session`);
            return { ...token, sub: undefined, email: undefined, name: undefined };
          }

          // Session versioning: if tokenVersion changed, force re-login
          // Increment User.tokenVersion to invalidate all existing sessions
          if (
            typeof token.tokenVersion === 'number' &&
            existingUser.tokenVersion !== token.tokenVersion
          ) {
            if (isDev) console.log(`${LOG_PREFIX} jwt: tokenVersion mismatch for ${token.sub} — forcing re-login`);
            return { ...token, sub: undefined, email: undefined, name: undefined };
          }

          token.isTwoFactorEnabled = existingUser.isTwoFactorEnabled;
          token.referredBy = existingUser.referredBy;
          token.role = existingUser.role;
          token.name = existingUser.name;
          token.email = existingUser.email;
          token.image = existingUser.image;
          token.isOAuth = !!existingAccount;
          token.web3ModeEnabled = existingUser.web3ModeEnabled;
          token.identityNameSource = (existingUser.identityNameSource as IdentitySource | null) ?? 'AUTO';
          token.identityImageSource = (existingUser.identityImageSource as IdentitySource | null) ?? 'AUTO';
          token.emailDisplayMode = (existingUser.emailDisplayMode as IdentityEmailMode | null) ?? 'PRIMARY';

          if (account?.provider === 'google' || account?.provider === 'github' || account?.provider === 'discord') {
            token.lastAuthProvider = account.provider;
          }

          token.displayName = resolveDisplayName(
            existingUser,
            token.identityNameSource as IdentitySource | undefined,
            token.lastAuthProvider as string | undefined,
          );
          token.displayImage = resolveDisplayImage(
            existingUser,
            token.identityImageSource as IdentitySource | undefined,
            token.lastAuthProvider as string | undefined,
          );
          token.tokenVersion = existingUser.tokenVersion;

          // Clear impersonation flags in normal mode
          token.isImpersonating = false;
          token.impersonatingFromId = undefined;
          token.impersonatingFromName = undefined;
          
          /* const logResponse = token.email // shortens the response, remove */
          /* console.log(`${LOG_PREFIX} callbacks.jwt.token: `,{logResponse}) */
          return token
        }
    },
    adapter: PrismaAdapter(dbPrisma),
    session: {strategy: 'jwt'},
  ...authConfig,
})