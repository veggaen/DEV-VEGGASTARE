/**
 * Rate limiter with optional Redis backend.
 *
 * - If REDIS_URL is set → distributed, survives restarts, works across replicas.
 * - If REDIS_URL is not set → in-memory Map (same as before), good for dev/single instance.
 *
 * The public API is identical regardless of backend — callers don't need to know.
 */

import { createClient, type RedisClientType } from "redis";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number; // epoch ms
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number; // seconds until window resets
  limit: number;
}

// Rate limit configurations by type
export const RATE_LIMITS = {
  // Auth routes — strict to prevent brute force
  auth: { maxRequests: 5, windowMs: 60_000 },

  // Write operations — moderate
  write: { maxRequests: 30, windowMs: 60_000 },

  // Read operations — lenient
  read: { maxRequests: 100, windowMs: 60_000 },

  // Analytics — very strict (expensive queries)
  analytics: { maxRequests: 10, windowMs: 60_000 },

  // Social actions (like, follow) — moderate with burst protection
  social: { maxRequests: 60, windowMs: 60_000 },

  // Message sending — prevent spam
  message: { maxRequests: 20, windowMs: 60_000 },

  // Download — moderate
  download: { maxRequests: 10, windowMs: 60_000 },

  // External API proxy (bring-address etc.) — moderate
  external: { maxRequests: 60, windowMs: 60_000 },

  // Gate/brute-force — very strict
  gate: { maxRequests: 5, windowMs: 60_000 },

  // Wallet operations (challenge, verify, delete) — strict per-user
  wallet: { maxRequests: 6, windowMs: 60_000 },

  // Trade operations — moderate per-user
  trade: { maxRequests: 15, windowMs: 60_000 },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

// ─────────────────────────────────────────────────────────────────────────────
// Backend: In-Memory (fallback)
// ─────────────────────────────────────────────────────────────────────────────

const memoryStore = new Map<string, RateLimitEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startMemoryCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetTime < now) {
        memoryStore.delete(key);
      }
    }
  }, 60_000);
  // Allow the process to exit even if interval is active
  if (cleanupInterval && typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    (cleanupInterval as NodeJS.Timeout).unref();
  }
}

function checkMemory(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  startMemoryCleanup();
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetTime < now) {
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetIn: Math.ceil(windowMs / 1000), limit: maxRequests };
  }

  entry.count += 1;
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);

  if (entry.count > maxRequests) {
    return { success: false, remaining: 0, resetIn, limit: maxRequests };
  }

  return { success: true, remaining, resetIn, limit: maxRequests };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend: Redis
// ─────────────────────────────────────────────────────────────────────────────

let redisClient: RedisClientType | null = null;
let redisReady = false;
let redisInitPromise: Promise<void> | null = null;
let redisErrorLogged = false;

function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL || process.env.KV_URL;
}

async function initRedis(): Promise<void> {
  const url = getRedisUrl();
  if (!url) return;

  try {
    redisClient = createClient({ url }) as RedisClientType;

    redisClient.on("error", (err: Error) => {
      if (!redisErrorLogged) {
        console.warn("[rate-limit] Redis error, falling back to in-memory:", err.message);
        redisErrorLogged = true;
      }
      redisReady = false;
    });

    redisClient.on("ready", () => {
      redisReady = true;
      redisErrorLogged = false; // Reset so we log again if it fails after recovery
    });

    await redisClient.connect();
    redisReady = true;
  } catch (err) {
    console.warn("[rate-limit] Redis connection failed, using in-memory fallback:", (err as Error).message);
    redisClient = null;
    redisReady = false;
  }
}

function ensureRedis(): Promise<void> {
  if (!getRedisUrl()) return Promise.resolve();
  if (!redisInitPromise) {
    redisInitPromise = initRedis();
  }
  return redisInitPromise;
}

async function checkRedis(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
  if (!redisClient || !redisReady) {
    return checkMemory(key, maxRequests, windowMs);
  }

  try {
    // Atomic increment + expiry via MULTI
    const results = await redisClient
      .multi()
      .incr(key)
      .pTTL(key)
      .exec();

    const count = (results?.[0] ?? 1) as number;
    let ttl = (results?.[1] ?? -1) as number;

    // First request in this window — set expiry
    if (count === 1 || ttl < 0) {
      await redisClient.pExpire(key, windowMs);
      ttl = windowMs;
    }

    const remaining = Math.max(0, maxRequests - count);
    const resetIn = Math.max(1, Math.ceil(ttl / 1000));

    if (count > maxRequests) {
      return { success: false, remaining: 0, resetIn, limit: maxRequests };
    }

    return { success: true, remaining, resetIn, limit: maxRequests };
  } catch (err) {
    console.warn("[rate-limit] Redis op failed, falling back to in-memory:", (err as Error).message);
    return checkMemory(key, maxRequests, windowMs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a request should be rate limited.
 *
 * Uses Redis when REDIS_URL is set, otherwise falls back to in-memory.
 *
 * @param identifier - Unique key (usually IP + userId or just IP)
 * @param type - Rate limit tier to apply
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = "read"
): Promise<RateLimitResult> {
  const { maxRequests, windowMs } = RATE_LIMITS[type];
  const key = `rl:${type}:${identifier}`;

  if (getRedisUrl()) {
    await ensureRedis();
    return checkRedis(key, maxRequests, windowMs);
  }

  return checkMemory(key, maxRequests, windowMs);
}

/**
 * Get client identifier from request (IP address or fallback).
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");

  const ip = cfIp || realIp || forwarded?.split(",")[0]?.trim() || "unknown";

  return userId ? `${ip}:${userId}` : ip;
}

/**
 * Create rate limit headers for response.
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetIn.toString(),
  };
}

/**
 * Helper to create a rate-limited error response.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter: result.resetIn,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": result.resetIn.toString(),
        ...rateLimitHeaders(result),
      },
    }
  );
}
