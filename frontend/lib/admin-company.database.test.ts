import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from './preview-database';
const state = vi.hoisted(() => ({ db: null as unknown, actor: { id: 'qa-owner', role: 'OWNER', sessionVersion: 3 } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => state.actor }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: async () => true, allowAdminDetailRead: async () => true }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }) }));
import { adminCompanyDetail } from './admin-company';

describe.skipIf(process.env.TEST_ADMIN_COMPANY_DATABASE !== '1')('isolated company edit transactions', () => {
  const schema = `qa_admin_company_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_admin_company_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TYPE "UserRole" AS ENUM ('OWNER','ADMIN','USER');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY,"role" "UserRole","tokenVersion" INTEGER);
      CREATE TABLE "Company" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"description" TEXT,"websiteUrl" TEXT,"logo" TEXT[] NOT NULL DEFAULT '{}',"bannerImage" TEXT[] NOT NULL DEFAULT '{}',"colorScheme" TEXT,"usesShipping" BOOLEAN DEFAULT false,"updatedAt" TIMESTAMP(3) DEFAULT now());
      CREATE TYPE "AdminAction" AS ENUM ('VIEW','EDIT'); CREATE TYPE "AdminTargetType" AS ENUM ('COMPANY');
      CREATE TABLE "AdminAuditLog" ("id" TEXT PRIMARY KEY,"adminId" TEXT,"action" "AdminAction","targetType" "AdminTargetType","targetId" TEXT,
        "previousData" JSONB,"newData" JSONB,"ipAddress" TEXT,"userAgent" TEXT,"reason" TEXT,"createdAt" TIMESTAMP(3) DEFAULT now(),"updatedAt" TIMESTAMP(3) DEFAULT now());
      INSERT INTO "User" ("id","role","tokenVersion") VALUES ('qa-owner','OWNER',3);
      INSERT INTO "Company" ("id","name") VALUES ('qa-company','QA Company');`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30000);
  beforeEach(async () => {
    state.actor = { id: 'qa-owner', role: 'OWNER', sessionVersion: 3 };
    await admin.query(`UPDATE "User" SET "role"='OWNER',"tokenVersion"=3; UPDATE "Company" SET "name"='QA Company',"logo"='{}',"usesShipping"=false; DELETE FROM "AdminAuditLog";`);
  });
  afterAll(async () => { await db?.$disconnect(); if (admin && /^qa_admin_company_[a-f0-9]{32}$/.test(schema)) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); } });
  const target = () => db.company.findUniqueOrThrow({ where: { id: 'qa-company' }, select: { id: true, name: true, logo: true, usesShipping: true, updatedAt: true } });
  const edit = (expectedUpdatedAt: string, patch: object) => adminCompanyDetail(new Request('http://localhost:3000/api/admin/companies/qa-company', {
    method: 'PATCH', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt, reason: 'Disposable company transaction QA', ...patch }),
  }), 'qa-company', 'PATCH');
  it('commits typed arrays and exact audit together; replay cannot update twice', async () => {
    const before = await target(); expect((await edit(before.updatedAt.toISOString(), { name: 'Changed', logo: ['https://example.test/logo.png'], usesShipping: true })).status).toBe(200);
    expect(await target()).toMatchObject({ name: 'Changed', logo: ['https://example.test/logo.png'], usesShipping: true });
    const audit = await db.adminAuditLog.findFirstOrThrow(); expect(audit).toMatchObject({ action: 'EDIT', previousData: { name: 'QA Company', logo: [], usesShipping: false }, newData: { name: 'Changed', logo: ['https://example.test/logo.png'], usesShipping: true } });
    expect((await edit(before.updatedAt.toISOString(), { name: 'Again' })).status).toBe(409); expect(await db.adminAuditLog.count()).toBe(1);
  }, 30000);
  it('rolls back all company changes if audit insertion fails', async () => {
    const before = await target(); await admin.query('ALTER TABLE "AdminAuditLog" RENAME TO "AuditUnavailable"');
    try { expect((await edit(before.updatedAt.toISOString(), { name: 'Must roll back' })).status).toBe(503); }
    finally { await admin.query('ALTER TABLE "AuditUnavailable" RENAME TO "AdminAuditLog"'); }
    expect(await target()).toEqual(before); expect(await db.adminAuditLog.count()).toBe(0);
  }, 30000);
  it('serializes simultaneous edits from the same reviewed version', async () => {
    const before = await target();
    const responses = await Promise.all([edit(before.updatedAt.toISOString(), { name: 'First' }), edit(before.updatedAt.toISOString(), { name: 'Second' })]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]); expect(await db.adminAuditLog.count()).toBe(1);
    const audit = await db.adminAuditLog.findFirstOrThrow(); expect((await target()).name).toBe((audit.newData as { name: string }).name);
  }, 30000);
  it('sees revocation committed while an edit waits for the actor lock', async () => {
    const before = await target(); await admin.query('BEGIN'); await admin.query('UPDATE "User" SET "tokenVersion"=4 WHERE "id"=\'qa-owner\'');
    let finished = false; const pending = edit(before.updatedAt.toISOString(), { name: 'Unauthorized' }).then(result => { finished = true; return result; });
    try { await new Promise(resolve => setTimeout(resolve, 150)); expect(finished).toBe(false); } finally { await admin.query('COMMIT'); }
    expect((await pending).status).toBe(401); expect(await target()).toEqual(before); expect(await db.adminAuditLog.count()).toBe(0);
  }, 30000);
});
