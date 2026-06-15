import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import {
  RepoAccessConfigSchema,
  getProductRepoAccessConfig,
  setProductRepoAccessConfig,
} from '@/lib/github-repo-access';

type RouteContext = {
  params: Promise<{ productId: string }>;
};

const updateSchema = z
  .object({
    enabled: z.boolean().default(true),
    config: RepoAccessConfigSchema.optional(),
  })
  .strict();

async function canManageProduct(productId: string, userId: string): Promise<boolean> {
  const product = await dbPrisma.product.findUnique({
    where: { id: productId },
    select: { userId: true, companyId: true },
  });

  if (!product) return false;
  if (product.userId === userId) return true;
  if (!product.companyId) return false;

  const [company, employee] = await Promise.all([
    dbPrisma.company.findUnique({ where: { id: product.companyId }, select: { ownerId: true } }),
    dbPrisma.employee.findFirst({
      where: {
        companyId: product.companyId,
        userId,
        role: { in: ['OWNER', 'MANAGER'] },
      },
      select: { id: true },
    }),
  ]);

  return company?.ownerId === userId || !!employee;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { productId } = await ctx.params;
  const allowed = await canManageProduct(productId, session.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const product = await dbPrisma.product.findUnique({
    where: { id: productId },
    select: { id: true, specifications: true },
  });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({
    productId,
    config: getProductRepoAccessConfig(product.specifications),
  });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { productId } = await ctx.params;
  const allowed = await canManageProduct(productId, session.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = updateSchema.safeParse(await req.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (payload.data.enabled && !payload.data.config) {
    return NextResponse.json({ error: 'Config is required when enabled=true' }, { status: 400 });
  }

  const product = await dbPrisma.product.findUnique({
    where: { id: productId },
    select: { id: true, specifications: true },
  });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const nextSpecifications = setProductRepoAccessConfig(
    product.specifications,
    payload.data.enabled ? payload.data.config ?? null : null,
  );

  await dbPrisma.product.update({
    where: { id: productId },
    data: { specifications: nextSpecifications },
  });

  return NextResponse.json({
    ok: true,
    productId,
    config: payload.data.enabled ? payload.data.config ?? null : null,
  });
}
