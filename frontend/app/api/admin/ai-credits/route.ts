/**
 * @fileOverview Admin AI credit visibility endpoint.
 * @stability active
 *
 * GET /api/admin/ai-credits
 * Shows user-level AI entitlement + usage snapshot for monetization monitoring.
 */

import { NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isAdmin } from '@/lib/admin';
import { dbPrisma } from '@/lib/db';
import { getPaidAiEntitlement } from '@/lib/ai-paid-entitlement';
import { checkDailyQuota } from '@/lib/daily-ai-quota';

function parseProductIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCreditPackIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => pair.split(':')[0]?.trim())
    .filter((value): value is string => Boolean(value));
}

export async function GET() {
  const session = await MyLibUserAuth();

  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const dailyCapProductIds = parseProductIds(process.env.AI_PAID_PRODUCT_IDS);
    const creditPackProductIds = parseCreditPackIds(
      process.env.AI_PAID_CREDIT_PACK_PRODUCTS || process.env.AI_CREDIT_PACK_PRODUCTS
    );

    const configuredProductIds = Array.from(new Set([...dailyCapProductIds, ...creditPackProductIds]));

    if (!configuredProductIds.length) {
      return NextResponse.json({
        monetizationEnabled: false,
        configuredProductCount: 0,
        users: [],
      });
    }

    const [entitledOrders, products] = await Promise.all([
      dbPrisma.order.findMany({
        where: {
          status: 'COMPLETED',
          OrderItem: {
            some: {
              productId: {
                in: configuredProductIds,
              },
            },
          },
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
        take: 250,
      }),
      dbPrisma.product.findMany({
        where: {
          id: {
            in: configuredProductIds,
          },
        },
        select: {
          id: true,
          title: true,
        },
      }),
    ]);

    const userIds = entitledOrders.map((order) => order.userId);

    if (!userIds.length) {
      return NextResponse.json({
        monetizationEnabled: true,
        configuredProductCount: configuredProductIds.length,
        users: [],
      });
    }

    const users = await dbPrisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    const productLabelById = new Map(products.map((product) => [product.id, product.title]));

    const rows = await Promise.all(
      users.map(async (user) => {
        const entitlement = await getPaidAiEntitlement(user.id);
        const daily = entitlement.mode === 'daily_cap'
          ? await checkDailyQuota(user.id, entitlement.dailyLimit)
          : null;

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          hasAccess: entitlement.hasAccess,
          mode: entitlement.mode,
          dailyLimit: entitlement.dailyLimit,
          todayUsed: daily?.used ?? null,
          todayRemaining: daily?.remaining ?? null,
          totalCredits: entitlement.totalCredits,
          usedCredits: entitlement.usedCredits,
          remainingCredits: entitlement.remainingCredits,
          purchasedProductIds: entitlement.purchasedProductIds,
          purchasedProducts: entitlement.purchasedProductIds.map((productId) => productLabelById.get(productId) || productId),
        };
      })
    );

    rows.sort((a, b) => {
      if (a.hasAccess !== b.hasAccess) return a.hasAccess ? -1 : 1;
      if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
      return (a.name || a.email || '').localeCompare(b.name || b.email || '');
    });

    return NextResponse.json({
      monetizationEnabled: true,
      configuredProductCount: configuredProductIds.length,
      users: rows,
    });
  } catch (error) {
    console.error('[api/admin/ai-credits] Failed to fetch AI credit data:', error);
    return NextResponse.json({ error: 'Failed to fetch AI credit data' }, { status: 500 });
  }
}
