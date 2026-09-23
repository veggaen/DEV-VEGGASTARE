/** @fileOverview Shared cart credit validation and authoritative display quotes for both cart endpoints. @stability experimental */
import { z } from 'zod';
import { SHOWCASE_PRODUCTS } from './showcase-catalog';
import { DEFAULT_PURCHASE_CREDITS, MIN_PURCHASE_CREDITS, MAX_PURCHASE_CREDITS, quoteCreditPurchase } from './ai-credit-purchase';

export const cartCreditAmountSchema = z.number().int().min(MIN_PURCHASE_CREDITS).max(MAX_PURCHASE_CREDITS).optional();
export class CartCreditError extends Error {}
export function creditCartData(productId: string, quantity: number, creditAmount?: number) {
  if (productId !== SHOWCASE_PRODUCTS.credits.id) {
    if (creditAmount !== undefined) throw new CartCreditError('Credit amounts apply only to AI credits.');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new CartCreditError('Quantity must be between 1 and 1,000.');
    return { quantity };
  }
  if (quantity !== 1) throw new CartCreditError('Enter the number of credits instead of changing pack quantity.');
  const credits = creditAmount ?? DEFAULT_PURCHASE_CREDITS;
  if (!cartCreditAmountSchema.safeParse(credits).success) throw new CartCreditError('Enter a whole number from 100 to 1,000 credits.');
  return { quantity: 1, creditAmount: credits };
}

type StoredCartItem = { id: string; quantity: number; creditAmount?: number | null; Product: {
  id: string; title: string; price: number; priceCurrency?: string; image: string[]; productType?: string;
  shipFromPostalId?: string | null; freeShippingEnabled?: boolean; freeShippingThreshold?: number | null;
} };
export function cartItemDto(item: StoredCartItem) {
  const isCredit = item.Product.id === SHOWCASE_PRODUCTS.credits.id;
  const quote = isCredit ? quoteCreditPurchase(item.creditAmount ?? DEFAULT_PURCHASE_CREDITS) : null;
  return { id: item.id, quantity: item.quantity,
    ...(quote ? { creditAmount: quote.credits, creditDiscountOre: quote.discountOre } : {}),
    product: { id: item.Product.id, title: item.Product.title,
      price: quote ? quote.amountOre / 100 : item.Product.price,
      priceCurrency: quote ? 'NOK' : item.Product.priceCurrency ?? 'USD', image: item.Product.image ?? [],
      productType: item.Product.productType, shipFromPostalId: item.Product.shipFromPostalId ?? undefined,
      freeShippingEnabled: item.Product.freeShippingEnabled, freeShippingThreshold: item.Product.freeShippingThreshold ?? null,
    } };
}
