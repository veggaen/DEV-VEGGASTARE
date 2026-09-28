import 'server-only';
import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { allowAuthAttempt, allowAdminDetailRead } from '@/lib/auth-rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';
import { adminUserPatchSchema, adminUserPermissions, adminProfileFields } from './admin-user-detail-policy';
import type { Prisma } from '@/generated/prisma/client';

class DetailError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string>) { super(message); }
}
const fail = (message: string, status: number): never => { throw new DetailError(message, status); };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: {
  'Cache-Control': 'private, no-store', Vary: 'Cookie', ...(status === 429 ? { 'Retry-After': '300' } : {}),
} });
const actorSelect = { id: true, role: true, tokenVersion: true } as const;
const editSelect = { id: true, name: true, bio: true, image: true, banner: true, role: true, updatedAt: true } as const;
const detailSelect = {
  ...editSelect, email: true, emailVerified: true, createdAt: true, verificationTier: true, verificationScore: true,
  hasGoogleAuth: true, hasGithubAuth: true, hasDiscordAuth: true, hasVerifiedWallet: true, isTwoFactorEnabled: true,
  _count: { select: { Company_Company_ownerIdToUser: true, Employee: true, Order: true, Conversation: true, followers: true, following: true } },
  Company_Company_ownerIdToUser: { select: { id: true, name: true, logo: true }, take: 5, orderBy: { id: 'asc' } },
  Employee: { select: { id: true, role: true, jobTitle: true, Company: { select: { id: true, name: true, logo: true } } }, take: 5, orderBy: { id: 'asc' } },
} satisfies Prisma.UserSelect;

async function readPatch(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) fail('Send a JSON account update.', 400);
  const reader = request.body!.getReader(), decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 16_384) fail('This update is too large.', 413);
      text += decoder.decode(value, { stream: true });
    }
    let raw: unknown;
    try { raw = JSON.parse(text + decoder.decode()); } catch { fail('The update is not valid JSON.', 400); }
    const parsed = adminUserPatchSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) if (typeof issue.path[0] === 'string') fields[issue.path[0]] = issue.message;
      throw new DetailError('Review the fields. Email, verification and ownership cannot be replaced here.', 400, fields);
    }
    return parsed.data;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Session actor is never supplied by callers. Writes and their audit commit together. */
export async function adminUserDetail(request: Request, userId: string, method: 'GET' | 'PATCH' | 'DELETE') {
  try {
    const actor = await MyLibUserAuth();
    if (!actor?.id) fail('Your session expired. Sign in again.', 401);
    if (!actor || actor.isImpersonating || isDemoUserId(actor.id!) || !['OWNER', 'ADMIN'].includes(actor.role)) fail('This account cannot manage users.', 403);
    if (method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) fail('Open this form on Veggat and try again.', 403);
    if (!userId || userId.length > 100) fail('Invalid account identifier.', 400);
    const allowed = method === 'GET' ? await allowAdminDetailRead(actor!.id!, request) : await allowAuthAttempt('admin-user-edit', actor!.id!, request);
    if (!allowed) fail('Too many requests or administration is temporarily unavailable. Try again in a few minutes.', 429);
    // Never cascade through financial, delivery or audit records. Retention-
    // reviewed erasure is a separate workflow, not a hidden button here.
    if (method === 'DELETE') return reply({ error: 'Direct account deletion is unavailable. Account erasure requires a retention review.' }, 409);
    const input = method === 'PATCH' ? await readPatch(request) : null;
    return await dbPrisma.$transaction(async tx => {
      if (input) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actor!.id}, ${userId}) ORDER BY "id" FOR UPDATE`;
      else await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actor!.id}, ${userId}) ORDER BY "id" FOR SHARE`;
      const currentActor = await tx.user.findUnique({ where: { id: actor!.id }, select: actorSelect });
      if (!currentActor || !Number.isSafeInteger(actor!.sessionVersion) || currentActor.tokenVersion !== actor!.sessionVersion) fail('Your session changed. Sign in again.', 401);
      if (!['ADMIN', 'OWNER'].includes(currentActor!.role)) fail('Your administration access changed. Sign in again.', 403);
      if (!input) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: detailSelect });
        if (!user) fail('User not found.', 404);
        await tx.adminAuditLog.create({ data: { adminId: actor!.id!, action: 'VIEW', targetType: 'USER', targetId: userId }, select: { id: true } });
        return reply({ user, permissions: adminUserPermissions(currentActor!, user!) });
      }
      const current = await tx.user.findUnique({ where: { id: userId }, select: editSelect });
      if (!current) fail('User not found.', 404);
      const permissions = adminUserPermissions(currentActor!, current!);
      if (!permissions.edit) fail('This account is read-only here. Use personal Settings for your own profile.', 403);
      if (current!.updatedAt.toISOString() !== input.expectedUpdatedAt) fail('This account changed elsewhere. Your draft is kept; reload the saved account before editing again.', 409);
      if (input.role !== undefined && !permissions.changeRole) fail('Only the owner can change member and admin roles.', 403);
      const data: Prisma.UserUpdateInput = {}, previous: Record<string, string | null> = {}, next: Record<string, string | null> = {};
      for (const field of adminProfileFields) if (input[field] !== undefined && input[field] !== current![field]) {
        data[field] = input[field]; previous[field] = current![field]; next[field] = input[field]!;
      }
      const roleChanged = input.role !== undefined && input.role !== current!.role;
      if (roleChanged) {
        data.role = input.role; data.tokenVersion = { increment: 1 };
        previous.role = current!.role; next.role = input.role!;
      }
      if (Object.keys(data).length === 0) fail('No fields changed.', 400);
      data.updatedAt = new Date(Math.max(Date.now(), current!.updatedAt.getTime() + 1));
      const user = await tx.user.update({ where: { id: userId }, data, select: editSelect });
      await tx.adminAuditLog.create({ data: { adminId: actor!.id!, action: roleChanged ? 'ROLE_CHANGE' : 'EDIT', targetType: 'USER', targetId: userId,
        previousData: previous, newData: next, reason: input.reason }, select: { id: true } });
      return reply({ user, permissions: adminUserPermissions(currentActor!, user), message: roleChanged ? 'Changes saved. Existing account sessions were revoked.' : 'Changes saved.' });
    }, { timeout: 10_000, maxWait: 5_000 });
  } catch (error) {
    return reply({ error: error instanceof DetailError ? error.message : 'Changes could not be confirmed. Your draft is kept; reload the saved account before retrying.',
      ...(error instanceof DetailError && error.fields ? { fields: error.fields } : {}) }, error instanceof DetailError ? error.status : 503);
  }
}
