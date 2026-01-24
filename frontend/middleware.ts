import NextAuth from "next-auth"
import { authEdgeConfig } from "@/auth-edge.config"
import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
} from "@/routes"

// Use an Edge-safe config here to avoid bundling Prisma/bcrypt into middleware.
const { auth } = NextAuth(authEdgeConfig)

export default auth((req): any => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix[0])
  const isAuthRoute = authRoutes.includes(nextUrl.pathname)

  // ✅ Allow /products and /products/[id]
  const isPublicProductPage =
    nextUrl.pathname === "/products" ||
    nextUrl.pathname.startsWith("/products/")

  const isPublicRoute =
    publicRoutes.includes(nextUrl.pathname) || isPublicProductPage

  if (isApiAuthRoute) return null

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl))
    }
    return null
  }

  if (!isLoggedIn && !isPublicRoute) {
    let callbackUrl = nextUrl.pathname
    if (nextUrl.search) callbackUrl += nextUrl.search

    const encodedCallbackUrl = encodeURIComponent(callbackUrl)
    return Response.redirect(
      new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    )
  }

  return null
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
