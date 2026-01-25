import bcrypt from "bcryptjs"
import type { NextAuthConfig } from "next-auth"
import Credentials from 'next-auth/providers/credentials'
import Github from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

import { MyAuthLoginSchema } from "@/schemas"
import { getUserByEmail } from "./data/user";

const LOG_PREFIX = '[frontend/auth.config.ts]'
const isDev = process.env.NODE_ENV !== 'production'

export default {
  providers: [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    allowDangerousEmailAccountLinking: true
  }),
  Github({
    clientId: process.env.AUTH_GITHUB_ID,
    clientSecret: process.env.AUTH_GITHUB_SECRET,
    allowDangerousEmailAccountLinking: true
  }),
  Credentials({
    async authorize(credentials){
        const validateFields = MyAuthLoginSchema.safeParse(credentials);
        if ( validateFields.success){
            const { email, password } = validateFields.data
            
            const user = await getUserByEmail(email);
            if (!user || !user.password) {
              if (isDev) console.log(`${LOG_PREFIX} credentials authorize: user not found`);
              return null;
            }

            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
              if (isDev) console.log(`${LOG_PREFIX} credentials authorize: password mismatch`);
              return null;
            }

            return user;
        }

        return null;
    }
  })],
} satisfies NextAuthConfig