/** @fileOverview Whole-order seller authorization shared by list and mutation. @stability stable */
import 'server-only';
import { dbPrisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

export type ReturnItem = { Product: { userId: string | null; companyId: string | null } };

export async function managedReturnCompanies(userId: string, companyIds?: string[]) {
  if (companyIds?.length === 0) return [];
  const employees = await dbPrisma.employee.findMany({
    where: { userId, ...(companyIds ? { companyId: { in: companyIds } } : {}), role: { in: ['OWNER', 'MANAGER'] } },
    select: { companyId: true },
  });
  return employees.map(employee => employee.companyId);
}

export function reviewableOrderWhere(userId: string, role: string | undefined, companies: string[]): Prisma.OrderWhereInput {
  // Prisma's EVERY negates its predicate. SQL NULL would make NOT(owner OR
  // company) unknown instead of true, accidentally admitting a foreign line.
  // Product.userId is non-nullable; companyId needs an explicit IS NOT NULL
  // guard so both alternatives evaluate to true or false (never SQL unknown).
  return { OrderItem: { some: {}, ...(role === 'ADMIN' ? {} : { every: { Product: { OR: [
    { userId }, ...(companies.length ? [{ companyId: { not: null, in: companies } }] : []),
  ] } } }) } };
}

export async function canReviewWholeOrder(userId: string, role: string | undefined, items: ReturnItem[]) {
  if (!items.length) return false;
  if (role === 'ADMIN') return true;
  const companyIds = [...new Set(items.filter(item => item.Product.userId !== userId)
    .map(item => item.Product.companyId).filter((id): id is string => !!id))];
  const managed = new Set(await managedReturnCompanies(userId, companyIds));
  return items.every(({ Product: product }) => product.userId === userId ||
    (product.companyId !== null && managed.has(product.companyId)));
}
