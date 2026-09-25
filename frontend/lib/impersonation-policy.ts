import { isDemoUserId } from './demo-policy';

export const IMPERSONATION_SECONDS = 60 * 60;
type Principal = { id: string; role: string; tokenVersion: number };
type Claims = Record<string, unknown>;

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
