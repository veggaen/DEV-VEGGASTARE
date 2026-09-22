/** @fileOverview Durable auth throttling across serverless replicas; failures deny attempts. @stability stable */
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { dbPrisma } from '@/lib/db';

export const AUTH_RETRY_MESSAGE = 'Too many attempts or sign-in is temporarily unavailable. Please try again in a few minutes.';

export async function allowAuthAttempt(operation: string, identity = '', request?: Request): Promise<boolean> {
  try {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) return false;
    const h = request?.headers || await headers();
    // Vercel overwrites this header. Do not trust client-supplied IP aliases in production.
    const ip = (process.env.VERCEL ? h.get('x-vercel-forwarded-for') : h.get('x-forwarded-for'))?.split(',')[0]?.trim() || 'unknown';
    const entries = [{ scope: `ip:${ip}`, limit: 20 }];
    if (identity) entries.push({ scope: `identity:${identity.trim().toLowerCase()}`, limit: 5 });
    for (const entry of entries) {
      const key = createHmac('sha256', secret).update(`${operation}:${entry.scope}`).digest('hex');
      const rows = await dbPrisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "AuthRateBucket" ("key", "count", "expiresAt")
        VALUES (${key}, 1, CURRENT_TIMESTAMP + INTERVAL '5 minutes')
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST("AuthRateBucket"."count" + 1, 100000) END,
          "expiresAt" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + INTERVAL '5 minutes' ELSE "AuthRateBucket"."expiresAt" END
        RETURNING "count"`;
      if (!rows[0] || rows[0].count > entry.limit) return false;
    }
    // Small, bounded cleanup. Hashed identifiers expire without storing raw IP/email.
    await dbPrisma.$executeRaw`DELETE FROM "AuthRateBucket" WHERE "key" IN (SELECT "key" FROM "AuthRateBucket" WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '1 day' LIMIT 100)`;
    return true;
  } catch {
    return false;
  }
}
