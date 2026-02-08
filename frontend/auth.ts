import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { cookies } from "next/headers"

import { dbPrisma } from "@/lib/db"
import authConfig from "@/auth.config"
import { UserRole } from "@prisma/client"
import { getUserById } from "@/data/user"
import { getTwoFactorConfirmationByUserId } from "@/data/two-factor-confirmation"
import { getAccountByUserId } from "./lib/account"


// Console.log PREFIX
const LOG_PREFIX = '[auth.ts] '
const isDev = process.env.NODE_ENV !== 'production'

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL

// Log configuration state (helps debug production issues)
console.log(LOG_PREFIX, 'Auth config:', {
  hasAuthSecret: !!authSecret,
  hasAuthUrl: !!authUrl,
  authUrl: authUrl || '(not set)',
  nodeEnv: process.env.NODE_ENV,
  hasDatabase: !!process.env.DATABASE_URL,
})

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
    debug: false, // Disabled - too noisy. Enable manually if needed: isDev
    pages: {
      signIn: '/auth/login',
      error: '/auth/error',
    },
    events: {
      async signOut(message){
        //console.log(`event.signOut token:`,message)

        if ('token' in message && message.token) {
          const token = await message.token;
          if (token) {
            const { isOAuth, sub } = token;
            // Rest of the code...

          }

          const isOAuth = token?.isOAuth;
          if (isOAuth) {
            //console.log(`async signOut token: ${isOAuth} and yea`, isOAuth)
            const userId = token.sub;
            //console.log(`event.signOut.User ID: ${userId}`);
            
            // Now you can use userId for further logic, such as fetching the user details
            // Ensure you have defined and implemented getUserById or similar function to use here
            if (userId) {
              const existingUser = await getUserById(userId);
              
              //console.log(`event.signOut.User details:`, existingUser);

                // Find all accounts for the user with the same provider
                const accounts = await dbPrisma.account.findFirst({
                  where: {
                    userId: existingUser?.id,
                  },
                  orderBy: {
                    expires_at: 'asc', // Order by expires_at ascending to have the oldest first
                  },
                });
                
                // If there are more than one account entries for the provider, delete the oldest
                if (accounts) {
                  await dbPrisma.account.delete({
                    where: { id: accounts.id },
                  });
                  //console.log(`Deleted account data form provider: ${accounts.provider}, AccountId: ${accounts.userId}`);
                }
            }
          }
        }

      },
      async linkAccount({ user, profile, account }){

        await dbPrisma.user.update({
          where: { id: user?.id },
          data: {
            emailVerified: new Date(),
            email: user.email,
            image: profile.image,
          }
        })
      }
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
              
              // delete two factor confirmation for next sign in
              // TODO: ADD EXPIRES IN... timer
              await dbPrisma.twoFactorConfirmation.delete({
                where: { id: twoFactorConfirmation.id }
              });

            };
          } // unsure if I should add a 'return false' in a 'else' statment here or just continue to return true below. Reason, no 'user.id' being present?
          
          return true;
        },
        async session({ session, user, token }) {
          
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
          const existingUser = await getUserById(token.sub);
          if (!existingUser) return token;
          const existingAccount = await getAccountByUserId(existingUser.id);

          token.isTwoFactorEnabled = existingUser.isTwoFactorEnabled;
          token.referredBy = existingUser.referredBy;
          token.role = existingUser.role;
          token.name = existingUser.name;
          token.email = existingUser.email;
          token.image = existingUser.image;
          token.isOAuth = !!existingAccount;
			token.web3ModeEnabled = existingUser.web3ModeEnabled;

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