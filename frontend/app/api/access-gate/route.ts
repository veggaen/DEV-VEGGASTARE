import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_GATE_CONFIG } from '@/lib/site-config';

const CORRECT_PASSWORD = ACCESS_GATE_CONFIG.password;
const COOKIE_NAME = ACCESS_GATE_CONFIG.cookieName;
// Simple hash of the password - in production you'd use a proper secret
const COOKIE_VALUE = 'granted_' + Buffer.from(CORRECT_PASSWORD).toString('base64').slice(0, 16);

// Brute force protection - in-memory store (resets on server restart)
// For production, consider using Redis or a database
const attemptStore = new Map<string, { count: number; firstAttempt: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5; // Max attempts before lockout
const WINDOW_MS = 60 * 1000; // 1 minute window
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minute lockout

function getClientIP(req: NextRequest): string {
  const headersList = req.headers;
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number; attemptsRemaining?: number } {
  const now = Date.now();
  const entry = attemptStore.get(ip);

  // No previous attempts
  if (!entry) {
    attemptStore.set(ip, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - 1 };
  }

  // Currently locked out
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  // Window expired, reset
  if (now - entry.firstAttempt > WINDOW_MS) {
    attemptStore.set(ip, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - 1 };
  }

  // Within window, check count
  if (entry.count >= MAX_ATTEMPTS) {
    // Lock out
    entry.lockedUntil = now + LOCKOUT_MS;
    attemptStore.set(ip, entry);
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_MS / 1000) };
  }

  // Increment and allow
  entry.count++;
  attemptStore.set(ip, entry);
  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - entry.count };
}

function clearAttempts(ip: string): void {
  attemptStore.delete(ip);
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);

  try {
    // Check rate limit before processing
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter) }
        }
      );
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Sanitize input - prevent injection attempts
    const sanitizedPassword = password.slice(0, 100); // Limit length

    if (sanitizedPassword !== CORRECT_PASSWORD) {
      return NextResponse.json(
        {
          error: 'Incorrect password. Try again.',
          attemptsRemaining: rateLimit.attemptsRemaining
        },
        { status: 401 }
      );
    }

    // Successful login - clear attempts
    clearAttempts(ip);

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Session cookie - expires when browser closes
      // Or set maxAge for longer: maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

// GET to check if authenticated
export async function GET() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(COOKIE_NAME);

  if (accessCookie?.value === COOKIE_VALUE) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// DELETE to logout/clear access
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ success: true });
}
