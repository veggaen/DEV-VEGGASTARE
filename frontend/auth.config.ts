import bcrypt from "bcryptjs"
import { timingSafeEqual } from 'node:crypto';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import type { NextAuthConfig } from "next-auth"
import Credentials from 'next-auth/providers/credentials'
import Discord from 'next-auth/providers/discord'
import Github from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

import { MyAuthLoginSchema, MyEmailLoginTokenSchema } from "@/schemas"
import { getUserByEmail } from "./data/user";
import { getEmailLoginTokenByToken } from "./lib/tokens";
import { dbPrisma } from "./lib/db";

const LOG_PREFIX = '[frontend/auth.config.ts]'
const isDev = process.env.NODE_ENV !== 'production'

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET

const githubClientId = process.env.AUTH_GITHUB_ID || process.env.GITHUB_ID || process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET
const discordClientId = process.env.AUTH_DISCORD_ID || process.env.DISCORD_CLIENT_ID
const discordClientSecret = process.env.AUTH_DISCORD_SECRET || process.env.DISCORD_CLIENT_SECRET

const oauthProviders: NextAuthConfig['providers'] = []

if (googleClientId && googleClientSecret) {
  oauthProviders.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: false,
    })
  )
} else if (isDev) {
  console.log(
    LOG_PREFIX,
    'Google OAuth disabled: missing AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET (or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)'
  )
}

if (githubClientId && githubClientSecret) {
  oauthProviders.push(
    Github({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      allowDangerousEmailAccountLinking: false,
    })
  )
} else if (isDev) {
  console.log(LOG_PREFIX, 'GitHub OAuth disabled: missing AUTH_GITHUB_ID/AUTH_GITHUB_SECRET (or GITHUB_*)')
}

if (discordClientId && discordClientSecret) {
  oauthProviders.push(
    Discord({
      clientId: discordClientId,
      clientSecret: discordClientSecret,
      allowDangerousEmailAccountLinking: false,
    })
  )
} else if (isDev) {
  console.log(
    LOG_PREFIX,
    'Discord OAuth disabled: missing AUTH_DISCORD_ID/AUTH_DISCORD_SECRET (or DISCORD_CLIENT_ID/DISCORD_CLIENT_SECRET)'
  )
}

export default {
  providers: [
  ...oauthProviders,
  Credentials({
    id: "demo", name: "Interview demo", credentials: {},
    async authorize(_credentials, request) {
      const { createDemoUser } = await import("@/lib/demo-user");
      return createDemoUser(request);
    },
  }),
  // Magic-link login provider for auto-login after email verification
  Credentials({
    id: "email-login-token",
    name: "Email Login Token",
    credentials: {
      email: { label: "Email", type: "email" },
      loginToken: { label: "Login Token", type: "text" }
    },
    async authorize(credentials, request) {
      const validateFields = MyEmailLoginTokenSchema.safeParse(credentials);
      if (!validateFields.success) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: invalid fields`);
        return null;
      }

      const { email, loginToken } = validateFields.data;
      if (!await allowAuthAttempt('email-login', email, request)) return null;

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
        await dbPrisma.emailLoginToken.deleteMany({ where: { id: existingToken.id } });
        return null;
      }

      // Verify email matches
      if (existingToken.email.toLowerCase() !== email.toLowerCase()) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: email mismatch`);
        return null;
      }

      // Get the user
      const user = await getUserByEmail(email);
      if (!user || !user.emailVerified || user.isTwoFactorEnabled) {
        if (isDev) console.log(`${LOG_PREFIX} email-login-token authorize: user not found`);
        return null;
      }

      // Delete the token (one-time use)
      const consumed = await dbPrisma.emailLoginToken.deleteMany({ where: { id: existingToken.id, expires: { gt: new Date() } } });
      return consumed.count === 1 ? user : null;
    }
  }),
  // Standard credentials provider for email/password login
  Credentials({
    id: "credentials",
    name: "Credentials",
    async authorize(credentials, request){
        const validateFields = MyAuthLoginSchema.safeParse(credentials);
        if ( validateFields.success){
            const { email, password, code } = validateFields.data
            if (!await allowAuthAttempt('password-provider', email, request)) return null;
            
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
            if (!user || !user.password || !passwordMatch || !user.emailVerified) {
              if (isDev) console.log(`${LOG_PREFIX} credentials authorize: invalid credentials`);
              return null;
            }

            // Validate and consume the second factor in this exact sign-in request.
            // A shared per-user confirmation row must never authorize another request.
            if (user.isTwoFactorEnabled) {
              if (!code || !user.email) return null;
              const token = await dbPrisma.twoFactorToken.findFirst({ where: { email: user.email, expires: { gt: new Date() } }, orderBy: { expires: 'desc' } });
              if (!token || token.token.length !== code.length || !timingSafeEqual(Buffer.from(token.token), Buffer.from(code))) return null;
              const consumed = await dbPrisma.twoFactorToken.deleteMany({ where: { id: token.id, expires: { gt: new Date() } } });
              if (consumed.count !== 1) return null;
            }
            return user;
        }

        return null;
    }
  }),
  // Server-issued, browser-bound proof. No arbitrary address lookup or replay fallback.
  Credentials({
    id: "wallet",
    name: "Wallet",
    credentials: {
      challengeId: { label: "Challenge", type: "text" },
      signature: { label: "Signature", type: "text" },
      code: { label: "Email code", type: "text" },
    },
    async authorize(credentials, request) {
      try {
        const { walletLoginContext, walletLoginProofSchema } = await import("@/lib/wallet-login-request");
        const { authenticateWalletLogin } = await import("@/lib/wallet-login");
        const context = walletLoginContext(request);
        const parsed = walletLoginProofSchema.safeParse({ challengeId: credentials?.challengeId, signature: credentials?.signature });
        const code = credentials?.code;
        if (!parsed.success || (code !== undefined && code !== "" && (typeof code !== "string" || !/^\d{6}$/.test(code)))) return null;
        if (!await allowAuthAttempt("wallet-login-authorize", parsed.data.challengeId, request)) return null;
        return await authenticateWalletLogin({ ...context, ...parsed.data, signature: parsed.data.signature as `0x${string}`, code: typeof code === "string" ? code : undefined });
      } catch {
        // No raw provider errors, signatures, challenges or codes in logs.
        return null;
      }
    },
  })],
} satisfies NextAuthConfig
