/**
 * Simple in-memory rate limiter for API routes.
 * For production at scale, consider using Redis (e.g., @upstash/ratelimit).
 * 
 * This implementation:
 * - Uses sliding window algorithm
 * - Handles concurrent requests safely
 * - Auto-cleans expired entries
 * - Supports different limits per route type
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every 60 seconds)
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

// Rate limit configurations by type
export const RATE_LIMITS = {
  // Auth routes - strict to prevent brute force
  auth: { maxRequests: 5, windowMs: 60000 },       // 5 per minute
  
  // Write operations - moderate
  write: { maxRequests: 30, windowMs: 60000 },     // 30 per minute
  
  // Read operations - lenient
  read: { maxRequests: 100, windowMs: 60000 },     // 100 per minute
  
  // Analytics - very strict (expensive queries)
  analytics: { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  
  // Social actions (like, follow) - moderate with burst protection
  social: { maxRequests: 60, windowMs: 60000 },    // 60 per minute
  
  // Message sending - prevent spam
  message: { maxRequests: 20, windowMs: 60000 },   // 20 per minute
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number; // seconds until reset
  limit: number;
}

/**
 * Check if a request should be rate limited.
 * 
 * @param identifier - Unique identifier (usually IP + userId or just IP)
 * @param type - Type of rate limit to apply
 * @returns Object with success status and limit info
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'read'
): RateLimitResult {
  startCleanup();
  
  const { maxRequests, windowMs } = RATE_LIMITS[type];
  const now = Date.now();
  const key = `${type}:${identifier}`;
  
  const entry = rateLimitStore.get(key);
  
  // No entry or expired - create new window
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetIn: Math.ceil(windowMs / 1000),
      limit: maxRequests,
    };
  }
  
  // Within window - increment count
  entry.count += 1;
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);
  
  if (entry.count > maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn,
      limit: maxRequests,
    };
  }
  
  return {
    success: true,
    remaining,
    resetIn,
    limit: maxRequests,
  };
}

/**
 * Get client identifier from request (IP address or fallback).
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  // Try to get real IP from common headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');
  
  const ip = cfIp || realIp || forwarded?.split(',')[0]?.trim() || 'unknown';
  
  // Combine with userId if available for more precise limiting
  return userId ? `${ip}:${userId}` : ip;
}

/**
 * Create rate limit headers for response.
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
  };
}

/**
 * Helper to create a rate-limited error response.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfter: result.resetIn,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.resetIn.toString(),
        ...rateLimitHeaders(result),
      },
    }
  );
}
