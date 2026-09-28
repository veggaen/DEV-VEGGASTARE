import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { isDemoUserId } from "@/lib/demo-policy"
import { previewSessionId, validImpersonation, validPreviewSession } from '@/lib/impersonation-policy';
import { revokePreviewOnSignOut } from '@/lib/preview-signout';

import { dbPrisma } from "@/lib/db"
import authConfig from "@/auth.config"
import { UserRole } from "@/generated/prisma/browser"
import { getUserById } from "@/data/user"
import { getAccountByUserId } from "./lib/account"
import { applyOauthLinkEffects, isLinkableProvider } from "@/lib/oauth-link-effects"
import { accountRowFromProvider, currentSessionUserId, linkOauthAccountToUser } from "@/lib/oauth-account-link"
import {
  SESSION_COOKIE_NAME,
  PKCE_COOKIE_NAME,
  STATE_COOKIE_NAME,
  NONCE_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
} from "@/lib/auth-cookies"


// Console.log PREFIX
const LOG_PREFIX = '[auth.ts] '
const isDev = process.env.NODE_ENV !== 'production'

import { resolveDisplayImage, resolveDisplayName, type IdentityEmailMode, type IdentitySource } from '@/lib/identity-display';
import type { ExtendedUser } from '@/next-auth';

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
    cookies: {
      // Names come from lib/auth-cookies.ts — the SAME module the edge
      // middleware reads — so the two can never drift apart again.
      sessionToken: { name: SESSION_COOKIE_NAME, options: AUTH_COOKIE_OPTIONS },
      pkceCodeVerifier: {
        name: PKCE_COOKIE_NAME,
        options: { ...AUTH_COOKIE_OPTIONS, maxAge: 60 * 15 },
      },
      state: { name: STATE_COOKIE_NAME, options: { ...AUTH_COOKIE_OPTIONS, maxAge: 60 * 15 } },
      nonce: { name: NONCE_COOKIE_NAME, options: AUTH_COOKIE_OPTIONS },
    },
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
          await revokePreviewOnSignOut(token);
        }

      },
      async linkAccount({ user, profile, account }){
        // Profile backfill + pending confirmation live in lib/oauth-link-effects.ts,
        // shared with the "link to the signed-in user" path in callbacks.signIn.
        await applyOauthLinkEffects({
          userId: user?.id,
          userEmail: user?.email ?? null,
          userName: user?.name ?? null,
          userImage: user?.image ?? null,
          provider: account.provider,
          profile: (profile ?? null) as Record<string, unknown> | null,
        });
      },
    },
    callbacks: {
        async signIn({ user, account, profile, email, credentials }) {
          if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn`);

          // Allow OAuth without email verification. Consider a change to this logic if in the future we want to be adding more login providers
          if ( account?.provider !== 'credentials' ){
            if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn: OAuth provider`)

            // "Link Google/GitHub/Discord" from Settings: a session already exists in this browser.
            // Auth.js would otherwise match by email (refused) or register a new user; instead
            // attach the provider to the signed-in user and go straight back to Settings.
            // Returning a URL aborts the sign-in, so the current session stays as it is.
            if (account && isLinkableProvider(account.provider)) {
              const currentUserId = await currentSessionUserId(authSecret);
              if (currentUserId) {
                if (isDemoUserId(currentUserId)) return '/settings?section=verification&oauthError=AccessDenied';
                const decision = await linkOauthAccountToUser({
                  currentUserId,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  findOwner: async (provider, providerAccountId) =>
                    (await dbPrisma.account.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId } }, select: { userId: true } }))?.userId ?? null,
                  link: async () => {
                    await dbPrisma.account.create({ data: accountRowFromProvider(account as unknown as Record<string, unknown>, currentUserId) });
                    await applyOauthLinkEffects({
                      userId: currentUserId,
                      userEmail: user?.email ?? null,
                      userName: user?.name ?? null,
                      userImage: user?.image ?? null,
                      provider: account.provider,
                      profile: (profile ?? null) as Record<string, unknown> | null,
                    });
                  },
                });
                if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn: linked ${account.provider} to the signed-in user (${decision})`);
                if (decision === 'linked-elsewhere') return '/settings?section=verification&oauthError=OAuthAccountLinkedElsewhere';
                return `/settings?section=verification&oauthConfirm=${account.provider}`;
              }
            }
            return true;
          }
          
          if (user.id) {
            const existingUser = await getUserById(user.id);
            // Prevent sign in without email verification aka 1fa check
            if (!existingUser?.emailVerified){
              if (isDev) console.log(`${LOG_PREFIX} callbacks.signIn: email not verified`)
              return false;
            };
            // The credentials provider has already consumed this request's 2FA code.
          } // unsure if I should add a 'return false' in a 'else' statment here or just continue to return true below. Reason, no 'user.id' being present?
          
          return true;
        },
        async session({ session, user, token }) {
          // If JWT was invalidated (user deleted or tokenVersion mismatch),
          // clear the session so the client detects it as logged-out
          if (!token.sub) {
            return { ...session, user: undefined };
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
            session.user.lastAuthProvider = token.lastAuthProvider as ExtendedUser['lastAuthProvider'];

            if (typeof token.displayName === 'string' || token.displayName === null) {
              session.user.name = (token.displayName as string | null) ?? session.user.name;
            }
            if (typeof token.displayImage === 'string' || token.displayImage === null) {
              session.user.image = (token.displayImage as string | null) ?? session.user.image;
            }
          }

          // Pass impersonation info through to the session
          if (session.user) {
            session.user.isDemo = isDemoUserId(token.sub);
            session.user.isImpersonating = token.isImpersonating as boolean || false;
            session.user.impersonatingFromId = token.impersonatingFromId as string | undefined;
            session.user.impersonatingFromName = token.impersonatingFromName as string | undefined;
            session.user.sessionVersion = token.tokenVersion as number | undefined;
            session.user.impersonationOwnerVersion = token.impersonationOwnerVersion as number | undefined;
            session.user.impersonationStartedAt = token.impersonationStartedAt as number | undefined;
            session.user.impersonationExpiresAt = token.impersonationExpiresAt as number | undefined;
            session.user.impersonationSessionId = token.impersonationSessionId as string | undefined;
          }
          
          //console.log(`${LOG_PREFIX} callbacks.session: `,{session, sessionToken: token})
          return session
        },
        async jwt({ token, user, account, profile, isNewUser }) {

          // Auth.js only ends the session and clears its cookie when jwt returns
          // null. A token without sub still produces a non-null session object,
          // which leaves useSession() "authenticated" with no user and strands
          // returning visitors on the workspace's sign-in redirect placeholder.
          if (!token.sub) return null;

          // ── Impersonation check ──────────────────────────────────────
          // If the OWNER has started an impersonation session, the JWT
          // callback swaps the token to represent the target user while
          // preserving the owner's original identity in extra fields.
          // Never fall through as a normal member when preview claims fail.
          const previewOwnerId = token.isImpersonating === true && typeof token.impersonatingFromId === 'string'
            ? token.impersonatingFromId : null;
          if (token.isImpersonating === true && !previewOwnerId) return null;
          const previewId = previewSessionId(token);
          if (token.isImpersonating === true && !previewId) return null;

          // ── Normal flow ──────────────────────────────────────────────
          // Run both DB lookups in parallel to halve latency to remote DB
          const [existingUser, existingAccount, previewOwner, previewSession] = await Promise.all([
            getUserById(token.sub),
            getAccountByUserId(token.sub),
            previewOwnerId ? getUserById(previewOwnerId) : Promise.resolve(null),
            // No cache: End Preview must revoke every copy, not just this browser.
            previewOwnerId && previewId ? dbPrisma.accountPreviewSession.findUnique({ where: { id: previewId } }) : Promise.resolve(null),
          ]);
          if (token.isImpersonating === true && (!validImpersonation(token, previewOwner, existingUser)
            || !validPreviewSession(token, previewSession))) return null;

          // If user was deleted (e.g. DB wipe), invalidate the session
          if (!existingUser) {
            if (isDev) console.log(`${LOG_PREFIX} jwt: user ${token.sub} not found — invalidating session`);
            return null;
          }

          // Demo sessions expire after a day, even if a browser keeps refreshing them.
          if (isDemoUserId(existingUser.id) && Date.now() - existingUser.createdAt.getTime() > 86_400_000) {
            return null;
          }

          // Session versioning: if tokenVersion changed, force re-login
          // Increment User.tokenVersion to invalidate all existing sessions
          if (
            typeof token.tokenVersion === 'number' &&
            existingUser.tokenVersion !== token.tokenVersion
          ) {
            if (isDev) console.log(`${LOG_PREFIX} jwt: tokenVersion mismatch for ${token.sub} — forcing re-login`);
            return null;
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

          if (previewOwner) {
            token.impersonatingFromName = previewOwner.name || 'Owner';
          } else {
            token.isImpersonating = false;
            token.impersonatingFromId = undefined;
            token.impersonatingFromName = undefined;
            token.impersonationOwnerVersion = undefined;
            token.impersonationStartedAt = undefined;
            token.impersonationExpiresAt = undefined;
            token.impersonationSessionId = undefined;
          }
          
          /* const logResponse = token.email // shortens the response, remove */
          /* console.log(`${LOG_PREFIX} callbacks.jwt.token: `,{logResponse}) */
          return token
        }
    },
    adapter: PrismaAdapter(dbPrisma),
    session: {strategy: 'jwt'},
  ...authConfig,
})
