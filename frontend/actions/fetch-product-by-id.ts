/** @fileOverview Internal product read; visibility is enforced by the consuming route. @stability stable */
import 'server-only';
import { dbPrisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

// This must not be a Server Action: that would bypass API visibility checks.
// Never read private asset identifiers, wallet relations or entire model rows.
const detailSelect = {
  id: true, title: true, description: true, category: true, price: true,
  priceCurrency: true, acceptedFiatCurrencies: true, stock: true, productType: true,
  visibility: true, hiddenAt: true, archivedAt: true, downloadsEnabled: true,
  condition: true, image: true, specifications: true, features: true,
  userId: true, companyId: true, shipFromPostalId: true, updatedAt: true, createdAt: true,
  Company: { select: { ownerId: true, WarehouseLocation: {
    where: { isActive: true }, select: { id: true, country: true, postalCode: true },
  } } },
  Inventory: { select: { id: true, quantity: true, stock: true, warehouseId: true } },
  ProductAcceptedToken: { select: { symbol: true, family: true, decimals: true,
    tokenAddress: true, tokenMint: true, receiverWalletId: true, receiverAddress: true } },
} satisfies Prisma.ProductSelect;

export async function fetchProductById(id: string) {
  // An outage must reach the route's retryable error state, not become a 404.
  // Only a successful absent-row read returns null.
  return dbPrisma.product.findUnique({ where: { id }, select: detailSelect });
}
