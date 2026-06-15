/**
 * @fileOverview Email visibility utilities for public API serialization.
 *
 * Centralizes Phase 2 privacy behavior:
 * - Owners always see their own email
 * - Admin/Owner roles can view all emails
 * - Public viewers only see email when emailDisplayMode !== 'HIDE'
 *
 * @stability stable
 */

export type EmailDisplayModeValue = 'PRIMARY' | 'HIDE' | null | undefined;

interface ResolveVisibleEmailInput {
  targetUserId: string;
  targetEmail: string | null;
  targetEmailDisplayMode: EmailDisplayModeValue;
  viewerUserId?: string | null;
  viewerRole?: string | null;
}

function isPrivilegedRole(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'OWNER';
}

export function canViewerSeeEmail({
  targetUserId,
  targetEmailDisplayMode,
  viewerUserId,
  viewerRole,
}: Omit<ResolveVisibleEmailInput, 'targetEmail'>): boolean {
  if (!targetUserId) return false;
  if (viewerUserId && viewerUserId === targetUserId) return true;
  if (isPrivilegedRole(viewerRole)) return true;
  return targetEmailDisplayMode !== 'HIDE';
}

export function resolveVisibleEmail({
  targetUserId,
  targetEmail,
  targetEmailDisplayMode,
  viewerUserId,
  viewerRole,
}: ResolveVisibleEmailInput): string | null {
  if (!targetEmail) return null;
  if (
    canViewerSeeEmail({
      targetUserId,
      targetEmailDisplayMode,
      viewerUserId,
      viewerRole,
    })
  ) {
    return targetEmail;
  }
  return null;
}
