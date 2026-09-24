/** @fileOverview Public filter metadata must not disclose hidden or unavailable listings. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
import { publicCatalogWhere } from './public-catalog';
const mocks = vi.hoisted(() => ({ group: vi.fn(), products: vi.fn(), aggregate: vi.fn(), users: vi.fn(), companies: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: {
  product: { groupBy: mocks.group, findMany: mocks.products, aggregate: mocks.aggregate },
  user: { findMany: mocks.users }, company: { findMany: mocks.companies },
} }));
vi.mock('@/lib/currency-rates', () => ({ getExchangeRates: async () => ({ USD: 1, NOK: 0.1, EUR: 1.1 }) }));
import { GET as categories } from '@/app/api/categories-with-counts/route';
import { GET as sellers } from '@/app/api/products/sellers/route';
import { GET as counts } from '@/app/api/filter-counts/route';
import { GET as prices } from '@/app/api/price-range/route';
import { fetchProductsWithDetails } from '@/actions/fetch-products-with-details';

beforeEach(() => {
  vi.clearAllMocks(); mocks.group.mockResolvedValue([]); mocks.products.mockResolvedValue([]);
  mocks.aggregate.mockResolvedValue({ _min: { price: 29 }, _max: { price: 39 } });
  mocks.users.mockResolvedValue([]); mocks.companies.mockResolvedValue([]);
});
it('includes only public, available physical/digital/hybrid products', () => {
  expect(publicCatalogWhere()).toEqual({ visibility: 'PUBLIC', OR: [
    { productType: 'DIGITAL', downloadsEnabled: true },
    { productType: 'HYBRID', downloadsEnabled: true, stock: { gt: 0 } },
    { productType: 'PHYSICAL', stock: { gt: 0 } },
  ] });
});
it('applies the same boundary to the list, initial categories and initial sellers', async () => {
  await fetchProductsWithDetails({ page: 1, perPage: 10, categories: [], minPrice: 0, searchTerm: '' });
  expect(mocks.products.mock.calls[0][0].where).toMatchObject(publicCatalogWhere());
  expect((await categories()).status).toBe(200); expect((await sellers()).status).toBe(200);
  for (const [call] of mocks.group.mock.calls) expect(call.where).toMatchObject(publicCatalogWhere());
});
it('keeps the boundary when category, seller, price and text filters are combined', async () => {
  const response = await counts(new Request('http://localhost:3000/api/filter-counts?selectedCategories=Digital&selectedSellers=seller&searchTerm=secret&minPrice=5&maxPrice=50'));
  expect(response.status).toBe(200);
  for (const [call] of mocks.group.mock.calls) {
    if (call.where.AND) expect(call.where.AND).toContainEqual(publicCatalogWhere());
    else expect(call.where).toMatchObject(publicCatalogWhere());
  }
  expect(mocks.group.mock.calls[0][0].where.AND).toContainEqual({ OR: [{ userId: { in: ['seller'] } }, { companyId: { in: ['seller'] } }] });
  expect(mocks.products.mock.calls[0][0].where).toEqual(publicCatalogWhere());
});
it('gets the public price bounds with a single database query', async () => {
  mocks.group.mockResolvedValue([{ priceCurrency: 'NOK', _min: { price: 29 }, _max: { price: 39 } }, { priceCurrency: 'EUR', _min: { price: 2 }, _max: { price: 8 } }]);
  const response = await prices(); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ min: 2.2, max: 8.8 });
  expect(mocks.group).toHaveBeenCalledExactlyOnceWith({ by: ['priceCurrency'], where: publicCatalogWhere(), _min: { price: true }, _max: { price: true } });
});
it('handles an empty public catalog without returning private price bounds', async () => {
  mocks.aggregate.mockResolvedValue({ _min: { price: null }, _max: { price: null } });
  expect(await (await prices()).json()).toEqual({ min: 0, max: 0 });
});
