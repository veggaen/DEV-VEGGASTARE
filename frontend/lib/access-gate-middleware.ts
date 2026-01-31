import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'veggastare_access';
const CORRECT_PASSWORD = 'MainAdc123';
const COOKIE_VALUE = 'granted_' + Buffer.from(CORRECT_PASSWORD).toString('base64').slice(0, 16);

// Routes that should NOT be protected by the access gate
const GATE_BYPASS_ROUTES = [
  '/gate',           // The gate page itself
  '/api/access-gate', // The authentication API
  '/_next',          // Next.js internals
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

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
