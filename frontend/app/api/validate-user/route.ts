import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/browser';
import { ValidateUserResponseSchema } from '@/lib/types/users';
import { isDemoUserId, DEMO_ID_PREFIX } from '@/lib/demo-policy';
import { checkRateLimit } from '@/lib/rate-limit';

const bodySchema = z.object({ input: z.string().trim().min(1).max(200) }).strict();
function reply(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extra } });
}
const missing = () => reply({ isValid: false, message: 'User not found.' }, 404);

/** Exact lookup obeys the same privacy boundary as people autocomplete. */
export async function POST(req: Request) {
  try {
    const viewer = await MyLibUserAuth();
    if (!viewer?.id) return reply({ isValid: false, message: 'Sign in to find people.' }, 401);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply({ isValid: false, message: 'Enter a name, shared email or user ID.' }, 400);
    if (isDemoUserId(viewer.id)) return missing();
    const rate = await checkRateLimit('people-lookup:' + viewer.id, 'read');
    if (!rate.success) return reply({ isValid: false, message: 'Please wait before searching again.' }, 429, { 'Retry-After': String(Math.max(1, rate.resetIn)) });
    const { input } = parsed.data;
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'OWNER';
    // Filtering after retrieval would still reveal whether a hidden email exists.
    const email: Prisma.UserWhereInput = privileged ? { email: input } : {
      AND: [{ email: input }, { OR: [{ emailDisplayMode: 'PRIMARY' }, { id: viewer.id }] }],
    };
    const user = await dbPrisma.user.findFirst({
      where: { AND: [
        { id: { not: { startsWith: DEMO_ID_PREFIX.replace(/[\\%_]/g, '\\$&') } } },
        { OR: [{ id: input }, { name: input }, email] },
      ] },
      select: { id: true, name: true, email: true, emailDisplayMode: true },
      orderBy: { id: 'asc' },
    });
    if (!user) return missing();
    return reply(ValidateUserResponseSchema.parse({ isValid: true, user: {
      id: user.id, name: user.name,
      email: privileged || user.id === viewer.id || user.emailDisplayMode === 'PRIMARY' ? user.email : null,
    } }));
  } catch {
    console.error('[api/validate-user] Lookup failed');
    return reply({ isValid: false, message: 'People search is temporarily unavailable.' }, 500);
  }
}
