/** @fileOverview Current-identity, action-specific product lifecycle authorization. @stability active */
import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';
import type { Prisma } from '@/generated/prisma/client';

export type ProductOperation = 'edit' | 'visibility' | 'archive';
export type ProductCapabilities = Record<ProductOperation, boolean>;
export const NO_PRODUCT_ACCESS: ProductCapabilities = { edit: false, visibility: false, archive: false };
type ProductActor = { id: string; sessionVersion: number };
const selection = { id: true, userId: true, companyId: true, title: true } as const;
type ManagedProduct = Prisma.ProductGetPayload<{ select: typeof selection }>;
export class ProductLifecycleError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}

/** Never trust the original author as owner of a company-owned listing. */
export async function productCapabilities(tx: Prisma.TransactionClient, actor: { id: string; role: string }, product: ManagedProduct): Promise<ProductCapabilities> {
  const all = { edit: true, visibility: true, archive: true };
  if (actor.role === 'ADMIN' || actor.role === 'OWNER') return all;
  if (!product.companyId) return product.userId === actor.id ? all : NO_PRODUCT_ACCESS;
  const company = await tx.company.findUnique({ where: { id: product.companyId }, select: { ownerId: true } });
  if (company?.ownerId === actor.id) return all;
  if (!company) return NO_PRODUCT_ACCESS;
  const employee = await tx.employee.findUnique({ where: { userId_companyId: { userId: actor.id, companyId: product.companyId } }, select: { permissions: true } });
  const p = employee?.permissions;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return NO_PRODUCT_ACCESS;
  return { edit: p.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true,
    visibility: p.CAN_MANAGE_PRODUCT_VISIBILITY === true, archive: p.CAN_DELETE_PRODUCT === true };
}

export async function productRequestActor(write = true): Promise<ProductActor> {
  const session = await auth(); const user = session?.user;
  if (!user?.id || !Number.isSafeInteger(user.sessionVersion)) throw new ProductLifecycleError('Sign in again to manage this listing.', 401);
  if (user.isDemo || isDemoUserId(user.id) || user.impersonatingFromId) throw new ProductLifecycleError('Use your own account to manage listings.');
  if (write) {
    const h = await headers(); const raw = h.get('origin');
    let origin: URL;
    try { origin = new URL(raw ?? ''); } catch { throw new ProductLifecycleError('Open the listing on this site and try again.'); }
    if (origin.origin !== raw || !['http:', 'https:'].includes(origin.protocol) || origin.host !== (h.get('x-forwarded-host') ?? h.get('host'))) {
      throw new ProductLifecycleError('Open the listing on this site and try again.');
    }
    if (!(await checkRateLimit(`product-lifecycle:${user.id}`, 'write')).success) throw new ProductLifecycleError('Too many changes. Wait a minute and try again.', 429);
  }
  return { id: user.id, sessionVersion: user.sessionVersion! };
}

/** Locks use the same User → Company order as team revocation; reads and writes
 * happen in one transaction so access cannot be revoked between check and save. */
export async function withProductAccess<T>(actor: ProductActor, productId: string, operation: ProductOperation | 'read', work: (tx: Prisma.TransactionClient, product: ManagedProduct, access: ProductCapabilities) => Promise<T>) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(productId)) throw new ProductLifecycleError('Listing not available.', 404);
  return dbPrisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR SHARE`;
    const current = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, tokenVersion: true } });
    if (!current || current.tokenVersion !== actor.sessionVersion) throw new ProductLifecycleError('Your session changed. Sign in again.', 401);
    const before = await tx.product.findUnique({ where: { id: productId }, select: selection });
    if (!before) throw new ProductLifecycleError('Listing not available.', 404);
    if (before.companyId) await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${before.companyId} FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: productId }, select: selection });
    if (!product || product.companyId !== before.companyId || product.userId !== before.userId) throw new ProductLifecycleError('Listing ownership changed. Refresh and try again.');
    const access = await productCapabilities(tx, current, product);
    if (operation !== 'read' && !access[operation]) throw new ProductLifecycleError('You no longer have permission for this listing change. Refresh the page.');
    return work(tx, product, access);
  }, { maxWait: 5_000, timeout: 15_000 });
}

export function productLifecycleFailure(error: unknown) {
  if (error instanceof ProductLifecycleError) return { error: error.message };
  console.error('[products] Listing change failed');
  return { error: 'The change could not be confirmed. Refresh the listing before trying again.' };
}
