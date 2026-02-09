import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { isOwner, logAdminAction } from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@/generated/prisma/browser';
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';

const LOG_PREFIX = '[api/admin/impersonate]';

/**
 * POST /api/admin/impersonate
 * Start impersonating another user. OWNER only.
 * Sets a secure cookie with the original owner's ID so we can swap back.
 */
export async function POST(request: NextRequest) {
  const session = await MyLibUserAuth();

  if (!session?.id || !isOwner(session.role)) {
    return NextResponse.json({ error: 'Forbidden — OWNER only' }, { status: 403 });
  }

  let body: { targetUserId: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { targetUserId, reason } = body;

  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
  }

  // Don't allow self-impersonation
  if (targetUserId === session.id) {
    return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 });
  }

  // Verify target user exists
  const targetUser = await dbPrisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, role: true },
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

  // Set a secure httpOnly cookie with the owner's real identity.
  // This cookie is used by the JWT callback to know we're in impersonation mode,
  // and by the /end endpoint to restore the original session.
  const cookieStore = await cookies();
  
  cookieStore.set('x-impersonate-owner-id', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour max impersonation
  });

  cookieStore.set('x-impersonate-owner-name', session.name || 'Owner', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });

  cookieStore.set('x-impersonate-target-id', targetUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });

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
