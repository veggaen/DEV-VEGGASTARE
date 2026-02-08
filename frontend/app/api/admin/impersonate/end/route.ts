import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { logAdminAction } from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@prisma/client';
import { cookies } from 'next/headers';

const LOG_PREFIX = '[api/admin/impersonate/end]';

/**
 * POST /api/admin/impersonate/end
 * End impersonation and restore the original OWNER session.
 * Clears the impersonation cookies, triggering the JWT callback to
 * revert to the owner's own identity on next token refresh.
 */
export async function POST() {
  const cookieStore = await cookies();
  const ownerId = cookieStore.get('x-impersonate-owner-id')?.value;
  const targetId = cookieStore.get('x-impersonate-target-id')?.value;

  if (!ownerId) {
    return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 });
  }

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

  // Clear all impersonation cookies
  cookieStore.delete('x-impersonate-owner-id');
  cookieStore.delete('x-impersonate-owner-name');
  cookieStore.delete('x-impersonate-target-id');

  console.log(`${LOG_PREFIX} OWNER ${ownerId} ended impersonation of ${targetId}`);

  return NextResponse.json({
    success: true,
    message: 'Impersonation ended. Refreshing to your account.',
  });
}
