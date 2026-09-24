/** @fileOverview Product purchase controls agree with the released server checkout scope. @stability stable */
import { expect, it } from 'vitest';
import { productPurchaseState } from './product-purchase-state';
import { SHOWCASE_PRODUCTS } from './showcase-catalog';

const ready = { id: SHOWCASE_PRODUCTS.interviewPack.id, productType: 'DIGITAL', visibility: 'PUBLIC', downloadsEnabled: true };
it.each(Object.values(SHOWCASE_PRODUCTS))('permits the released digital SKU $id', sku => {
  expect(productPurchaseState({ ...ready, id: sku.id })).toBe('AVAILABLE');
});
it.each(['PHYSICAL', 'DIGITAL', 'HYBRID'])('labels unreleased $0 listings browse-only, not purchasable', productType => {
  expect(productPurchaseState({ ...ready, id: 'independent-seller-product', productType })).toBe('BROWSE_ONLY');
});
it.each(['HIDDEN', 'ARCHIVED', 'unknown'])('does not offer %s listings for purchase', visibility => {
  expect(productPurchaseState({ ...ready, visibility })).toBe('UNAVAILABLE');
});
it('does not offer a released SKU with paused delivery, even if it was already in a basket', () => {
  expect(productPurchaseState({ ...ready, downloadsEnabled: false })).toBe('UNAVAILABLE');
});
it.each(['PHYSICAL', 'HYBRID', undefined])('does not assume a released id makes a %s product fulfillable', productType => {
  expect(productPurchaseState({ ...ready, productType })).toBe('UNAVAILABLE');
});
