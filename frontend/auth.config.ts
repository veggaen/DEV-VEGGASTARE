import bcrypt from "bcryptjs"
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
      allowDangerousEmailAccountLinking: true,
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
      allowDangerousEmailAccountLinking: true,
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
      allowDangerousEmailAccountLinking: true,
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
  }),
  // Wallet sign-in (SIWE). Logged-out users authenticate by signing a nonce
  // (issued by /api/auth/wallet/nonce). On success we log into the wallet's
  // linked account, or create a low-reach WALLET_ONLY account. Trust/reach is
  // computed by lib/reach (provenance-weighted), so a bare wallet is low reach.
  Credentials({
    id: "wallet",
    name: "Wallet",
    credentials: {
      address: { label: "Address", type: "text" },
      signature: { label: "Signature", type: "text" },
    },
    async authorize(credentials) {
      try {
        const { getAddress, verifyMessage } = await import("viem");
        const rawAddress = String(credentials?.address ?? "");
        const signature = String(credentials?.signature ?? "");
        if (!rawAddress || !signature) return null;

        let address: string;
        try { address = getAddress(rawAddress); } catch { return null; }
        const addressKey = address.toLowerCase();

        // Look up the active, unexpired nonce for this address.
        const challenge = await dbPrisma.walletLoginNonce.findFirst({
          where: { address: addressKey, usedAt: null, expires: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        });
        if (!challenge) {
          if (isDev) console.log(`${LOG_PREFIX} wallet authorize: no valid nonce`);
          return null;
        }

        // Verify the signature against the exact issued message.
        const ok = await verifyMessage({
          address: address as `0x${string}`,
          message: challenge.message,
          signature: signature as `0x${string}`,
        });
        if (!ok) {
          if (isDev) console.log(`${LOG_PREFIX} wallet authorize: bad signature`);
          return null;
        }

        // One-time use.
        await dbPrisma.walletLoginNonce.update({
          where: { id: challenge.id },
          data: { usedAt: new Date() },
        });

        // Find the wallet's linked, verified owner → log into that account.
        const wallet = await dbPrisma.wallet.findFirst({
          where: { address: { equals: address, mode: "insensitive" }, ownerUserId: { not: null }, verifiedAt: { not: null } },
          select: { User: { select: { id: true, name: true, email: true, image: true } } },
        });
        if (wallet?.User) return wallet.User;

        // No linked account → create a low-reach WALLET_ONLY account.
        const created = await dbPrisma.user.create({
          data: {
            name: `${address.slice(0, 6)}…${address.slice(-4)}`,
            verificationTier: "WALLET_ONLY",
            web3ModeEnabled: true,
            Wallet: {
              create: {
                label: "Wallet",
                family: "EVM",
                address,
                verifiedAt: new Date(),
                connectorType: "wallet-login",
                riskTier: "fresh",
              },
            },
          },
          select: { id: true, name: true, email: true, image: true },
        });
        return created;
      } catch (e) {
        if (isDev) console.log(`${LOG_PREFIX} wallet authorize error:`, e);
        return null;
      }
    },
  })],
} satisfies NextAuthConfig