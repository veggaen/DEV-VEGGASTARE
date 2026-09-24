/** @fileOverview Shared listing availability; checkout still validates price, stock and files on the server. @stability stable */
import { isShowcaseProduct } from './showcase-catalog';

export function productPurchaseState(product: {
  id: string; productType?: string; visibility?: string; downloadsEnabled?: boolean;
}): 'AVAILABLE' | 'BROWSE_ONLY' | 'UNAVAILABLE' {
  if ((product.visibility !== undefined && product.visibility !== 'PUBLIC') || product.downloadsEnabled === false) return 'UNAVAILABLE';
  if (!isShowcaseProduct(product.id)) return 'BROWSE_ONLY';
  return product.productType === 'DIGITAL' ? 'AVAILABLE' : 'UNAVAILABLE';
}

export const PRODUCT_PURCHASE_NOTICE = {
  BROWSE_ONLY: {
    title: 'Browse-only listing',
    description: 'Purchases are not open for this listing yet. You can explore its details, but it cannot be added to checkout. The Interview Pack and AI credits are available to try.',
  },
  UNAVAILABLE: {
    title: 'Purchases paused',
    description: 'This listing is not available to purchase right now. No payment can be started from this page. Please choose another product.',
  },
} as const;
