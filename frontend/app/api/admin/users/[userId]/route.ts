import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { 
  isAdmin, 
  isOwner,
  logAdminAction, 
  ADMIN_USER_EDITABLE_FIELDS, 
  sanitizeFields 
} from '@/lib/admin';
import { AdminAction, AdminTargetType, UserRole } from '@/generated/prisma/browser';

const LOG_PREFIX = '[api/admin/users/[userId]]';

type RouteContext = { params: Promise<{ userId: string }> };

// GET /api/admin/users/[userId] - Get full user details for admin
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await context.params;

  try {
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        banner: true,
        bio: true,
        role: true,
        verificationTier: true,
        verificationScore: true,
        createdAt: true,
        updatedAt: true,
        phoneNumber: true,
        phoneVerified: true,
        hasDiscordAuth: true,
        hasGithubAuth: true,
        hasGoogleAuth: true,
        hasVerifiedWallet: true,
        isTwoFactorEnabled: true,
        // Related data counts
        _count: {
          select: {
            Company_Company_ownerIdToUser: true,
            Company_Company_creatorIdToUser: true,
            Employee: true,
            Order: true,
            Conversation: true,
            followers: true,
            following: true,
          },
        },
        // Get companies they own
        Company_Company_ownerIdToUser: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
          take: 5,
        },
        // Get employments
        Employee: {
          select: {
            id: true,
            role: true,
            jobTitle: true,
            Company: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
          take: 5,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log that admin viewed this user (for audit trail)
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.VIEW,
      targetType: AdminTargetType.USER,
      targetId: userId,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching user:`, error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PATCH /api/admin/users/[userId] - Update user as admin
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await context.params;

  try {
    const body = await request.json();
    const { reason, ...updateFields } = body;

    // Get current user data for audit log
    const currentUser = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        banner: true,
        bio: true,
        role: true,
        verificationTier: true,
        verificationScore: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Special handling for role changes - only OWNER can change roles
    if ('role' in updateFields) {
      if (!isOwner(session.role)) {
        return NextResponse.json(
          { error: 'Only the platform owner can change user roles' },
          { status: 403 }
        );
      }

      // Prevent demoting yourself
      if (userId === session.id) {
        return NextResponse.json(
          { error: 'Cannot change your own role' },
          { status: 400 }
        );
      }

      // Validate role value
      if (!['USER', 'ADMIN', 'OWNER'].includes(updateFields.role)) {
        return NextResponse.json(
          { error: 'Invalid role value' },
          { status: 400 }
        );
      }
    }

    // Sanitize to only allowed fields
    const sanitizedData = sanitizeFields(updateFields, ADMIN_USER_EDITABLE_FIELDS);

    if (Object.keys(sanitizedData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Validate URLs for image fields
    for (const field of ['image', 'banner'] as const) {
      if (field in sanitizedData && sanitizedData[field]) {
        try {
          new URL(sanitizedData[field] as string);
        } catch {
          return NextResponse.json(
            { error: `Invalid URL for ${field}` },
            { status: 400 }
          );
        }
      }
    }

    // Determine if this is a role change action
    const isRoleChange = 'role' in sanitizedData && sanitizedData.role !== currentUser.role;

    // Update the user
    const updatedUser = await dbPrisma.user.update({
      where: { id: userId },
      data: sanitizedData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        banner: true,
        bio: true,
        role: true,
        verificationTier: true,
        verificationScore: true,
        updatedAt: true,
      },
    });

    // Log the action
    await logAdminAction({
      adminId: session.id,
      action: isRoleChange ? AdminAction.ROLE_CHANGE : AdminAction.EDIT,
      targetType: AdminTargetType.USER,
      targetId: userId,
      previousData: currentUser,
      newData: updatedUser,
      reason,
    });

    return NextResponse.json({ 
      user: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating user:`, error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[userId] - Delete user (soft delete or full)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  
  // Only OWNER can delete users
  if (!session?.id || !isOwner(session.role)) {
    return NextResponse.json({ error: 'Only the platform owner can delete users' }, { status: 403 });
  }

  const { userId } = await context.params;

  // Prevent self-deletion
  if (userId === session.id) {
    return NextResponse.json(
      { error: 'Cannot delete your own account' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Get user data for audit log before deletion
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log before deletion
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.DELETE,
      targetType: AdminTargetType.USER,
      targetId: userId,
      previousData: user,
      reason,
    });

    // Delete the user (cascade will handle related records)
    await dbPrisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ 
      message: 'User deleted successfully',
      deletedUserId: userId,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error deleting user:`, error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
