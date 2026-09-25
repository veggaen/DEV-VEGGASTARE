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
import { adminUserDetail } from './admin-user-detail';

describe.skipIf(process.env.TEST_ADMIN_DETAIL_DATABASE !== '1')('isolated admin edit transactions', () => {
  const schema = `qa_admin_detail_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_admin_detail_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TYPE "UserRole" AS ENUM ('OWNER','ADMIN','USER');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY,"role" "UserRole","tokenVersion" INTEGER,"name" TEXT,"bio" TEXT,"image" TEXT,"banner" TEXT,"updatedAt" TIMESTAMP(3) DEFAULT now());
      CREATE TYPE "AdminAction" AS ENUM ('VIEW','EDIT','ROLE_CHANGE'); CREATE TYPE "AdminTargetType" AS ENUM ('USER');
      CREATE TABLE "AdminAuditLog" ("id" TEXT PRIMARY KEY,"adminId" TEXT,"action" "AdminAction","targetType" "AdminTargetType","targetId" TEXT,
        "previousData" JSONB,"newData" JSONB,"ipAddress" TEXT,"userAgent" TEXT,"reason" TEXT,"createdAt" TIMESTAMP(3) DEFAULT now(),"updatedAt" TIMESTAMP(3) DEFAULT now());
      INSERT INTO "User" ("id","role","tokenVersion","name") VALUES ('qa-owner','OWNER',3,'QA Owner'),('qa-target','USER',7,'QA Member');`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30000);
  beforeEach(async () => {
    state.actor = { id: 'qa-owner', role: 'OWNER', sessionVersion: 3 };
    await admin.query(`UPDATE "User" SET "role"=(CASE WHEN "id"='qa-owner' THEN 'OWNER' ELSE 'USER' END)::"UserRole","tokenVersion"=CASE WHEN "id"='qa-owner' THEN 3 ELSE 7 END,"name"='QA Member'; DELETE FROM "AdminAuditLog";`);
  });
  afterAll(async () => { await db?.$disconnect(); if (admin && /^qa_admin_detail_[a-f0-9]{32}$/.test(schema)) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); } });
  const target = () => db.user.findUniqueOrThrow({ where: { id: 'qa-target' }, select: { id: true, name: true, role: true, tokenVersion: true, updatedAt: true } });
  const edit = (expectedUpdatedAt: string, patch: object) => adminUserDetail(new Request('http://localhost:3000/api/admin/users/qa-target', {
    method: 'PATCH', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt, reason: 'Disposable transaction QA', ...patch }),
  }), 'qa-target', 'PATCH');
  it('commits role, version and exact audit together; replay cannot update twice', async () => {
    const before = await target(); const first = await edit(before.updatedAt.toISOString(), { role: 'ADMIN' }); expect(first.status).toBe(200);
    expect(await target()).toMatchObject({ role: 'ADMIN', tokenVersion: 8 });
    const audit = await db.adminAuditLog.findFirstOrThrow(); expect(audit).toMatchObject({ action: 'ROLE_CHANGE', previousData: { role: 'USER' }, newData: { role: 'ADMIN' } });
    expect((await edit(before.updatedAt.toISOString(), { role: 'ADMIN' })).status).toBe(409); expect(await db.adminAuditLog.count()).toBe(1);
  }, 30000);
  it('rolls back the account and session revocation if audit insertion fails', async () => {
    const before = await target(); await admin.query('ALTER TABLE "AdminAuditLog" RENAME TO "AuditUnavailable"');
    try { expect((await edit(before.updatedAt.toISOString(), { role: 'ADMIN', name: 'Must roll back' })).status).toBe(503); }
    finally { await admin.query('ALTER TABLE "AuditUnavailable" RENAME TO "AdminAuditLog"'); }
    expect(await target()).toEqual(before); expect(await db.adminAuditLog.count()).toBe(0);
  }, 30000);
  it('serializes simultaneous edits from the same reviewed version', async () => {
    const before = await target();
    const responses = await Promise.all([edit(before.updatedAt.toISOString(), { name: 'First' }), edit(before.updatedAt.toISOString(), { name: 'Second' })]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]); expect(await db.adminAuditLog.count()).toBe(1);
    const audit = await db.adminAuditLog.findFirstOrThrow(); expect((await target()).name).toBe((audit.newData as { name: string }).name);
  }, 30000);
  it('sees revocation committed while an edit waits for its account lock', async () => {
    const before = await target(); await admin.query('BEGIN'); await admin.query('UPDATE "User" SET "tokenVersion"=4 WHERE "id"=\'qa-owner\'');
    let finished = false; const pending = edit(before.updatedAt.toISOString(), { name: 'Unauthorized' }).then(result => { finished = true; return result; });
    try { await new Promise(resolve => setTimeout(resolve, 150)); expect(finished).toBe(false); } finally { await admin.query('COMMIT'); }
    expect((await pending).status).toBe(401); expect(await target()).toEqual(before); expect(await db.adminAuditLog.count()).toBe(0);
  }, 30000);
});
