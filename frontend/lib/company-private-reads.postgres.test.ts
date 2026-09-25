/** @fileOverview Opt-in real company membership and revocation acceptance; every synthetic row rolls back. @stability stable */
import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ viewer: undefined as { id: string; role: string } | undefined }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => state.viewer }));

it.skipIf(process.env.RUN_COMPANY_READ_POSTGRES_TESTS !== '1')('enforces membership, demotion, transfer and warehouse binding against isolated PostgreSQL', async () => {
  if (process.env.VERCEL_ENV !== 'preview' || !process.env.DATABASE_URL_MAINPREVIEW) throw new Error('Isolated Preview database required');
  const { dbPrisma } = await import('@/lib/db');
  const { GET: details } = await import('@/app/api/companies/[companyId]/route');
  const { GET: stock } = await import('@/app/api/companies/[companyId]/warehouses/stock/route');
  const { GET: warehouse } = await import('@/app/api/companies/[companyId]/warehouses/[warehouseId]/route');
  const { GET: reach } = await import('@/app/api/companies/[companyId]/reach/route');
  const rollback = new Error('ROLLBACK_PRIVATE_COMPANY_FIXTURE');
  const suffix = randomUUID(); const id = (label: string) => `company_qa_${label}_${suffix}`;
  let checks = 0;
  try {
    await expect(dbPrisma.$transaction(async tx => {
      await tx.user.createMany({ data: ['owner', 'founder', 'member', 'outsider', 'admin'].map(label => ({ id: id(label), role: label === 'admin' ? 'ADMIN' as const : 'USER' as const })) });
      await tx.company.createMany({ data: [
        { id: id('company'), name: 'Disposable private company', ownerId: id('owner'), creatorId: id('founder'), logo: [], bannerImage: [] },
        { id: id('other-company'), name: 'Other company', ownerId: id('outsider'), creatorId: id('outsider'), logo: [], bannerImage: [] },
      ] });
      await tx.employee.create({ data: { userId: id('member'), companyId: id('company'), role: 'STAFF', permissions: { CAN_ADD_EMPLOYEE: false } } });
      await tx.warehouseLocation.createMany({ data: [
        { id: id('warehouse'), companyId: id('company'), address: 'Private QA address', city: 'Oslo', country: 'NO', postalCode: '0001' },
        { id: id('other-warehouse'), companyId: id('other-company'), address: 'Other private address', city: 'Oslo', country: 'NO', postalCode: '0002' },
      ] });
      const spies = [
        vi.spyOn(dbPrisma.user, 'findUnique').mockImplementation(tx.user.findUnique.bind(tx.user)),
        vi.spyOn(dbPrisma.company, 'findFirst').mockImplementation(tx.company.findFirst.bind(tx.company)),
        vi.spyOn(dbPrisma.warehouseLocation, 'findFirst').mockImplementation(tx.warehouseLocation.findFirst.bind(tx.warehouseLocation)),
        vi.spyOn(dbPrisma.dailyReachRollup, 'findMany').mockImplementation(tx.dailyReachRollup.findMany.bind(tx.dailyReachRollup)),
      ];
      const read = async (expected: number, warehouseId = id('warehouse')) => {
        for (const route of [details, stock, warehouse, reach]) {
          const response = await route(new NextRequest('http://localhost:3000/api/companies/qa'), { params: Promise.resolve({ companyId: id('company'), warehouseId }) });
          expect(response.status).toBe(expected); expect(response.headers.get('cache-control')).toBe('private, no-store'); checks++;
          const body = await response.json();
          if (expected !== 200) expect(JSON.stringify(body)).not.toContain('Private QA address');
          else if (route === details) expect(body.employees[0]?.permissions).toEqual({ CAN_ADD_EMPLOYEE: false });
        }
      };
      try {
        state.viewer = undefined; await read(401);
        for (const label of ['outsider', 'founder']) { state.viewer = { id: id(label), role: 'USER' }; await read(404); }
        for (const label of ['owner', 'member', 'admin']) { state.viewer = { id: id(label), role: 'USER' }; await read(200); }
        state.viewer = { id: id('owner'), role: 'USER' };
        const wrongWarehouse = await warehouse(new NextRequest('http://localhost:3000/api/companies/qa'), { params: Promise.resolve({ companyId: id('company'), warehouseId: id('other-warehouse') }) });
        expect(wrongWarehouse.status).toBe(404); checks++;
        await tx.employee.deleteMany({ where: { companyId: id('company'), userId: id('member') } });
        state.viewer = { id: id('member'), role: 'USER' }; await read(404);
        await tx.user.update({ where: { id: id('admin') }, data: { role: 'USER' } });
        state.viewer = { id: id('admin'), role: 'ADMIN' }; await read(404);
        await tx.company.update({ where: { id: id('company') }, data: { ownerId: id('outsider') } });
        state.viewer = { id: id('owner'), role: 'OWNER' }; await read(404);
      } finally { spies.forEach(spy => spy.mockRestore()); }
      expect(checks).toBe(37);
      throw rollback;
    }, { timeout: 30_000 })).rejects.toBe(rollback);
    expect(await dbPrisma.company.count({ where: { id: id('company') } })).toBe(0);
    expect(await dbPrisma.user.count({ where: { id: id('owner') } })).toBe(0);
  } finally { await dbPrisma.$disconnect(); }
}, 45_000);
