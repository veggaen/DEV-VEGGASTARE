import { isDemoUserId } from './demo-policy';

export const IMPERSONATION_SECONDS = 60 * 60;
type Principal = { id: string; role: string; tokenVersion: number };
type Claims = Record<string, unknown>;

export function previewSessionId(token: Claims): string | null {
  return typeof token.impersonationSessionId === 'string'
    && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token.impersonationSessionId)
    ? token.impersonationSessionId : null;
}

/** A copied or rolling-renewed cookie cannot outlive its server-owned grant. */
export function validPreviewSession(token: Claims, record: {
  id: string; ownerId: string; targetId: string; ownerVersion: number;
  targetVersion: number; startedAt: Date; expiresAt: Date; endedAt: Date | null;
} | null, now = Date.now()) {
  return !!record && previewSessionId(token) === record.id && record.endedAt === null
    && record.ownerId === token.impersonatingFromId && record.targetId === token.sub
    && record.ownerVersion === token.impersonationOwnerVersion && record.targetVersion === token.tokenVersion
    && record.startedAt.getTime() === Number(token.impersonationStartedAt) * 1000
    && record.expiresAt.getTime() === Number(token.impersonationExpiresAt) * 1000
    && record.startedAt.getTime() <= now && record.expiresAt.getTime() > now;
}

/** An absolute deadline survives Auth.js rolling JWT renewal. */
export function validImpersonation(token: Claims, owner: Principal | null, target: Principal | null, now = Date.now()) {
  return !!owner && !!target && owner.role === 'OWNER' && target.role === 'USER'
    && owner.id !== target.id && !isDemoUserId(owner.id) && !isDemoUserId(target.id)
    && token.isImpersonating === true && token.sub === target.id && token.impersonatingFromId === owner.id
    && Number.isSafeInteger(token.tokenVersion) && token.tokenVersion === target.tokenVersion
    && Number.isSafeInteger(token.impersonationOwnerVersion) && token.impersonationOwnerVersion === owner.tokenVersion
    && typeof token.impersonationStartedAt === 'number' && Number.isSafeInteger(token.impersonationStartedAt)
    && typeof token.impersonationExpiresAt === 'number' && Number.isSafeInteger(token.impersonationExpiresAt)
    && token.impersonationStartedAt <= Math.floor(now / 1000)
    && token.impersonationExpiresAt > Math.floor(now / 1000)
    && token.impersonationExpiresAt - token.impersonationStartedAt > 0
    && token.impersonationExpiresAt - token.impersonationStartedAt <= IMPERSONATION_SECONDS;
}

/** Support preview cannot buy, send, link identities or invoke Server Actions. */
export function allowsImpersonationRequest(path: string, method: string, serverAction = false) {
  if (serverAction) return false;
  if (path === '/api/admin/impersonate/end') return method === 'POST';
  if (path === '/api/auth/signout') return method === 'POST' || method === 'GET';
  const read = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (path === '/api/auth' || path.startsWith('/api/auth/')) {
    return read && ['/api/auth/session', '/api/auth/csrf', '/api/auth/providers'].includes(path);
  }
  // Legacy GET handlers also have side effects (capture, consume downloads,
  // create preferences, expire trades or initialize accounts). Method alone
  // is not a sufficient read-only boundary.
  const blocked = ['/api/download', '/api/payments', '/api/trades', '/api/system',
    '/api/users/privacy-settings', '/api/users/ai-keys', '/api/notifications/settings',
    '/api/companies/verify-org', '/auth/security-action'];
  if (blocked.some(prefix => path === prefix || path.startsWith(prefix + '/'))
    || /^\/api\/ai-media\/[^/]+\/content$/.test(path)) return false;
  return read;
}
