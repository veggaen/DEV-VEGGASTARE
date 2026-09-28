import 'server-only';
import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isDemoUserId } from '@/lib/demo-policy';
import { checkRateLimit } from '@/lib/rate-limit';
import { allowAuthAttempt, allowAdminDetailRead } from '@/lib/auth-rate-limit';
import { adminCompanyFields, adminCompanyPatchSchema, adminCompanyQuerySchema } from './admin-company-policy';
import type { Prisma } from '@/generated/prisma/client';
import { companyCheckoutCounts } from './company-checkout-counts';

class CompanyError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string>) { super(message); }
}
function fail(message: string, status: number): never { throw new CompanyError(message, status); }
const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: {
  'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extra,
} });
const failure = (error: unknown) => reply({ error: error instanceof CompanyError ? error.message : 'Company administration is unavailable. Try again.',
  ...(error instanceof CompanyError && error.fields ? { fields: error.fields } : {}) }, error instanceof CompanyError ? error.status : 503);
const actorSelect = { id: true, role: true, tokenVersion: true } as const;
const summarySelect = {
  id: true, name: true, orgNumber: true, orgType: true, createdAt: true,
  User_Company_ownerIdToUser: { select: { id: true, name: true } },
  _count: { select: { Employee: true, Product: true, Sale: true } },
} satisfies Prisma.CompanySelect;
const editSelect = { id: true, name: true, description: true, websiteUrl: true, logo: true, bannerImage: true, colorScheme: true, usesShipping: true, updatedAt: true } as const;
const detailSelect = { ...summarySelect, ...editSelect, employmentNoticeDays: true,
  User_Company_creatorIdToUser: { select: { id: true, name: true } },
  orgVerification: { select: { status: true, verifiedAt: true } },
  _count: { select: { Employee: true, Product: true, Sale: true, WarehouseLocation: true } },
} satisfies Prisma.CompanySelect;

async function actorFor(request: Request, write = false) {
  const actor = await MyLibUserAuth();
  if (!actor?.id) fail('Your session expired. Sign in again.', 401);
  if (!actor || actor.isImpersonating || isDemoUserId(actor.id!) || !['ADMIN', 'OWNER'].includes(actor.role)) fail('Admin access is required.', 403);
  if (write && request.headers.get('origin') !== new URL(request.url).origin) fail('Open this form on Veggat and try again.', 403);
  return actor! as typeof actor & { id: string };
}
async function verifyActor(tx: Prisma.TransactionClient, actor: { id: string; sessionVersion?: number }) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR SHARE`;
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: actorSelect });
  if (!current || !Number.isSafeInteger(actor.sessionVersion) || current.tokenVersion !== actor.sessionVersion) fail('Your session changed. Sign in again.', 401);
  if (!['ADMIN', 'OWNER'].includes(current!.role)) fail('Admin access is required.', 403);
}

export async function adminCompanies(request: Request) {
  try {
    const actor = await actorFor(request), params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => params.getAll(key).length !== 1)) fail('Invalid company filters.', 400);
    const parsed = adminCompanyQuerySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) fail('Invalid company filters.', 400);
    const rate = await checkRateLimit('admin-companies:' + actor.id, 'read');
    if (!rate.success) return reply({ error: 'Wait a moment before retrying.' }, 429, { 'Retry-After': String(Math.max(1, rate.resetIn)) });
    const { search, page, limit, sortBy, sortOrder } = parsed.data;
    const literal = search.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.CompanyWhereInput = literal ? { OR: [
      { name: { contains: literal, mode: 'insensitive' } }, { orgNumber: { contains: literal } }, { id: { contains: literal } },
    ] } : {};
    return await dbPrisma.$transaction(async tx => {
      await verifyActor(tx, actor);
      const companies = await tx.company.findMany({ where, select: summarySelect, orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }], skip: (page - 1) * limit, take: limit });
      const total = await tx.company.count({ where });
      const counts = await companyCheckoutCounts(tx, companies.map(company => company.id));
      return reply({ companies: companies.map(company => ({ ...company, checkoutCounts: counts.get(company.id)! })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }, { isolationLevel: 'RepeatableRead', timeout: 10_000, maxWait: 5000 });
  } catch (error) { return failure(error); }
}

async function readPatch(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) fail('Send a JSON company update.', 400);
  const reader = request.body!.getReader(), decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 32_768) fail('This update is too large.', 413);
      text += decoder.decode(value, { stream: true });
    }
    let raw: unknown;
    try { raw = JSON.parse(text + decoder.decode()); } catch { fail('The update is not valid JSON.', 400); }
    const parsed = adminCompanyPatchSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) if (typeof issue.path[0] === 'string') fields[issue.path[0]] = issue.message;
      throw new CompanyError('Review the fields. Ownership, registration and payouts cannot be replaced here.', 400, fields);
    }
    return parsed.data;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

export async function adminCompanyDetail(request: Request, companyId: string, method: 'GET' | 'PATCH' | 'DELETE') {
  try {
    const actor = await actorFor(request, method !== 'GET');
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(companyId)) fail('Invalid company identifier.', 400);
    const allowed = method === 'GET' ? await allowAdminDetailRead(actor.id, request) : await allowAuthAttempt('admin-company-edit', actor.id, request);
    if (!allowed) return reply({ error: 'Wait a few minutes before retrying.' }, 429, { 'Retry-After': '300' });
    // Never cascade through products, financial history or private deliverables.
    if (method === 'DELETE') return reply({ error: 'Company deletion requires a retention review. No records were removed.' }, 409);
    const input = method === 'PATCH' ? await readPatch(request) : null;
    return await dbPrisma.$transaction(async tx => {
      await verifyActor(tx, actor);
      if (input) await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;
      const current = await tx.company.findUnique({ where: { id: companyId }, select: input ? editSelect : detailSelect });
      if (!current) fail('Company not found.', 404);
      if (!input) {
        const counts = await companyCheckoutCounts(tx, [companyId]);
        await tx.adminAuditLog.create({ data: { adminId: actor.id, action: 'VIEW', targetType: 'COMPANY', targetId: companyId }, select: { id: true } });
        return reply({ company: { ...current, checkoutCounts: counts.get(companyId)! } });
      }
      if (current!.updatedAt.toISOString() !== input.expectedUpdatedAt) fail('This company changed elsewhere. Your draft is kept; reload the saved company before editing again.', 409);
      const data: Record<string, string | string[] | boolean | null> = {}, previous: Record<string, string | string[] | boolean | null> = {};
      for (const key of adminCompanyFields) if (input[key] !== undefined && JSON.stringify(input[key]) !== JSON.stringify(current![key])) {
        data[key] = input[key]!; previous[key] = current![key];
      }
      if (!Object.keys(data).length) fail('No fields changed.', 400);
      const company = await tx.company.update({ where: { id: companyId }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), current!.updatedAt.getTime() + 1)) }, select: editSelect });
      await tx.adminAuditLog.create({ data: { adminId: actor.id, action: 'EDIT', targetType: 'COMPANY', targetId: companyId, previousData: previous, newData: data, reason: input.reason }, select: { id: true } });
      return reply({ company, message: 'Company changes saved.' });
    }, { isolationLevel: input ? 'ReadCommitted' : 'RepeatableRead', timeout: 10_000, maxWait: 5000 });
  } catch (error) { return failure(error); }
}
