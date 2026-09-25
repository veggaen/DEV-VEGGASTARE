/** Real team access and race tests, restricted to a disposable schema on isolated Preview. */
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: vi.fn() }));
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
import { mutateCompanyTeam, teamFailure } from './company-team';

describe.skipIf(process.env.TEST_COMPANY_TEAM_DATABASE !== '1')('company team database authorization', () => {
  const schema = `qa_company_team_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    if (process.env.VERCEL_ENV !== 'preview') throw new Error('Isolated Preview required');
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_company_team_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TYPE "EmployeeRole" AS ENUM ('OWNER','MANAGER','STAFF','WAREHOUSE_MANAGER','WAREHOUSE_WORKER','ACCOUNTANT','USER');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "role" TEXT NOT NULL DEFAULT 'USER', "name" TEXT, "image" TEXT, "password" TEXT DEFAULT 'must-not-return');
      CREATE TABLE "Company" ("id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL);
      CREATE TABLE "Employee" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"), "companyId" TEXT NOT NULL REFERENCES "Company"("id"), "role" "EmployeeRole" NOT NULL, "permissions" JSONB NOT NULL, "jobTitle" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(), UNIQUE("userId","companyId"));`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 8 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_company_team_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      expect((await admin.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [schema])).rowCount).toBe(0); await admin.end();
    }
  });
  const managerPermissions = { CAN_ADD_EMPLOYEE: true, CAN_REMOVE_EMPLOYEE: true, CAN_EDIT_EMPLOYEE_ROLE: true, CAN_EDIT_PERMISSION: true, CAN_VIEW_SALES: true };
  beforeEach(async () => {
    await admin.query(`TRUNCATE "Employee","Company","User";
      INSERT INTO "User" ("id","name","role") VALUES ('owner','Owner','USER'),('manager','Manager','USER'),('staff','Staff','USER'),('outsider','Outsider','USER'),('admin','Admin','ADMIN'),('new','New member','USER');
      INSERT INTO "Company" ("id","ownerId") VALUES ('company','owner'),('foreign','outsider');
      INSERT INTO "Employee" ("id","userId","companyId","role","permissions") VALUES ('staff-row','staff','company','STAFF','{}'),('foreign-row','new','foreign','USER','{}');`);
    await admin.query('INSERT INTO "Employee" ("id","userId","companyId","role","permissions") VALUES ($1,$2,$3,$4,$5)', ['manager-row','manager','company','MANAGER',JSON.stringify(managerPermissions)]);
  });
  const target = async (employeeId = 'staff-row') => {
    const row = await db.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { updatedAt: true } });
    return { companyId: 'company', employeeId, expectedUpdatedAt: row.updatedAt.toISOString() };
  };
  const edit = async (actor = 'owner', permissions = { CAN_VIEW_SALES: true }) => mutateCompanyTeam(actor, { kind: 'permissions', ...await target(), permissions });
  it('owner without an employee row can add, edit and remove; returns only a minimal DTO', async () => {
    const added = await mutateCompanyTeam('owner', { kind: 'add', companyId: 'company', userId: 'new', role: 'USER' });
    expect(added?.user).toEqual({ id: 'new', name: 'New member', image: null });
    expect(JSON.stringify(added)).not.toMatch(/password|must-not-return|email|companyId/);
    const row = await edit(); expect(row?.permissions).toEqual({ CAN_VIEW_SALES: true });
    await mutateCompanyTeam('owner', { kind: 'role', ...await target(), newRole: 'ACCOUNTANT' });
    await mutateCompanyTeam('owner', { kind: 'remove', ...await target() });
    expect(await db.employee.count({ where: { id: 'staff-row' } })).toBe(0);
  });
  it('outsider, stale platform role, deleted account and demo cannot mutate', async () => {
    await admin.query(`UPDATE "User" SET "role"='USER' WHERE "id"='admin'`);
    for (const actor of ['outsider','admin','deleted','demo_fixture']) await expect(edit(actor)).rejects.toThrow();
    expect((await db.employee.findUniqueOrThrow({ where: { id: 'staff-row' } })).permissions).toEqual({});
  });
  it('fresh platform admin can manage a company without membership', async () => { expect((await edit('admin'))?.permissions).toEqual({ CAN_VIEW_SALES: true }); });
  it('binds target employee to the authorized company', async () => {
    await expect(mutateCompanyTeam('owner', { kind: 'permissions', ...await target('foreign-row'), permissions: { CAN_EDIT_PERMISSION: true } })).rejects.toMatchObject({ status: 404 });
  });
  it('rejects self edits, owner changes and fake ownership assignments', async () => {
    await expect(mutateCompanyTeam('manager', { kind: 'permissions', ...await target('manager-row'), permissions: { CAN_EDIT_PERMISSION: false } })).rejects.toThrow('own access');
    await admin.query(`INSERT INTO "Employee" ("id","userId","companyId","role","permissions") VALUES ('owner-row','owner','company','USER','{}')`);
    for (const kind of ['remove','role','permissions']) await expect(mutateCompanyTeam('admin', { kind, ...await target('owner-row'), ...(kind === 'role' ? { newRole: 'USER' } : kind === 'permissions' ? { permissions: { CAN_VIEW_SALES: true } } : {}) })).rejects.toThrow('owner');
    await expect(mutateCompanyTeam('owner', { kind: 'role', ...await target(), newRole: 'OWNER' })).rejects.toThrow('Ownership');
    await expect(mutateCompanyTeam('owner', { kind: 'add', companyId: 'company', userId: 'new', role: 'OWNER' })).rejects.toThrow('Ownership');
  });
  it('delegates only owned permissions and strictly lower roles', async () => {
    expect((await edit('manager'))?.permissions).toEqual({ CAN_VIEW_SALES: true });
    await expect(edit('manager', { CAN_PROCESS_REFUNDS: true } as never)).rejects.toThrow('hold yourself');
    for (const newRole of ['MANAGER','OWNER']) await expect(mutateCompanyTeam('manager', { kind: 'role', ...await target(), newRole })).rejects.toThrow();
    await expect(mutateCompanyTeam('manager', { kind: 'add', companyId: 'company', userId: 'new', role: 'MANAGER' })).rejects.toThrow('below');
    await mutateCompanyTeam('manager', { kind: 'role', ...await target(), newRole: 'WAREHOUSE_MANAGER' });
  });
  it('cannot demote or remove a lower-ranked member holding powers the actor lacks', async () => {
    await edit('owner', { CAN_PROCESS_REFUNDS: true } as never);
    for (const kind of ['remove','role']) await expect(mutateCompanyTeam('manager', { kind, ...await target(), ...(kind === 'role' ? { newRole: 'USER' } : {}) })).rejects.toThrow('higher access');
  });
  it('preserves flags outside the patch and rejects unknown or non-boolean input', async () => {
    await admin.query(`UPDATE "Employee" SET "permissions"='{"CAN_VIEW_TAX_REPORTS":true,"FUTURE_PERMISSION":true}' WHERE "id"='staff-row'`);
    expect((await edit())?.permissions).toEqual({ CAN_VIEW_TAX_REPORTS: true, FUTURE_PERMISSION: true, CAN_VIEW_SALES: true });
    for (const permissions of [{ SUPERUSER: true }, { CAN_VIEW_SALES: 'true' }, {}]) await expect(mutateCompanyTeam('owner', { kind: 'permissions', ...await target(), permissions })).rejects.toMatchObject({ status: 400 });
  });
  it('simultaneous writes of a reviewed version commit exactly once', async () => {
    const reviewed = await target();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => mutateCompanyTeam('owner', { kind: 'permissions', ...reviewed, permissions: { CAN_VIEW_SALES: true } })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) if (result.status === 'rejected') expect(result.reason.status).toBe(409);
  });
  it('stale removal cannot erase a newer access change or re-added person', async () => {
    const reviewed = await target(); await edit();
    await expect(mutateCompanyTeam('owner', { kind: 'remove', ...reviewed })).rejects.toMatchObject({ status: 409 });
    await mutateCompanyTeam('owner', { kind: 'remove', ...await target() });
    await mutateCompanyTeam('owner', { kind: 'add', companyId: 'company', userId: 'staff', role: 'USER' });
    await expect(mutateCompanyTeam('owner', { kind: 'remove', ...reviewed })).rejects.toMatchObject({ status: 404 });
  });
  it('revocation and company ownership transfers invalidate later requests', async () => {
    await mutateCompanyTeam('owner', { kind: 'permissions', ...await target('manager-row'), permissions: { CAN_EDIT_PERMISSION: false } });
    await expect(edit('manager')).rejects.toThrow('no longer');
    await admin.query(`UPDATE "Company" SET "ownerId"='outsider' WHERE "id"='company'`);
    await expect(edit('owner')).rejects.toThrow('no longer');
  });
  it('concurrent duplicate add creates exactly one membership', async () => {
    const results = await Promise.allSettled([1,2].map(() => mutateCompanyTeam('owner', { kind: 'add', companyId: 'company', userId: 'new', role: 'USER' })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(teamFailure(rejected.reason).status).toBe(409);
  });
});
