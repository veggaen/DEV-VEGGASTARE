/** @fileOverview Publication preflight and transaction-boundary regression tests. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  transaction: vi.fn(), company: vi.fn(), employee: vi.fn(), asset: vi.fn(), wallets: vi.fn(),
  categories: vi.fn(), warehouses: vi.fn(), product: vi.fn(), category: vi.fn(), links: vi.fn(), tokens: vi.fn(), inventory: vi.fn(), warehouse: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: m.transaction } }));
import { publishProduct } from './product-publishing';
const tx = {
  company: { findUnique: m.company }, employee: { findUnique: m.employee }, digitalAsset: { findFirst: m.asset },
  wallet: { findMany: m.wallets }, category: { count: m.categories, upsert: m.category }, warehouseLocation: { findMany: m.warehouses, create: m.warehouse },
  product: { create: m.product }, productCategory: { createMany: m.links }, productAcceptedToken: { createMany: m.tokens }, inventory: { create: m.inventory },
};
const input = () => ({ title: 'QA file', description: 'Original file', category: 'Digital', categories: [], price: 29, priceCurrency: 'NOK',
  userId: 'forged-user', quantity: 1, image: ['https://files.edgestore.dev/qa/myPublicImages/photo.jpg'], productType: 'DIGITAL', digitalAssetId: 'owned-asset' });
beforeEach(() => {
  vi.resetAllMocks(); m.transaction.mockImplementation(fn => fn(tx));
  m.product.mockResolvedValue({ id: 'new-product' }); m.asset.mockResolvedValue({ id: 'owned-asset' });
  m.company.mockResolvedValue({ ownerId: 'seller' }); m.employee.mockResolvedValue(null);
  m.wallets.mockResolvedValue([]); m.warehouses.mockResolvedValue([]); m.categories.mockResolvedValue(0);
  m.warehouse.mockResolvedValue({ id: 'seller-warehouse' }); m.category.mockResolvedValue({ id: 'category' });
});
it('creates all relations inside the transaction with session owner, never supplied owner', async () => {
  await expect(publishProduct('seller', { ...input(), categories: [{ name: 'New category' }], acceptedTokens: [{ family: 'EVM', symbol: 'eth', decimals: 18 }] }, [])).resolves.toEqual({ id: 'new-product' });
  expect(m.product.mock.calls[0][0].data).toMatchObject({ userId: 'seller', companyId: null, stock: 1_000_000, shipFromPostalId: '' });
  expect(m.asset.mock.calls[0][0].where).toMatchObject({ id: 'owned-asset', uploadedById: 'seller', companyId: null, isActive: true, Product: null });
  expect(m.links).toHaveBeenCalledWith({ data: [{ productId: 'new-product', categoryId: 'category' }] });
  expect(m.tokens.mock.calls[0][0].data[0].symbol).toBe('ETH');
  expect(m.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable', timeout: 15000 });
});
it.each(['', 'demo_visitor'])('rejects non-publishing identity %s before a transaction', async id => {
  await expect(publishProduct(id, input(), [])).rejects.toThrow('cannot publish'); expect(m.transaction).not.toHaveBeenCalled();
});
it.each([{ title: '  ' }, { price: -1 }, { quantity: 1.5 }, { image: [] }, { image: ['javascript:bad()'] }, { image: ['http://insecure.test/a.jpg'] }])('rejects invalid fields before any write: %j', async patch => {
  await expect(publishProduct('seller', { ...input(), ...patch }, [])).rejects.toThrow('required listing'); expect(m.product).not.toHaveBeenCalled();
});
it('rejects missing, inactive, already-linked or wrong-seller digital assets before any write', async () => {
  m.asset.mockResolvedValue(null);
  await expect(publishProduct('seller', input(), [])).rejects.toThrow('active, unused'); expect(m.product).not.toHaveBeenCalled();
});
it('rejects a foreign wallet before the product exists', async () => {
  await expect(publishProduct('seller', { ...input(), receiverWalletId: 'foreign' }, [])).rejects.toThrow('verified receiving');
  expect(m.product).not.toHaveBeenCalled(); expect(m.wallets.mock.calls[0][0].where.OR).toEqual([{ ownerUserId: 'seller', ownerCompanyId: null }]);
});
it('does not treat company membership or string permissions as publish permission', async () => {
  m.company.mockResolvedValue({ ownerId: 'someone-else' }); m.employee.mockResolvedValue({ role: 'STAFF', permissions: { CAN_POST_PRODUCT_POSITION_PERMISSION: 'true' } });
  await expect(publishProduct('seller', { ...input(), companyId: 'company' }, [])).rejects.toThrow('permission'); expect(m.product).not.toHaveBeenCalled();
});
it.each([{ role: 'MANAGER', permissions: {} }, { role: 'STAFF', permissions: { CAN_CREATE_DIGITAL_PRODUCT: true } }])('accepts explicit authorized company publication %j', async employee => {
  m.company.mockResolvedValue({ ownerId: 'someone-else' }); m.employee.mockResolvedValue(employee);
  await publishProduct('seller', { ...input(), companyId: 'company' }, []);
  expect(m.asset.mock.calls[0][0].where).toEqual({ id: 'owned-asset', companyId: 'company', isActive: true, Product: null });
});
it('scopes physical warehouses to the seller and writes inventory atomically', async () => {
  await publishProduct('seller', { ...input(), productType: 'PHYSICAL', digitalAssetId: undefined, quantity: 3 }, ['1234']);
  expect(m.warehouses.mock.calls[0][0].where).toEqual({ postalCode: { in: ['1234'] }, isActive: true, userId: 'seller', companyId: null });
  expect(m.inventory).toHaveBeenCalledWith({ data: { productId: 'new-product', warehouseId: 'seller-warehouse', quantity: 3, stock: 3 } });
});
it('never silently creates a company warehouse from a foreign postcode', async () => {
  await expect(publishProduct('seller', { ...input(), companyId: 'company', productType: 'PHYSICAL' }, ['1234'])).rejects.toThrow('active warehouse');
  expect(m.product).not.toHaveBeenCalled(); expect(m.warehouse).not.toHaveBeenCalled();
});
it('propagates a relation failure out of the transaction, never returns partial success', async () => {
  m.links.mockRejectedValue(new Error('relation failure'));
  await expect(publishProduct('seller', { ...input(), categories: [{ name: 'QA' }] }, [])).rejects.toThrow('relation failure');
});
