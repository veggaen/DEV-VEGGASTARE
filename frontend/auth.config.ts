import bcrypt from "bcryptjs"
import type { NextAuthConfig } from "next-auth"
import Credentials from 'next-auth/providers/credentials'
import Github from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

import { MyAuthLoginSchema } from "@/schemas"
import { getUserByEmail } from "./data/user";

const LOG_PREFIX = '[frontend/auth.config.ts]'

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
            console.log(`${LOG_PREFIX} No user found for :`, email);
            if (!user || !user.password) return null;

            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            console.log(`${LOG_PREFIX} User authenticated successfully:`, user);
            if (passwordMatch) return user;
        }

        return null;
    }
  })],
} satisfies NextAuthConfig