/** @fileOverview Both cart APIs share strict credit inputs and server display pricing. @stability stable */
import { describe, it, expect } from 'vitest';
import { creditCartData, cartItemDto, cartCreditAmountSchema } from './cart-credit-policy';
import { SHOWCASE_PRODUCTS } from './showcase-catalog';
import { CartItemDtoSchema } from './types/carts';
const creditId = SHOWCASE_PRODUCTS.credits.id;
describe('custom credit cart', () => {
  it.each([10, 122, 555, 1000, 2815, 10000])('stores %i credits as one line', amount => {
    expect(creditCartData(creditId, 1, amount)).toEqual({ quantity: 1, creditAmount: amount, creditSpendMinor: null, creditSpendCurrency: null });
  });
  it.each(['555', null, -1, 0, 99, 10001, 122.5, NaN, Infinity])('does not coerce or clamp %j', value => {
    expect(cartCreditAmountSchema.safeParse(value).success).toBe(false);
  });
  it('keeps old carts at 100 credits and refuses pack increments', () => {
    expect(creditCartData(creditId, 1)).toEqual({ quantity: 1, creditAmount: 100, creditSpendMinor: null, creditSpendCurrency: null });
    expect(() => creditCartData(creditId, 2)).toThrow('number of credits');
  });
  it('rejects credit metadata for other products', () => expect(() => creditCartData(SHOWCASE_PRODUCTS.interviewPack.id, 1, 555)).toThrow('only to AI credits'));
  it('uses the exact quoted price rather than the base product price', () => {
    const item = { id: 'row', quantity: 1, creditAmount: 555, Product: { id: creditId, price: 0.01, title: 'AI credits', priceCurrency: 'USD', image: [] } };
    expect(cartItemDto(item)).toMatchObject({ creditAmount: 555, creditDiscountOre: 994, product: { price: 206.51, priceCurrency: 'NOK' } });
    expect(cartItemDto({ ...item, creditAmount: null })).toMatchObject({ creditAmount: 100, product: { price: 39 } });
    expect(cartItemDto({ ...item, creditAmount: 10 })).toMatchObject({ creditAmount: 10, product: { price: 9, priceCurrency: 'NOK' } });
  });
  it('preserves an exact USD 100 spend and server revision instead of re-pricing whole credits in NOK', () => {
    const item = { id:'row', quantity:1, creditAmount:2500, creditSpendMinor:10000, creditSpendCurrency:'USD',
      updatedAt:new Date('2026-09-25T12:00:00Z'), Product:{id:creditId,title:'AI credits',price:39,priceCurrency:'NOK',image:[]} };
    const dto = cartItemDto(item);
    expect(dto).toMatchObject({ creditSpendMinor:10000,creditSpendCurrency:'USD',creditAmount:2500,
      updatedAt:'2026-09-25T12:00:00.000Z',product:{price:100,priceCurrency:'USD'} });
    expect(dto).not.toHaveProperty('creditDiscountOre'); expect(CartItemDtoSchema.parse(dto)).toEqual(dto);
    for (const patch of [{creditSpendCurrency:null},{creditSpendMinor:null},{creditSpendMinor:0},{creditAmount:10},{quantity:2}]) {
      expect(() => cartItemDto({...item,...patch})).toThrow();
    }
    expect(CartItemDtoSchema.safeParse({...dto,creditSpendCurrency:null}).success).toBe(false);
    expect(CartItemDtoSchema.safeParse({...dto,creditSpendMinor:null}).success).toBe(false);
  });
});
