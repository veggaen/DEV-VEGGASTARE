/** @fileOverview Mixed-currency price filtering, public boundaries and invalid-query regression tests. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { catalogPriceWhere, catalogRangeUsd, parseCatalogPriceFilter } from './catalog-price-filter';
const mocks = vi.hoisted(() => ({ products: vi.fn(), group: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { product: { findMany: mocks.products, groupBy: mocks.group } } }));
vi.mock('@/lib/currency-rates', () => ({ getExchangeRates: async () => ({ USD: 1, NOK: 0.1, EUR: 1.1 }) }));
import { GET as products } from '@/app/api/products/route';
import { GET as counts } from '@/app/api/filter-counts/route';
import { publicCatalogWhere } from './public-catalog';

beforeEach(() => { vi.clearAllMocks(); mocks.products.mockResolvedValue([]); mocks.group.mockResolvedValue([]); });
it.each(['minPrice=-1', 'maxPrice=NaN', 'maxPrice=Infinity', 'minPrice=10&maxPrice=3', 'priceCurrency=FAKE', 'minPrice=1e30', 'minPrice=12junk'])('rejects invalid bounds: %s', async query => {
  expect(parseCatalogPriceFilter(new URLSearchParams(query)).success).toBe(false);
  expect((await products(new Request(`https://example.test/api/products?${query}`))).status).toBe(400);
  expect((await counts(new Request(`https://example.test/api/filter-counts?${query}`))).status).toBe(400);
  expect(mocks.products).not.toHaveBeenCalled(); expect(mocks.group).not.toHaveBeenCalled();
});
it('converts 2–4 USD into each listing currency before pagination', () => {
  expect(catalogPriceWhere(2, 4, 'USD', { USD: 1, NOK: 0.1, EUR: 1.25 })).toEqual({ OR: [
    { priceCurrency: 'USD', price: { gte: 2, lte: 4 } },
    { priceCurrency: 'NOK', price: { gte: 20, lte: 40 } },
    { priceCurrency: 'EUR', price: { gte: 1.6, lte: 3.2 } },
  ] });
});
it('handles NOK bounds, zero maximum and unavailable rates without inventing prices', () => {
  expect(catalogPriceWhere(20, 40, 'NOK', { NOK: 0.1 })).toEqual(catalogPriceWhere(2, 4, 'USD', { NOK: 0.1 }));
  expect(catalogPriceWhere(0, 0, 'USD', { NOK: 0, EUR: NaN }).OR).toEqual([{ priceCurrency: 'USD', price: { gte: 0, lte: 0 } }]);
  expect(() => catalogPriceWhere(0, 5, 'EUR', {})).toThrow('rate unavailable');
});
it('does not overwrite the public catalog visibility OR when applying a currency range', async () => {
  expect((await products(new Request('https://example.test/api/products?minPrice=2&maxPrice=4&page=2&perPage=10'))).status).toBe(200);
  const call = mocks.products.mock.calls[0][0];
  expect(call.where).toMatchObject(publicCatalogWhere());
  expect(call.where.AND).toContainEqual(catalogPriceWhere(2, 4, 'USD', { USD: 1, NOK: 0.1, EUR: 1.1 }));
  expect(call.skip).toBe(10); expect(call.take).toBe(10);
});
it('does not turn a failed catalog read into a successful empty result', async () => {
  mocks.products.mockRejectedValue(new Error('Database unavailable'));
  expect((await products(new Request('https://example.test/api/products'))).status).toBe(500);
});
it('ignores unknown or missing source rates when computing the public range', () => {
  expect(catalogRangeUsd([{ priceCurrency: 'XYZ', _min: { price: 1 }, _max: { price: 99999 } }], {})).toEqual({ min: 0, max: 0 });
});
