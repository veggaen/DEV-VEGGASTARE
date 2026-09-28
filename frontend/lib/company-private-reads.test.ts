/** @fileOverview Company internals must not be exposed through alternate read routes. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), company: vi.fn(), stock: vi.fn(), warehouse: vi.fn(), user: vi.fn(), rollups: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: {
  company: { findUnique: mocks.company, findFirst: mocks.company },
  warehouseLocation: { findMany: mocks.stock, findFirst: mocks.warehouse },
  user: { findUnique: mocks.user },
  dailyReachRollup: { findMany: mocks.rollups },
} }));
import { GET as details } from '@/app/api/companies/[companyId]/route';
import { GET as stock } from '@/app/api/companies/[companyId]/warehouses/stock/route';
import { GET as warehouse } from '@/app/api/companies/[companyId]/warehouses/[warehouseId]/route';
import { GET as reach } from '@/app/api/companies/[companyId]/reach/route';

const now = new Date('2026-09-25T00:00:00Z');
const warehouseRow = { id: 'warehouse', companyId: 'company', postalCode: '0001', address: 'Private address', city: 'Oslo', country: 'NO', Inventory: [], createdAt: now, updatedAt: now };
const companyRow = { id: 'company', name: 'Test company', ownerId: 'owner', creatorId: 'founder', logo: [], bannerImage: [], usesShipping: true,
  createdAt: now, updatedAt: now, Employee: [], WarehouseLocation: [warehouseRow], Wallet: [],
  User_Company_creatorIdToUser: null, User_Company_ownerIdToUser: null, Product: [], Conversation: [], reachLifetime: 0, reachMomentum: 0, employeePulseBonus: 0 };
const routes = [
  ['details', details, '/api/companies/company'],
  ['stock', stock, '/api/companies/company/warehouses/stock'],
  ['warehouse', warehouse, '/api/companies/company/warehouses/warehouse'],
  ['reach', reach, '/api/companies/company/reach'],
] as const;
const call = (route: typeof routes[number]) => route[1](new NextRequest(`http://localhost:3000${route[2]}`), { params: Promise.resolve({ companyId: 'company', warehouseId: 'warehouse' }) });

beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue(undefined); mocks.user.mockResolvedValue({ role: 'USER' });
  mocks.company.mockResolvedValue(companyRow); mocks.stock.mockResolvedValue([warehouseRow]); mocks.warehouse.mockResolvedValue(warehouseRow);
  mocks.rollups.mockResolvedValue([]);
});

describe.each(routes)('company private %s', (name) => {
  const route = routes.find(item => item[0] === name)!;
  it('denies anonymous requests before reading internal data', async () => {
    const response = await call(route);
    expect(response.status).toBe(401);
    expect(mocks.company).not.toHaveBeenCalled(); expect(mocks.stock).not.toHaveBeenCalled(); expect(mocks.warehouse).not.toHaveBeenCalled();
    expect(mocks.rollups).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('denies a deleted session account before internal reads', async () => {
    mocks.auth.mockResolvedValue({ id: 'deleted', role: 'OWNER' }); mocks.user.mockResolvedValue(null);
    expect((await call(route)).status).toBe(401); expect(mocks.company).not.toHaveBeenCalled(); expect(mocks.warehouse).not.toHaveBeenCalled();
  });
  it('uses current membership in the data query, not a client id or a stale administrator role', async () => {
    mocks.auth.mockResolvedValue({ id: 'member', role: 'OWNER' });
    const response = await call(route);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    const scope = { OR: [{ ownerId: 'member' }, { Employee: { some: { userId: 'member' } } }] };
    const query = name === 'warehouse' ? mocks.warehouse.mock.calls[0][0] : mocks.company.mock.calls[0][0];
    expect(query.where).toEqual(name === 'warehouse' ? { id: 'warehouse', companyId: 'company', Company: { is: scope } } : { id: 'company', ...scope });
    expect(JSON.stringify(query.where)).not.toContain('creatorId');
  });
  it.each(['ADMIN', 'OWNER'])('retains the current platform %s read scope', async role => {
    mocks.auth.mockResolvedValue({ id: 'administrator', role: 'USER' }); mocks.user.mockResolvedValue({ role });
    expect((await call(route)).status).toBe(200);
    const query = name === 'warehouse' ? mocks.warehouse.mock.calls[0][0] : mocks.company.mock.calls[0][0];
    expect(query.where).toEqual(name === 'warehouse' ? { id: 'warehouse', companyId: 'company', Company: { is: {} } } : { id: 'company' });
  });
  it('returns the same private absence response for inaccessible and missing records', async () => {
    mocks.auth.mockResolvedValue({ id: 'outsider', role: 'USER' }); mocks.company.mockResolvedValue(null); mocks.warehouse.mockResolvedValue(null);
    const response = await call(route);
    expect(response.status).toBe(404); expect(response.headers.get('cache-control')).toContain('no-store');
    const data = await response.json(); expect(data).not.toHaveProperty('employees'); expect(data).not.toHaveProperty('inventory'); expect(data).not.toHaveProperty('wallets');
    expect(mocks.rollups).not.toHaveBeenCalled();
  });
  it('does not leak database errors or private values', async () => {
    mocks.auth.mockResolvedValue({ id: 'owner', role: 'USER' }); mocks.user.mockRejectedValue(new Error('private database URL and address'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await call(route); expect(response.status).toBe(500); expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.text()).not.toContain('private database'); expect(JSON.stringify(log.mock.calls)).not.toContain('private database');
    } finally { log.mockRestore(); }
  });
});

it('does not load full owner/creator account records', async () => {
  mocks.auth.mockResolvedValue({ id: 'owner', role: 'USER' }); await call(routes[0]);
  const include = mocks.company.mock.calls[0][0].include;
  for (const relation of ['User_Company_creatorIdToUser', 'User_Company_ownerIdToUser']) {
    expect(Object.keys(include[relation].select).sort()).toEqual(['email', 'emailDisplayMode', 'id', 'image', 'name']);
  }
});
