import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config used ONLY by `middleware.ts`.
 *
 * IMPORTANT:
 * - Do NOT import Prisma, database utilities, bcrypt, or other Node-only modules here.
 * - Keep this file dependency-free so the middleware can compile in the Edge runtime.
 */
// Named export to avoid any default-export interop oddities in the middleware bundle.
export const authEdgeConfig = {
  // Middleware only needs to verify/parse the session.
  // NextAuth's runtime expects `providers` to exist (it calls `.map()` internally).
  providers: [],

  // Let NextAuth pick up AUTH_SECRET / AUTH_SECRET_1..3 via env defaults.
  // (Edge runtime-safe; avoids accidentally passing a string where it expects an array.)
  // secret: undefined,

  // Match the app's session strategy (the main auth setup uses JWT sessions).
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;

export default authEdgeConfig;
