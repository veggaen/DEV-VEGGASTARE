/** @fileOverview Isolated PostgreSQL races for OAuth confirmation and last-login safety. @stability stable */
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
const state = vi.hoisted(() => ({ db: null as unknown, userId: 'qa-oauth-owner' }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: state.userId } }) }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: async () => true }));
vi.mock('@/lib/mail', () => ({ sendOauthLinkConfirmationEmail: async () => { throw new Error('No email is sent by database tests'); } }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: async () => null }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
import { confirmOauthLink, unlinkOauthProvider } from '@/actions/oauth-links';

describe.skipIf(process.env.TEST_OAUTH_DATABASE !== '1')('OAuth real database transactions', () => {
  const schema = `qa_oauth_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  const transactionErrors: string[] = [];
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_oauth_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "email" TEXT, "name" TEXT, "password" TEXT, "emailVerified" TIMESTAMP(3), "updatedAt" TIMESTAMP(3), "hasGoogleAuth" BOOLEAN DEFAULT FALSE, "hasGithubAuth" BOOLEAN DEFAULT FALSE, "hasDiscordAuth" BOOLEAN DEFAULT FALSE);
      CREATE TABLE "Account" ("id" TEXT PRIMARY KEY, "userId" TEXT REFERENCES "User"("id"), "provider" TEXT);
      CREATE TABLE "PendingOAuthLink" ("id" TEXT PRIMARY KEY, "userId" TEXT REFERENCES "User"("id"), "provider" TEXT, "token" TEXT UNIQUE, "expires" TIMESTAMP(3), "createdAt" TIMESTAMP(3) DEFAULT now(), UNIQUE("userId", "provider"));`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 10 }, { schema }) });
    const transaction = db.$transaction.bind(db);
    state.db = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return async (...args: Parameters<typeof transaction>) => {
        try { return await transaction(...args); }
        catch (error) { transactionErrors.push(error instanceof Error ? error.message : 'Database transaction failed'); throw error; }
      };
      return Reflect.get(target, property);
    } });
    const path = await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`;
    expect(path[0].current_schema).toBe(schema);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_oauth_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
    }
  });
  it('eight token replays produce exactly one confirmation', async () => {
    await admin.query('INSERT INTO "User" ("id") VALUES ($1)', [state.userId]);
    await admin.query('INSERT INTO "Account" VALUES ($1,$2,$3)', ['qa-github', state.userId, 'github']);
    const token = randomUUID();
    await admin.query('INSERT INTO "PendingOAuthLink" ("id","userId","provider","token","expires") VALUES ($1,$2,$3,$4,now()+interval \'1 hour\')', ['qa-pending', state.userId, 'github', token]);
    const results = await Promise.all(Array.from({ length: 8 }, () => confirmOauthLink({ token, deny: false })));
    expect(transactionErrors).toEqual([]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(await db.pendingOAuthLink.count()).toBe(0);
    expect((await db.user.findUnique({ where: { id: state.userId }, select: { hasGithubAuth: true } }))?.hasGithubAuth).toBe(true);
  }, 30_000);
  it('competing removals of different providers preserve one usable login', async () => {
    await admin.query('INSERT INTO "Account" VALUES ($1,$2,$3)', ['qa-google', state.userId, 'google']);
    const results = await Promise.all([unlinkOauthProvider('github'), unlinkOauthProvider('google')]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(await db.account.count({ where: { userId: state.userId } })).toBe(1);
    expect(results.find(r => !r.ok)).toMatchObject({ error: expect.stringContaining('at least one sign-in') });
  }, 30_000);
});
