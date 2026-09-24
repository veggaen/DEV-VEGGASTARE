/** @fileOverview Bounded seller-order transport and filters, safe for the client. @stability stable */
import { z } from 'zod';

export const SALE_FILTERS = ['ALL', 'UNFULFILLED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'] as const;
export const SALE_LABELS: Record<typeof SALE_FILTERS[number], string> = {
  ALL: 'All orders', UNFULFILLED: 'Awaiting fulfilment', PROCESSING: 'Processing',
  SHIPPED: 'Shipped', DELIVERED: 'Delivered', RETURNED: 'Returned', CANCELLED: 'Cancelled',
};
export const SellerOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  fulfilmentStatus: z.enum(SALE_FILTERS).default('ALL'),
}).strict();
export const emptySaleCounts = () => Object.fromEntries(SALE_FILTERS.map(key => [key, 0])) as Record<typeof SALE_FILTERS[number], number>;
const text = z.string().max(10_000);
const nullableText = text.nullable();
const count = z.number().int().nonnegative();
export const SellerOrderList = z.object({
  readOnly: z.boolean(), counts: z.object({ ALL: count, UNFULFILLED: count, PROCESSING: count, SHIPPED: count, DELIVERED: count, RETURNED: count, CANCELLED: count }),
  pagination: z.object({ page: z.number().int().positive(), limit: z.number().int().min(1).max(100), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }),
  orders: z.array(z.object({
    id: z.string().min(1).max(200), createdAt: z.string().datetime(), currency: nullableText,
    status: text, environment: nullableText, fulfilmentStatus: z.enum(SALE_FILTERS).exclude(['ALL']),
    sellerTotal: z.number().finite().nonnegative(), itemCount: z.number().int().nonnegative(),
    sharedOrder: z.boolean(), customer: z.object({ name: nullableText, email: nullableText }),
    shipping: z.object({ name: nullableText, address: nullableText, city: nullableText, postalCode: nullableText, country: nullableText }).nullable(),
    tracking: z.object({ number: nullableText, url: nullableText, labelUrl: nullableText }).nullable(),
    items: z.array(z.object({ id: text, productId: text, title: text, quantity: z.number().int().nonnegative(), priceAtTime: z.number().finite().nonnegative(), productType: text })).max(50),
    payment: z.object({ method: text, status: text, environment: nullableText, state: nullableText,
      receiver: nullableText, sender: nullableText, reference: nullableText, chainFamily: nullableText,
      chainId: z.number().nullable(), tokenSymbol: nullableText, nativeAmount: nullableText }).nullable(),
  })).max(100),
});
export type SellerOrderResponse = z.infer<typeof SellerOrderList>;
export type SellerOrderRow = SellerOrderResponse['orders'][number];

/** Never turn untrusted tracking metadata into a script/data link. */
export function safeShippingLink(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
