import 'server-only';
import { z } from 'zod';
import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { AUTH_COOKIE_OPTIONS, SESSION_COOKIE_NAME } from '@/lib/auth-cookies';
import { isDemoUserId } from '@/lib/demo-policy';
import { IMPERSONATION_SECONDS, validImpersonation } from './impersonation-policy';

class SwitchError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const select = { id: true, role: true, tokenVersion: true, name: true, updatedAt: true } as const;
const schema = z.object({ targetUserId: z.string().min(1).max(100), expectedUpdatedAt: z.string().datetime(), reason: z.string().trim().min(3).max(500) }).strict();
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });

async function readInput(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) throw new SwitchError('Send a JSON preview request.', 400);
  const reader = request.body.getReader(), decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 4096) throw new SwitchError('Preview request is too large.', 413);
      text += decoder.decode(value, { stream: true });
    }
    try { const parsed = schema.safeParse(JSON.parse(text + decoder.decode())); if (parsed.success) return parsed.data; } catch { /* safe validation error below */ }
    throw new SwitchError('Reload the user details and provide a reason for this preview.', 400);
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

function setSession(response: NextResponse, request: Request, value: string, maxAge: number) {
  // Remove old chunks so a previously larger cookie cannot override this one.
  const names = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim().split('=')[0]);
  for (const name of names) if (name.startsWith(`${SESSION_COOKIE_NAME}.`) && /^\d+$/.test(name.slice(SESSION_COOKIE_NAME.length + 1))) {
    response.cookies.set(name, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  }
  for (const name of ['x-impersonate-owner-id', 'x-impersonate-owner-name', 'x-impersonate-target-id']) response.cookies.set(name, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(SESSION_COOKIE_NAME, value, { ...AUTH_COOKIE_OPTIONS, maxAge });
  return response;
}

/** UI routes only: no caller-supplied actor or owner ID can authorize a switch. */
export async function switchAccount(request: Request, end = false) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new SwitchError('Open Veggat on this site and try again.', 403);
    const actor = await MyLibUserAuth();
    if (!actor?.id) throw new SwitchError('Your session expired. Sign in again.', 401);
    if (isDemoUserId(actor.id)) throw new SwitchError('Demo accounts cannot preview other accounts.', 403);
    if (end ? !actor.isImpersonating : actor.isImpersonating || actor.role !== 'OWNER') throw new SwitchError('This session cannot switch accounts.', 403);
    const ownerId = end ? actor.impersonatingFromId : actor.id;
    if (!ownerId || isDemoUserId(ownerId)) throw new SwitchError('Sign in again to your own account.', 401);
    if (!await allowAuthAttempt(end ? 'impersonation-end' : 'impersonation-start', ownerId, request)) throw new SwitchError('Too many attempts. Wait a few minutes before retrying.', 429);
    const input = end ? null : await readInput(request);
    const targetId = end ? actor.id : input!.targetUserId;
    if (targetId === ownerId || isDemoUserId(targetId)) throw new SwitchError('Choose a different, non-demo member.', 400);
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) throw new SwitchError('Account preview is temporarily unavailable.', 503);
    const result = await dbPrisma.$transaction(async tx => {
      // Stable lock ordering; role/password revocation cannot race issuance.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${ownerId}, ${targetId}) ORDER BY "id" FOR SHARE`;
      const [owner, target] = await Promise.all([
        tx.user.findUnique({ where: { id: ownerId }, select }), tx.user.findUnique({ where: { id: targetId }, select }),
      ]);
      if (!owner || owner.role !== 'OWNER' || !target || target.role !== 'USER') throw new SwitchError('Preview is available only to the owner for ordinary member accounts.', 403);
      if (end) {
        if (!validImpersonation({ ...actor, sub: actor.id, tokenVersion: actor.sessionVersion }, owner, target)) throw new SwitchError('This preview expired or was revoked. Sign in again.', 401);
      } else {
        if (!Number.isSafeInteger(actor.sessionVersion) || actor.sessionVersion !== owner.tokenVersion) throw new SwitchError('Your session changed. Sign in again.', 401);
        if (target.updatedAt.toISOString() !== input!.expectedUpdatedAt) throw new SwitchError('This account changed. Reload its details before previewing.', 409);
      }
      const now = Math.floor(Date.now() / 1000), maxAge = end ? 30 * 24 * 60 * 60 : IMPERSONATION_SECONDS;
      const token = await encode({ secret, salt: SESSION_COOKIE_NAME, maxAge, token: end ? {
        sub: owner.id, tokenVersion: owner.tokenVersion, isImpersonating: false,
      } : {
        sub: target.id, tokenVersion: target.tokenVersion, isImpersonating: true, impersonatingFromId: owner.id,
        impersonationOwnerVersion: owner.tokenVersion, impersonationStartedAt: now, impersonationExpiresAt: now + maxAge,
      } });
      // An unavailable audit store fails before a session cookie is issued.
      await tx.adminAuditLog.create({ data: { adminId: owner.id, action: 'IMPERSONATE', targetType: 'USER', targetId: target.id,
        reason: end ? 'Owner ended read-only preview' : input!.reason,
        newData: { phase: end ? 'end' : 'start', readOnly: true, ...(end ? {} : { expiresAt: now + maxAge }) },
      }, select: { id: true } });
      return { token, maxAge };
    }, { timeout: 10_000, maxWait: 5_000 });
    return setSession(reply({ success: true, redirect: end ? '/admin/users' : '/', message: end ? 'Returned to your account.' : 'Read-only preview started.' }), request, result.token, result.maxAge);
  } catch (error) {
    return reply({ error: error instanceof SwitchError ? error.message : 'The account switch could not be confirmed. Refresh before retrying.' }, error instanceof SwitchError ? error.status : 503);
  }
}
