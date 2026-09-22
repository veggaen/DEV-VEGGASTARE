import { NextResponse } from 'next/server';
import { logAdminAction } from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@/generated/prisma/browser';
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { getUserById } from '@/data/user';
import { getAccountByUserId } from '@/lib/account';
import { MyLibUserAuth } from '@/lib/user-auth';
import { AUTH_COOKIE_OPTIONS, SESSION_COOKIE_NAME } from '@/lib/auth-cookies';

const LOG_PREFIX = '[api/admin/impersonate/end]';

const isSecure = AUTH_COOKIE_OPTIONS.secure;
const SESSION_COOKIE = SESSION_COOKIE_NAME;

/**
 * POST /api/admin/impersonate/end
 * End impersonation and restore the original OWNER session.
 * 
 * 1. Force-encodes a new JWT with the owner's real identity
 * 2. Clears impersonation cookies
 */
export async function POST() {
  const cookieStore = await cookies();
  const session = await MyLibUserAuth();
  const ownerId = session?.isImpersonating ? session.impersonatingFromId : undefined;
  const targetId = session?.id;

  if (!ownerId) {
    return NextResponse.json({ error: 'Not currently impersonating' }, { status: 403 });
  }
  const verifiedOwner = await getUserById(ownerId);
  if (verifiedOwner?.role !== 'OWNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Log the end of impersonation
  if (targetId) {
    await logAdminAction({
      adminId: ownerId,
      action: AdminAction.IMPERSONATE,
      targetType: AdminTargetType.USER,
      targetId,
      newData: { action: 'end_impersonation' },
      reason: 'Owner ended impersonation session',
    });
  }

  // ── 1. Force-encode the owner's JWT to restore their session ─────
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) {
    try {
      const ownerUser = await getUserById(ownerId);
      if (ownerUser) {
        const ownerAccount = await getAccountByUserId(ownerUser.id);
        const now = Math.floor(Date.now() / 1000);

        const newToken = await encode({
          token: {
            sub: ownerUser.id,
            name: ownerUser.name,
            email: ownerUser.email,
            picture: ownerUser.image,
            image: ownerUser.image,
            role: ownerUser.role,
            isTwoFactorEnabled: ownerUser.isTwoFactorEnabled,
            referredBy: ownerUser.referredBy,
            isOAuth: !!ownerAccount,
            web3ModeEnabled: ownerUser.web3ModeEnabled,
            tokenVersion: ownerUser.tokenVersion,
            // Clear impersonation flags
            isImpersonating: false,
            impersonatingFromId: undefined,
            impersonatingFromName: undefined,
            iat: now,
            exp: now + 30 * 24 * 60 * 60, // 30 days (default session maxAge)
          },
          secret,
          salt: SESSION_COOKIE,
        });

        cookieStore.set(SESSION_COOKIE, newToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
        });
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to encode owner JWT:`, err);
    }
  }

  // ── 2. Clear all impersonation cookies ───────────────────────────
  cookieStore.delete('x-impersonate-owner-id');
  cookieStore.delete('x-impersonate-owner-name');
  cookieStore.delete('x-impersonate-target-id');

  console.log(`${LOG_PREFIX} OWNER ${ownerId} ended impersonation of ${targetId}`);

  return NextResponse.json({
    success: true,
    message: 'Impersonation ended. Refreshing to your account.',
  });
}
