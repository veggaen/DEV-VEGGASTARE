import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { isOwner, logAdminAction } from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@/generated/prisma/browser';
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { getAccountByUserId } from '@/lib/account';
import { z } from 'zod';

const ImpersonateBodySchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
  reason: z.string().max(500).optional(),
});

const LOG_PREFIX = '[api/admin/impersonate]';

const isSecure = process.env.NODE_ENV === 'production';
/** NextAuth v5 session-token cookie name */
const SESSION_COOKIE = isSecure
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

/**
 * POST /api/admin/impersonate
 * Start impersonating another user. OWNER only.
 * 
 * This route:
 * 1. Sets impersonation metadata cookies (so the JWT callback can keep the swap alive)
 * 2. Force-encodes a new JWT with the target user's identity so the swap is IMMEDIATE
 */
export async function POST(request: NextRequest) {
  const session = await MyLibUserAuth();

  if (!session?.id || !isOwner(session.role)) {
    return NextResponse.json({ error: 'Forbidden — OWNER only' }, { status: 403 });
  }

  let body: z.infer<typeof ImpersonateBodySchema>;
  try {
    const json = await request.json();
    const parsed = ImpersonateBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { targetUserId, reason } = body;

  // Don't allow self-impersonation
  if (targetUserId === session.id) {
    return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 });
  }

  // Load the FULL target user (we need all fields for the JWT)
  const targetUser = await dbPrisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Log the impersonation action
  await logAdminAction({
    adminId: session.id,
    action: AdminAction.IMPERSONATE,
    targetType: AdminTargetType.USER,
    targetId: targetUserId,
    newData: {
      targetName: targetUser.name,
      targetEmail: targetUser.email,
      reason: reason || null,
    },
    reason: reason || 'Owner impersonation swap',
  });

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60, // 1 hour max impersonation
  };

  // ── 1. Set impersonation metadata cookies ────────────────────────
  cookieStore.set('x-impersonate-owner-id', session.id, cookieOpts);
  cookieStore.set('x-impersonate-owner-name', session.name || 'Owner', cookieOpts);
  cookieStore.set('x-impersonate-target-id', targetUserId, cookieOpts);

  // ── 2. Force-encode a new JWT with the target's identity ─────────
  // This makes the swap immediate — no waiting for JWT callback refresh.
  const targetAccount = await getAccountByUserId(targetUser.id);
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (secret) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const newToken = await encode({
        token: {
          sub: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          picture: targetUser.image, // NextAuth uses 'picture' internally
          image: targetUser.image,
          role: targetUser.role,
          isTwoFactorEnabled: targetUser.isTwoFactorEnabled,
          referredBy: targetUser.referredBy,
          isOAuth: !!targetAccount,
          web3ModeEnabled: targetUser.web3ModeEnabled,
          tokenVersion: targetUser.tokenVersion,
          // Impersonation metadata
          isImpersonating: true,
          impersonatingFromId: session.id,
          impersonatingFromName: session.name || 'Owner',
          iat: now,
          exp: now + 60 * 60, // 1 hour
        },
        secret,
        salt: SESSION_COOKIE,
      });

      cookieStore.set(SESSION_COOKIE, newToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60,
      });
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to encode impersonation JWT:`, err);
      // Non-fatal — the JWT callback will still pick up the impersonation cookies
    }
  }

  console.log(
    `${LOG_PREFIX} OWNER ${session.id} (${session.name}) started impersonating ${targetUserId} (${targetUser.name})`
  );

  return NextResponse.json({
    success: true,
    message: `Now impersonating ${targetUser.name || targetUser.email}`,
    targetUser: {
      id: targetUser.id,
      name: targetUser.name,
    },
  });
}
