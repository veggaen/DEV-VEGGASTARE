import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_GATE_CONFIG } from '@/lib/site-config';
import { makeGateCookieValue } from '@/lib/access-gate-cookie';

const COOKIE_NAME = ACCESS_GATE_CONFIG.cookieName;
const CORRECT_PASSWORD = ACCESS_GATE_CONFIG.password;
const COOKIE_VALUE = makeGateCookieValue(CORRECT_PASSWORD);

// Routes that should NOT be protected by the access gate
const GATE_BYPASS_ROUTES = ACCESS_GATE_CONFIG.bypassRoutes;

export function accessGateMiddleware(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Skip gate for bypass routes
  if (GATE_BYPASS_ROUTES.some(route => pathname.startsWith(route))) {
    return null; // Continue to next middleware or route
  }

  // Check for access cookie
  const accessCookie = request.cookies.get(COOKIE_NAME);

  if (accessCookie?.value === COOKIE_VALUE) {
    return null; // Authenticated, continue
  }

  // Not authenticated - redirect to gate
  const gateUrl = new URL('/gate', request.url);
  // Preserve the original URL so we can redirect back after auth
  gateUrl.searchParams.set('redirect', pathname);
  
  return NextResponse.redirect(gateUrl);
}
