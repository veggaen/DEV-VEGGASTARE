import bcrypt from "bcryptjs"
import type { NextAuthConfig } from "next-auth"
import Credentials from 'next-auth/providers/credentials'
import Github from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

import { MyAuthLoginSchema, MyEmailLoginTokenSchema } from "@/schemas"
import { getUserByEmail } from "./data/user";
import { getEmailLoginTokenByToken } from "./lib/tokens";
import { dbPrisma } from "./lib/db";

const LOG_PREFIX = '[frontend/auth.config.ts]'
const isDev = process.env.NODE_ENV !== 'production'

export default {
  providers: [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    // Allow OAuth to link with existing email/password accounts
    // This enables seamless login with any method for the same email
    allowDangerousEmailAccountLinking: true,
  }),
  Github({
    clientId: process.env.AUTH_GITHUB_ID,
    clientSecret: process.env.AUTH_GITHUB_SECRET,
    // Allow OAuth to link with existing email/password accounts
    allowDangerousEmailAccountLinking: true,
  }),
  // Magic-link login provider for auto-login after email verification
  Credentials({
    id: "email-login-token",
    name: "Email Login Token",
    credentials: {
      email: { label: "Email", type: "email" },
      loginToken: { label: "Login Token", type: "text" }
    },
    async authorize(credentials) {
      const validateFields = MyEmailLoginTokenSchema.safeParse(credentials);
      if (!validateFields.success) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: invalid fields`);
        return null;
      }

      const { email, loginToken } = validateFields.data;

      // Find and validate the login token
      const existingToken = await getEmailLoginTokenByToken(loginToken);
      if (!existingToken) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: token not found`);
        return null;
      }

      // Check if token has expired
      const hasExpired = new Date(existingToken.expires) < new Date();
      if (hasExpired) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: token expired`);
        // Clean up expired token
        await dbPrisma.emailLoginToken.delete({ where: { id: existingToken.id } });
        return null;
      }

      // Verify email matches
      if (existingToken.email !== email) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: email mismatch`);
        return null;
      }

      // Get the user
      const user = await getUserByEmail(email);
      if (!user) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: user not found`);
        return null;
      }

      // Delete the token (one-time use)
      await dbPrisma.emailLoginToken.delete({ where: { id: existingToken.id } });

      if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: success for ${email}`);
      return user;
    }
  }),
  // Standard credentials provider for email/password login
  Credentials({
    id: "credentials",
    name: "Credentials",
    async authorize(credentials){
        const validateFields = MyAuthLoginSchema.safeParse(credentials);
        if ( validateFields.success){
            const { email, password } = validateFields.data
            
            const user = await getUserByEmail(email);
            
            // SECURITY: Always run bcrypt.compare to prevent timing attacks
            // For non-existent users, compare against a dummy hash to ensure
            // consistent response times (prevents username enumeration)
            const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // pre-computed dummy
            const passwordToCompare = user?.password || dummyHash;
            
            const passwordMatch = await bcrypt.compare(
                password,
                passwordToCompare
            );

            // Return null for invalid credentials (user not found OR wrong password)
            // Use same error path to prevent user enumeration
            if (!user || !user.password || !passwordMatch) {
              if (isDev) console.log(`${LOG_PREFIX} credentials authorize: invalid credentials`);
              return null;
            }

            return user;
        }

        return null;
    }
  })],
} satisfies NextAuthConfig