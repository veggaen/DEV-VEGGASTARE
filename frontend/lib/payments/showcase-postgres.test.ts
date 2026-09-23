/** @fileOverview Opt-in real PostgreSQL acceptance for custom checkout bounds; all synthetic data rolls back. @stability stable */
import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('server-only', () => ({}));

it.skipIf(process.env.RUN_SHOWCASE_POSTGRES_TESTS !== '1')('prepares 122, 555 and the maximum mixed cart against real isolated constraints', async () => {
  if (process.env.VERCEL_ENV !== 'preview' || !process.env.DATABASE_URL_MAINPREVIEW) {
    throw new Error('An explicitly isolated Preview database is required');
  }
  const { dbPrisma } = await import('@/lib/db');
  const { prepareShowcaseCheckout } = await import('./showcase-store');
  const { SHOWCASE_PRODUCTS } = await import('@/lib/showcase-catalog');
  const transact = dbPrisma.$transaction.bind(dbPrisma);
  const rollback = new Error('ROLLBACK_SYNTHETIC_CHECKOUT');
  try {
    for (const [credits, includeFile, totalOre] of [[122, false, 4716], [555, false, 20651], [1000, true, 39170]] as const) {
      await expect(transact(async tx => {
        const userId = `demo_integration_${randomUUID()}`;
        await tx.user.create({ data: { id: userId, name: 'Disposable checkout integration test', role: 'USER' } });
        await tx.cart.create({ data: { userId, CartItem: { create: [
          { productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, creditAmount: credits },
          ...(includeFile ? [{ productId: SHOWCASE_PRODUCTS.interviewPack.id, quantity: 1 }] : []),
        ] } } });
        // Reuse this real transaction so the production prepare function and
        // every database constraint run, but fixture/order writes never commit.
        const spy = vi.spyOn(dbPrisma, '$transaction').mockImplementation(
          ((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) as typeof dbPrisma.$transaction);
        try {
          const result = await prepareShowcaseCheckout(userId, randomUUID());
          expect(result).toMatchObject({ totalOre, environment: 'DEMO', state: 'PREPARED' });
          expect(result.quote).toMatchObject({ lines: expect.arrayContaining([expect.objectContaining({ credits })]) });
          expect(await tx.checkoutAttempt.count({ where: { userId } })).toBe(1);
        } finally { spy.mockRestore(); }
        throw rollback;
      }, { timeout: 15_000 })).rejects.toBe(rollback);
    }
  } finally { await dbPrisma.$disconnect(); }
}, 60_000);
