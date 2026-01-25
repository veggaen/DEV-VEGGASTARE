import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
} from "@/routes"

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const SESSION_COOKIE_NAMES = [
  // next-auth v4
  "__Secure-next-auth.session-token",
  "next-auth.session-token",

  // Auth.js / next-auth v5
  "__Secure-authjs.session-token",
  "authjs.session-token",
]

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(req.cookies.get(name)?.value))
}

export default function middleware(req: NextRequest) {
  const { nextUrl } = req
  const isLoggedIn = hasSessionCookie(req)

  const isApiAuthRoute = apiAuthPrefix.some((prefix) =>
    nextUrl.pathname.startsWith(prefix)
  )
  const isAuthRoute = authRoutes.includes(nextUrl.pathname)

  // ✅ Allow /products and /products/[id]
  const isPublicProductPage =
    nextUrl.pathname === "/products" ||
    nextUrl.pathname.startsWith("/products/")

  const isPublicRoute =
    publicRoutes.includes(nextUrl.pathname) || isPublicProductPage

  if (isApiAuthRoute) return NextResponse.next()

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl))
    }
    return NextResponse.next()
  }

  if (!isLoggedIn && !isPublicRoute) {
    let callbackUrl = nextUrl.pathname
    if (nextUrl.search) callbackUrl += nextUrl.search

    const encodedCallbackUrl = encodeURIComponent(callbackUrl)
    return NextResponse.redirect(
      new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
