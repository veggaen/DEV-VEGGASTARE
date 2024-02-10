import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
} from "@/routes";
import type { NextAuthConfig } from "next-auth";
const { auth } = NextAuth(authConfig);

export default auth((req): any => {
    const  { nextUrl } = req;
    const isLoggedIn = !!req.auth;
  
    const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
    const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
    const isAuthRoute = authRoutes.includes(nextUrl.pathname);
  
    if (isApiAuthRoute){
      return null;
    }
  
    if (isAuthRoute) {
      if (isLoggedIn) {
        return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl))
      }
      return null;
    }

    if (!isLoggedIn && !isPublicRoute) {
      let callbackUrl = nextUrl.pathname;
      if (nextUrl.search) {
        callbackUrl += nextUrl.search;
      }
  
      const encodedCallbackUrl = encodeURIComponent(callbackUrl);
  
      return Response.redirect(new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl));
    }

    return null;
  }
)

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}

// how it was before--->

// matcher: ["/auth/login", "/auth/register"],
// matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],

/* export default auth((req) => {
  const isLoggedIn = !!req.auth;
  console.log('ROUTE ', req.nextUrl.pathname)
  console.log('isLoggedIn', isLoggedIn)
}) */