import "server-only";

import { dbPrisma } from "@/lib/db";

type PaidAiEntitlement = {
  hasAccess: boolean;
  dailyLimit: number;
  purchasedProductIds: string[];
  mode: "none" | "daily_cap" | "credit_pack";
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
};

const DEFAULT_PAID_DAILY_LIMIT = parseInt(process.env.AI_PAID_DEFAULT_DAILY_LIMIT || "50", 10);

function parseProductIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePerProductDailyLimits(raw: string | undefined): Map<string, number> {
  const result = new Map<string, number>();
  if (!raw) return result;

  for (const pair of raw.split(",")) {
    const [productIdRaw, limitRaw] = pair.split(":");
    const productId = productIdRaw?.trim();
    const limit = parseInt(limitRaw?.trim() || "", 10);
    if (!productId || !Number.isFinite(limit) || limit <= 0) continue;
    result.set(productId, limit);
  }

  return result;
}

function parseCreditPackMap(raw: string | undefined): Map<string, number> {
  const result = new Map<string, number>();
  if (!raw) return result;

  for (const pair of raw.split(",")) {
    const [productIdRaw, creditsRaw] = pair.split(":");
    const productId = productIdRaw?.trim();
    const credits = parseInt(creditsRaw?.trim() || "", 10);
    if (!productId || !Number.isFinite(credits) || credits <= 0) continue;
    result.set(productId, credits);
  }

  return result;
}

function asUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getPaidAiEntitlement(userId: string): Promise<PaidAiEntitlement> {
  const creditPackMap = parseCreditPackMap(
    process.env.AI_PAID_CREDIT_PACK_PRODUCTS || process.env.AI_CREDIT_PACK_PRODUCTS
  );

  if (creditPackMap.size > 0) {
    const creditPackProductIds = Array.from(creditPackMap.keys());

    const orders = await dbPrisma.order.findMany({
      where: {
        userId,
        status: "COMPLETED",
        OrderItem: {
          some: {
            productId: {
              in: creditPackProductIds,
            },
          },
        },
      },
      select: {
        createdAt: true,
        OrderItem: {
          where: {
            productId: {
              in: creditPackProductIds,
            },
          },
          select: {
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (orders.length > 0) {
      const purchasedIds = new Set<string>();
      let totalCredits = 0;
      let firstPurchaseAt: Date | null = null;

      for (const order of orders) {
        if (!firstPurchaseAt || order.createdAt < firstPurchaseAt) firstPurchaseAt = order.createdAt;
        for (const item of order.OrderItem) {
          purchasedIds.add(item.productId);
          const creditsPerUnit = creditPackMap.get(item.productId) || 0;
          totalCredits += creditsPerUnit * Math.max(1, item.quantity);
        }
      }

      if (totalCredits > 0 && firstPurchaseAt) {
        const usage = await dbPrisma.dailyAiUsage.aggregate({
          where: {
            userId,
            date: {
              gte: asUtcDateOnly(firstPurchaseAt),
            },
          },
          _sum: {
            count: true,
          },
        });

        const usedCredits = usage._sum.count ?? 0;
        const remainingCredits = Math.max(0, totalCredits - usedCredits);

        return {
          hasAccess: remainingCredits > 0,
          dailyLimit: DEFAULT_PAID_DAILY_LIMIT,
          purchasedProductIds: Array.from(purchasedIds),
          mode: "credit_pack",
          totalCredits,
          usedCredits,
          remainingCredits,
        };
      }
    }
  }

  const paidProductIds = parseProductIds(process.env.AI_PAID_PRODUCT_IDS);
  if (!paidProductIds.length) {
    return {
      hasAccess: false,
      dailyLimit: DEFAULT_PAID_DAILY_LIMIT,
      purchasedProductIds: [],
      mode: "none",
      totalCredits: 0,
      usedCredits: 0,
      remainingCredits: 0,
    };
  }

  const perProductLimits = parsePerProductDailyLimits(process.env.AI_PAID_PRODUCT_DAILY_LIMITS);

  const orders = await dbPrisma.order.findMany({
    where: {
      userId,
      status: "COMPLETED",
      OrderItem: {
        some: {
          productId: {
            in: paidProductIds,
          },
        },
      },
    },
    select: {
      OrderItem: {
        where: {
          productId: {
            in: paidProductIds,
          },
        },
        select: {
          productId: true,
        },
      },
    },
  });

  const purchasedIds = new Set<string>();
  for (const order of orders) {
    for (const item of order.OrderItem) purchasedIds.add(item.productId);
  }

  if (!purchasedIds.size) {
    return {
      hasAccess: false,
      dailyLimit: DEFAULT_PAID_DAILY_LIMIT,
      purchasedProductIds: [],
      mode: "none",
      totalCredits: 0,
      usedCredits: 0,
      remainingCredits: 0,
    };
  }

  let dailyLimit = DEFAULT_PAID_DAILY_LIMIT;
  for (const productId of purchasedIds) {
    const productLimit = perProductLimits.get(productId);
    if (productLimit && productLimit > dailyLimit) dailyLimit = productLimit;
  }

  return {
    hasAccess: true,
    dailyLimit,
    purchasedProductIds: Array.from(purchasedIds),
    mode: "daily_cap",
    totalCredits: 0,
    usedCredits: 0,
    remainingCredits: 0,
  };
}
