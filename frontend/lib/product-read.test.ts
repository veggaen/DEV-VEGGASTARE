/** @fileOverview Product visibility, minimal reads and retryable failure boundaries. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ product: vi.fn(), employee: vi.fn(), auth: vi.fn(), user: vi.fn(), company: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/db', () => {
  const tx = { product: { findUnique: mocks.product }, employee: { findUnique: mocks.employee }, user: { findUnique: mocks.user }, company: { findUnique: mocks.company }, $queryRaw: mocks.query };
  return { dbPrisma: { ...tx, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } };
});
vi.mock('@/auth', () => ({ auth: mocks.auth }));
import { GET } from '@/app/api/products/[...id]/route';

const fixture = () => ({
  id: 'product-test', title: 'Sample', description: 'A real product', category: 'Digital',
  price: 29, priceCurrency: 'NOK', acceptedFiatCurrencies: ['NOK'], stock: 0,
  productType: 'DIGITAL', visibility: 'PUBLIC', hiddenAt: null, archivedAt: null,
  downloadsEnabled: true, condition: 'NEW', image: ['/art.jpg'], specifications: null,
  features: null, userId: 'seller', companyId: 'company', shipFromPostalId: '',
  createdAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date('2026-09-02T00:00:00Z'),
  Company: { ownerId: 'company-owner', WarehouseLocation: [] }, Inventory: [], ProductAcceptedToken: [],
  digitalAssetId: 'private-asset-identifier', reachLifetime: 999,
});
const read = (id = ['product-test']) => GET(new Request('http://localhost:3000/api/products/product-test'), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks(); mocks.product.mockResolvedValue(fixture()); mocks.auth.mockResolvedValue(null);
  mocks.employee.mockResolvedValue(null); vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.company.mockResolvedValue({ ownerId: 'company-owner' });
  mocks.user.mockImplementation(async () => { const session = await mocks.auth(); return session?.user ? { ...session.user, tokenVersion: 0 } : null; });
});
afterEach(() => vi.restoreAllMocks());

it('reads only DTO/authorization fields and never returns private asset or reach fields', async () => {
  const response = await read(); expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body = await response.json(); expect(body.id).toBe('product-test');
  expect(body).not.toHaveProperty('digitalAssetId'); expect(body).not.toHaveProperty('reachLifetime');
  const query = mocks.product.mock.calls[0][0];
  expect(query).not.toHaveProperty('include'); expect(query.select).not.toHaveProperty('digitalAssetId');
  expect(query.select).not.toHaveProperty('DigitalAsset'); expect(query.select).not.toHaveProperty('Wallet');
  expect(query.select.Company.select).not.toHaveProperty('logo');
  expect(mocks.auth).not.toHaveBeenCalled();
});
it.each([[], ['a', 'b'], [''], ['a'.repeat(201)]].map(id => ({ id })))('rejects invalid path segments $id without a query', async ({ id }) => {
  const response = await read(id); expect(response.status).toBe(400); expect(mocks.product).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it.each(['HIDDEN', 'ARCHIVED'])('hides %s products from anonymous users and does not cache them', async visibility => {
  mocks.product.mockResolvedValue({ ...fixture(), visibility }); const response = await read();
  expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: 'Product not found' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it.each([
  ['company-owner', 'USER'], ['admin', 'ADMIN'], ['owner', 'OWNER'],
])('permits the authorized private reader %s / %s', async (id, role) => {
  mocks.product.mockResolvedValue({ ...fixture(), visibility: 'HIDDEN' });
  mocks.auth.mockResolvedValue({ user: { id, role, sessionVersion: 0 } }); expect((await read()).status).toBe(200);
});
it('checks company permission and fails closed on unrelated or string-valued permissions', async () => {
  mocks.product.mockResolvedValue({ ...fixture(), visibility: 'HIDDEN' });
  mocks.auth.mockResolvedValue({ user: { id: 'employee', role: 'USER', sessionVersion: 0 } });
  mocks.employee.mockResolvedValue({ permissions: { CAN_MANAGE_PRODUCT_VISIBILITY: 'true' } });
  expect((await read()).status).toBe(404);
  mocks.employee.mockResolvedValue({ permissions: { CAN_MANAGE_PRODUCT_VISIBILITY: true } });
  expect((await read()).status).toBe(200);
  expect(mocks.employee).toHaveBeenCalledWith({ where: { userId_companyId: { userId: 'employee', companyId: 'company' } }, select: { permissions: true } });
});
it('distinguishes a missing row from a database failure without exposing error details', async () => {
  mocks.product.mockResolvedValueOnce(null); expect((await read()).status).toBe(404);
  mocks.product.mockRejectedValueOnce(new Error('sensitive database diagnostic'));
  const response = await read(); expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Product temporarily unavailable. Please try again.' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(console.error).toHaveBeenCalledExactlyOnceWith('[api/products/detail] Product read unavailable');
});
it('does not reuse a public or authorized result after visibility/session changes', async () => {
  expect((await read()).status).toBe(200);
  mocks.product.mockResolvedValue({ ...fixture(), visibility: 'HIDDEN' });
  mocks.auth.mockResolvedValue({ user: { id: 'company-owner', role: 'USER', sessionVersion: 0 } }); expect((await read()).status).toBe(200);
  mocks.auth.mockResolvedValue(null); expect((await read()).status).toBe(404);
  expect(mocks.product).toHaveBeenCalledTimes(5);
});
it('former authors cannot read hidden company products; personal ownership still works', async () => {
  mocks.product.mockResolvedValue({ ...fixture(), visibility: 'HIDDEN' });
  mocks.auth.mockResolvedValue({ user: { id: 'seller', role: 'USER', sessionVersion: 0 } });
  expect((await read()).status).toBe(404);
  mocks.product.mockResolvedValue({ ...fixture(), companyId: null, visibility: 'HIDDEN' });
  expect((await read()).status).toBe(200);
});
it('normalizes legacy JSON without turning a malformed specification into not-found', async () => {
  mocks.product.mockResolvedValue({ ...fixture(), specifications: '{not json', features: '[{"text":"Included"}]' });
  const response = await read(); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ specifications: null, features: [{ text: 'Included' }] });
});
it('never returns private delivery specifications in a public product response', async () => {
  mocks.product.mockResolvedValue({ ...fixture(), specifications: JSON.stringify([{ key: '__repo_access', value: 'private configuration' }, { key: 'Format', value: 'PNG' }]) });
  expect((await (await read()).json()).specifications).toEqual([{ key: 'Format', value: 'PNG' }]);
});
