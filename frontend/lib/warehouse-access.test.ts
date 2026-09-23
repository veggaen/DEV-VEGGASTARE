/** @fileOverview Prevent unauthenticated or ordinary-user warehouse inventory disclosure. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { warehouseLocation: { findUnique: mocks.find } } }));
import { GET } from '@/app/api/warehouses/[...id]/route';
const request = () => new NextRequest('http://localhost:3000/api/warehouses/fixture?id=fixture');
const warehouse = { id: 'fixture', userId: null, companyId: null, postalCode: '0001',
  address: '', city: '', country: 'NO', latitude: null, longitude: null,
  createdAt: new Date(), updatedAt: new Date(), Inventory: [{ id: 'private-stock', stock: 1,
    Product: { id: 'private-product', title: 'Private fixture', price: 1, stock: 1, image: [] } }] };
beforeEach(() => { vi.clearAllMocks(); mocks.find.mockResolvedValue(warehouse); });
describe('warehouse detail access', () => {
  it('denies signed-out requests before reading the database', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it('does not expose inventory to ordinary demo users', async () => {
    mocks.auth.mockResolvedValue({ id: 'demo_fixture', role: 'USER' });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.products).toEqual([]);
    expect(data.warehouse.inventory).toEqual([]);
  });
  it('keeps authorized inventory reads available', async () => {
    mocks.auth.mockResolvedValue({ id: 'owner-fixture', role: 'OWNER' });
    expect((await (await GET(request())).json()).products).toHaveLength(1);
  });
});
