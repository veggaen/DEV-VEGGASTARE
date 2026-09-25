import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { dbPrisma } from '@/lib/db';
import { previewSessionId } from './impersonation-policy';

const signoutAttempt = new AsyncLocalStorage<{ failed: boolean }>();
export const PREVIEW_SIGNOUT_ERROR = 'Sign-out could not be confirmed. Please try again.';

/** Called only by Auth.js after its normal CSRF/sign-out validation. */
export async function revokePreviewOnSignOut(token: Record<string, unknown>) {
  if (token.isImpersonating !== true) return;
  const id = previewSessionId(token);
  // Legacy/malformed preview claims already fail session validation.
  if (!id || typeof token.sub !== 'string' || typeof token.impersonatingFromId !== 'string'
    || !Number.isSafeInteger(token.tokenVersion) || !Number.isSafeInteger(token.impersonationOwnerVersion)) return;
  try {
    await dbPrisma.$transaction(async tx => {
      const ended = await tx.accountPreviewSession.updateMany({ where: {
        id, ownerId: token.impersonatingFromId as string, targetId: token.sub as string,
        ownerVersion: token.impersonationOwnerVersion as number, targetVersion: token.tokenVersion as number,
        endedAt: null,
      }, data: { endedAt: new Date() } });
      if (ended.count === 0) return; // Already ended, missing or mismatched: no valid grant to revoke.
      await tx.adminAuditLog.create({ data: {
        adminId: token.impersonatingFromId as string, action: 'IMPERSONATE', targetType: 'USER', targetId: token.sub as string,
        reason: 'Owner signed out of read-only preview', newData: { phase: 'signout', readOnly: true, previewSessionId: id },
      }, select: { id: true } });
    }, { timeout: 10_000, maxWait: 5_000 });
  } catch {
    const attempt = signoutAttempt.getStore();
    if (attempt) attempt.failed = true;
    // Auth.js logs event errors; do not pass raw database/provider details through.
    throw new Error(PREVIEW_SIGNOUT_ERROR);
  }
}

/** Auth.js catches event failures and still clears cookies. Preserve the old
 * cookie and show a retryable 503 when durable preview revocation failed.
 * Request-scoped storage prevents one simultaneous logout affecting another.
 * We deliberately do not parse or bypass Auth.js CSRF/callback handling here. */
export async function confirmedSignOutRoute<T extends Request>(request: T, handler: (request: T) => Promise<Response>) {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/auth/signout') return handler(request);
  return signoutAttempt.run({ failed: false }, async () => {
    const response = await handler(request);
    if (signoutAttempt.getStore()?.failed) return Response.json({ error: PREVIEW_SIGNOUT_ERROR }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    });
    return response;
  });
}
