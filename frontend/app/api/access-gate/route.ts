import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_GATE_CONFIG } from '@/lib/site-config';

const CORRECT_PASSWORD = ACCESS_GATE_CONFIG.password;
const COOKIE_NAME = ACCESS_GATE_CONFIG.cookieName;
const COOKIE_DOMAIN = process.env.ACCESS_GATE_COOKIE_DOMAIN?.trim() || undefined;
// Simple hash of the password - in production you'd use a proper secret
const COOKIE_VALUE = 'granted_' + Buffer.from(CORRECT_PASSWORD).toString('base64').slice(0, 16);

// Brute force protection - in-memory store (resets on server restart)
// For production, consider using Redis or a database
const attemptStore = new Map<string, { count: number; firstAttempt: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5; // Max attempts before lockout
const WINDOW_MS = 60 * 1000; // 1 minute window
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minute lockout

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === 'unknown') return true;
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  // 172.16.0.0 – 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

function getClientIP(req: NextRequest): string {
  const headersList = req.headers;

  // Common proxy/CDN headers
  const cf = headersList.get('cf-connecting-ip')?.trim();
  if (cf) return cf;

  const realIp = headersList.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    // Usually the client IP is first, but some platforms prepend a proxy IP.
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (first && !isPrivateOrLocalIp(first)) return first;
    if (last && !isPrivateOrLocalIp(last)) return last;
    return first || last || 'unknown';
  }

  return 'unknown';
}

function getAttemptKey(req: NextRequest): string {
  const ip = getClientIP(req);
  const ua = req.headers.get('user-agent')?.slice(0, 120) ?? '';
  // Avoid "one shared IP" platforms locking everyone out.
  return `${ip}::${ua}`;
}

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number; attemptsRemaining?: number } {
  const now = Date.now();
  const entry = attemptStore.get(key);

  // No previous attempts
  if (!entry) {
    attemptStore.set(key, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - 1 };
  }

  // Currently locked out
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  // Window expired, reset
  if (now - entry.firstAttempt > WINDOW_MS) {
    attemptStore.set(key, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - 1 };
  }

  // Within window, check count
  if (entry.count >= MAX_ATTEMPTS) {
    // Lock out
    entry.lockedUntil = now + LOCKOUT_MS;
    attemptStore.set(key, entry);
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_MS / 1000) };
  }

  // Increment and allow
  entry.count++;
  attemptStore.set(key, entry);
  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - entry.count };
}

function clearAttempts(key: string): void {
  attemptStore.delete(key);
}

export async function POST(req: NextRequest) {
  const attemptKey = getAttemptKey(req);

  try {
    // Check rate limit before processing
    const rateLimit = checkRateLimit(attemptKey);
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
    clearAttempts(attemptKey);

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
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
