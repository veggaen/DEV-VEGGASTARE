import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
const state = vi.hoisted(() => ({ db: null as unknown, code: '', send: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => ({ id: 'qa-settings-person' }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }) }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: async () => true }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
vi.mock('@/lib/mail', () => ({ sendAccountSecurityCode: state.send }));
import { saveAccountSettings } from './account-settings';
import { requestAccountDeletion, cancelAccountDeletion } from '@/actions/gdpr-account-deletion';

describe.skipIf(process.env.TEST_ACCOUNT_SETTINGS_DATABASE !== '1')('account settings isolated database transactions', () => {
  const schema = `qa_settings_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    vi.stubEnv('AUTH_SECRET', 'isolated-fixture-only-key');
    state.send.mockImplementation(async (_email: string, code: string) => { state.code = code; });
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_settings_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "email" TEXT, "emailVerified" TIMESTAMP(3), "password" TEXT, "role" TEXT DEFAULT 'USER', "name" TEXT,
      "tokenVersion" INTEGER DEFAULT 0, "isTwoFactorEnabled" BOOLEAN DEFAULT false, "updatedAt" TIMESTAMP(3) DEFAULT now());
      CREATE TABLE "TwoFactorToken" ("id" TEXT PRIMARY KEY, "email" TEXT, "token" TEXT UNIQUE, "expires" TIMESTAMP(3), "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3) DEFAULT now());
      CREATE TABLE "PasswordResetToken" ("id" TEXT PRIMARY KEY, "email" TEXT);
      CREATE TABLE "EmailLoginToken" ("id" TEXT PRIMARY KEY, "email" TEXT);
      CREATE TABLE "TwoFactorConfirmation" ("id" TEXT PRIMARY KEY, "userId" TEXT);
      CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','CANCELLED','FAILED');
      CREATE TABLE "AccountDeletionRequest" ("id" TEXT PRIMARY KEY, "userId" TEXT REFERENCES "User"("id"), "status" "DataRequestStatus",
        "reason" TEXT, "scheduledFor" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3) DEFAULT now());`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 10 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
    await admin.query('INSERT INTO "User" ("id","email","emailVerified") VALUES ($1,$2,now())', ['qa-settings-person', 'qa@example.test']);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_settings_[a-f0-9]{32}$/.test(schema)) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); }
    vi.unstubAllEnvs();
  });
  const input = { isTwoFactorEnabled: true, expectedTwoFactorEnabled: false };
  const save = (raw: unknown) => saveAccountSettings('qa-settings-person', 'http://localhost:3000', raw);
  it('eight competing confirmations yield exactly one security change and one version increment', async () => {
    expect(await save(input)).toEqual({ twoFactor: true });
    const results = await Promise.all(Array.from({ length: 8 }, () => save({ ...input, securityCode: state.code }).catch(error => ({ error: error.message }))));
    expect(results.filter(result => 'success' in result)).toHaveLength(1); expect(results.filter(result => 'error' in result)).toHaveLength(7);
    expect(await db.user.findUnique({ where: { id: 'qa-settings-person' }, select: { tokenVersion: true, isTwoFactorEnabled: true } })).toEqual({ tokenVersion: 1, isTwoFactorEnabled: true });
    expect(await db.twoFactorToken.count()).toBe(0); expect(state.send).toHaveBeenCalledTimes(1);
  }, 30_000);
  it('a failed revocation rolls back the user change and code consumption', async () => {
    await admin.query('UPDATE "User" SET "isTwoFactorEnabled"=false,"updatedAt"=now()');
    await save(input); const code = state.code;
    await admin.query(`ALTER TABLE "TwoFactorConfirmation" RENAME TO "ConfirmationUnavailable"`);
    try {
      await expect(save({ ...input, securityCode: code })).rejects.toThrow();
      expect(await db.user.findUnique({ where: { id: 'qa-settings-person' }, select: { tokenVersion: true, isTwoFactorEnabled: true } })).toEqual({ tokenVersion: 1, isTwoFactorEnabled: false });
      expect(await db.twoFactorToken.count()).toBe(1);
    } finally { await admin.query(`ALTER TABLE "ConfirmationUnavailable" RENAME TO "TwoFactorConfirmation"`); }
    expect(await save({ ...input, securityCode: code })).toMatchObject({ signInRequired: true });
  }, 30_000);
  it('serializes deletion requests and never cancels a processing request', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => requestAccountDeletion('Disposable test request')));
    expect(results.filter(result => result.success)).toHaveLength(1); expect(await db.accountDeletionRequest.count()).toBe(1);
    await db.accountDeletionRequest.updateMany({ data: { status: 'PROCESSING' } });
    expect((await cancelAccountDeletion()).success).toBe(false);
    await db.accountDeletionRequest.updateMany({ data: { status: 'PENDING' } });
    expect((await cancelAccountDeletion()).success).toBe(true);
    expect(await db.user.count()).toBe(1); expect((await db.accountDeletionRequest.findFirst())?.status).toBe('CANCELLED');
  }, 30_000);
});
