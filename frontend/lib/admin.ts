import { dbPrisma } from '@/lib/db';
import { UserRole, AdminAction, AdminTargetType } from '@/generated/prisma/browser';
import { headers } from 'next/headers';

/**
 * Check if the user has admin permissions (OWNER or ADMIN role)
 */
export function isAdmin(role: string | undefined | null): boolean {
  return role === UserRole.OWNER || role === UserRole.ADMIN;
}

/**
 * Check if the user is the platform owner (highest permission)
 */
export function isOwner(role: string | undefined | null): boolean {
  return role === UserRole.OWNER;
}

/**
 * Get client IP address from headers
 */
export async function getClientIp(): Promise<string | null> {
  const headersList = await headers();
  return (
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    null
  );
}

/**
 * Get user agent from headers
 */
export async function getUserAgent(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get('user-agent') || null;
}

/**
 * Log an admin action to the audit log
 */
export async function logAdminAction({
  adminId,
  action,
  targetType,
  targetId,
  previousData,
  newData,
  reason,
}: {
  adminId: string;
  action: AdminAction;
  targetType: AdminTargetType;
  targetId: string;
  previousData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  reason?: string;
}): Promise<void> {
  try {
    const [ipAddress, userAgent] = await Promise.all([
      getClientIp(),
      getUserAgent(),
    ]);

    await dbPrisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        previousData: previousData ? JSON.parse(JSON.stringify(previousData)) : null,
        newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
        ipAddress,
        userAgent,
        reason,
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('[AdminAuditLog] Failed to log action:', error);
  }
}

/**
 * Fields that admins are allowed to edit on users
 */
export const ADMIN_USER_EDITABLE_FIELDS = [
  'name',
  'email',
  'image',
  'banner',
  'bio',
  'role',
  'verificationTier',
  'verificationScore',
] as const;

/**
 * Fields that admins are allowed to edit on companies
 */
export const ADMIN_COMPANY_EDITABLE_FIELDS = [
  'name',
  'description',
  'websiteUrl',
  'logo',
  'bannerImage',
  'colorScheme',
  'orgNumber',
  'orgType',
  'usesShipping',
] as const;

/**
 * Fields that admins are allowed to edit on employees
 */
export const ADMIN_EMPLOYEE_EDITABLE_FIELDS = [
  'role',
  'permissions',
  'jobTitle',
] as const;

/**
 * Sanitize data to only include allowed fields
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  data: T,
  allowedFields: readonly string[]
): Partial<T> {
  const sanitized: Partial<T> = {};
  for (const field of allowedFields) {
    if (field in data) {
      sanitized[field as keyof T] = data[field as keyof T];
    }
  }
  return sanitized;
}
