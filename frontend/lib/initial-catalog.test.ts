/** @fileOverview Server catalog uses the existing public reader and fails safely. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const read = vi.hoisted(() => vi.fn());
vi.mock('@/actions/fetch-products-with-details', () => ({ fetchProductsWithDetails: read }));
import { getInitialCatalog } from './initial-catalog';
import { DEFAULT_CATALOG_PAGE_SIZE } from './catalog-snapshot';

beforeEach(() => { read.mockReset(); });
it('makes one bounded direct read with the same unfiltered defaults as the browser', async () => {
  read.mockResolvedValue([]);
  expect(await getInitialCatalog()).toEqual({ query: '', perPage: DEFAULT_CATALOG_PAGE_SIZE, products: [] });
  expect(read).toHaveBeenCalledExactlyOnceWith({ page: 1, perPage: 30, categories: [], minPrice: 0, searchTerm: '' });
});
it('does not cache an empty catalog or leak errors when the database fails', async () => {
  read.mockRejectedValueOnce(new Error('private database details')).mockResolvedValueOnce([]);
  expect(await getInitialCatalog()).toBeNull();
  expect((await getInitialCatalog())?.products).toEqual([]);
  expect(read).toHaveBeenCalledTimes(2);
});
it('rejects invalid or unexpected/private DTO fields rather than serializing them', async () => {
  read.mockResolvedValue([{ id: 'one', title: 'Public', description: '', category: 'Digital', price: 29,
    stock: 0, shipFromPostalId: '', image: [], userId: 'seller', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    email: 'private@example.test' }]);
  expect(await getInitialCatalog()).toBeNull();
});
