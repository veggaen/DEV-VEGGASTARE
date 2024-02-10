import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { MongoDBAdapter  } from "@auth/mongodb-adapter"

import { dbPrisma, dbMongo } from "@/lib/db"
import authConfig from "@/auth.config"
import { UserRole } from "@prisma/client"
import { getUserById } from "@/data/user"
import { getTwoFactorConfirmationByUserId } from "@/data/two-factor-confirmation"
import { getAccountByUserId } from "./lib/account"
import { JWT } from "next-auth/jwt";

// Console.log PREFIX
const LOG_PREFIX = '[auth.ts] '

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut
} = NextAuth({
    pages: {
      signIn: '/auth/login',
      error: '/auth/error',
    },
    events: {
      async signOut(message){
        console.log(`event.signOut token:`,message)

        if ('token' in message && message.token) {
          const token = await message.token;
          if (token) {
            const { isOAuth, sub } = token;
            // Rest of the code...

          }

          const isOAuth = token?.isOAuth;
          if (isOAuth) {
            console.log(`async signOut token: ${isOAuth} and yea`, isOAuth)
            const userId = token.sub;
            console.log(`event.signOut.User ID: ${userId}`);
            
            // Now you can use userId for further logic, such as fetching the user details
            // Ensure you have defined and implemented getUserById or similar function to use here
            if (userId) {
              const existingUser = await getUserById(userId);
              console.log(`event.signOut.User details:`, existingUser);

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
                  console.log(`Deleted account data form provider: ${accounts.provider}, AccountId: ${accounts.userId}`);
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
          console.log(`${LOG_PREFIX} callbacks.signIn: `, {user});

          // Allow OAuth without email verification. Consider a change to this logic if in the future we want to be adding more login providers
          if ( account?.provider !== 'credentials' ){
            console.log(`${LOG_PREFIX} callbacks.signIn: OAuth provider`)
            return true;
          }
          
          if (user.id) {
            const existingUser = await getUserById(user.id);
            // Prevent sign in without email verification aka 1fa check
            if (!existingUser?.emailVerified){
              console.log(`${LOG_PREFIX} callbacks.signIn: email not verified ${existingUser?.name}`)
              return false;
            };
            // 2fa check
            if ( existingUser.isTwoFactorEnabled ) {
              const twoFactorConfirmation = await getTwoFactorConfirmationByUserId(existingUser.id)
              console.log(`${LOG_PREFIX} callbacks.signIn: 2fa check `,{twoFactorConfirmation})
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
          
          if (token.referredby && session.user ) {
            session.user.referredby = token.referredby as string;
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
          
          //console.log(`${LOG_PREFIX} callbacks.session: `,{session, sessionToken: token})
          return session
        },
        async jwt({ token, user, account, profile, isNewUser }) {

          if (!token.sub) return token;
          const existingUser = await getUserById(token.sub);
          if (!existingUser) return token;
          const existingAccount = await getAccountByUserId(existingUser.id);

          token.isTwoFactorEnabled = existingUser.isTwoFactorEnabled;
          token.referredby = existingUser.referredby;
          token.role = existingUser.role;
          token.name = existingUser.name;
          token.email = existingUser.email;
          token.image = existingUser.image;
          token.isOAuth = !!existingAccount;
          
          const logResponse = token.email // shortens the response, remove if needed.
          console.log(`${LOG_PREFIX} callbacks.jwt.token: `,{logResponse})
          return token
        }
    },
    adapter: PrismaAdapter(dbPrisma) || MongoDBAdapter(dbMongo),
    session: {strategy: 'jwt'},
  ...authConfig,
})