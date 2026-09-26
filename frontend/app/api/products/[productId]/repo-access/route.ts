/** @fileOverview Company-scoped repository delivery configuration; never grants GitHub access here. @stability active */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RepoAccessConfigSchema, getProductRepoAccessConfig, setProductRepoAccessConfig } from '@/lib/github-repo-access';
import { productRequestActor, withProductAccess, productLifecycleFailure, ProductLifecycleError } from '@/lib/product-lifecycle';
import type { Prisma } from '@/generated/prisma/client';

type RouteContext = { params: Promise<{ productId: string }> };
const updateSchema = z.object({ enabled: z.boolean(), config: RepoAccessConfigSchema.optional() }).strict();
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
const failure = (error: unknown) => reply(productLifecycleFailure(error), error instanceof ProductLifecycleError ? error.status : 503);

// Delivery integration settings are not ordinary catalogue editing permissions.
async function requireSellerOwner(tx: Prisma.TransactionClient, userId: string, companyId: string | null) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!companyId || user?.role === 'OWNER' || user?.role === 'ADMIN') return;
  const company = await tx.company.findUnique({ where: { id: companyId }, select: { ownerId: true } });
  if (company?.ownerId !== userId) throw new ProductLifecycleError('Only the seller owner can manage delivery integrations.');
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const actor = await productRequestActor(false); const { productId } = await ctx.params;
    return reply(await withProductAccess(actor, productId, 'edit', async (tx, managed) => {
      await requireSellerOwner(tx, actor.id, managed.companyId);
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { specifications: true } });
      return { productId, config: getProductRepoAccessConfig(product.specifications) };
    }));
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const actor = await productRequestActor(); const { productId } = await ctx.params;
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply({ error: 'Send JSON changes.' }, 415);
    const text = await req.text();
    if (text.length > 16_384) return reply({ error: 'Configuration is too large.' }, 413);
    let body: unknown; try { body = JSON.parse(text); } catch { return reply({ error: 'Invalid changes.' }, 400); }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success || (parsed.data.enabled && !parsed.data.config)) return reply({ error: 'Review the repository configuration.' }, 400);
    const config = parsed.data.enabled ? parsed.data.config! : null;
    return reply(await withProductAccess(actor, productId, 'edit', async (tx, managed) => {
      await requireSellerOwner(tx, actor.id, managed.companyId);
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { specifications: true } });
      await tx.product.update({ where: { id: productId }, data: { specifications: setProductRepoAccessConfig(product.specifications, config) } });
      return { ok: true, productId, config };
    }));
  } catch (error) { return failure(error); }
}
