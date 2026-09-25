/** @fileOverview Isolated PostgreSQL proof that sidebar reads cannot assign payout wallets. @stability stable */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => ({ id: 'qa-owner' }) }));
vi.mock('@/data/user', () => ({ getUserById: async () => ({ id: 'qa-owner', web3ModeEnabled: true }) }));
import { GET } from '@/app/api/wallets/evm/route';

describe.skipIf(process.env.TEST_WALLET_READ_DATABASE !== '1')('wallet listing against isolated PostgreSQL', () => {
  const schema = `qa_wallet_read_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_wallet_read_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TYPE "ChainFamily" AS ENUM ('EVM','SOLANA');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "defaultReceivingWalletId" TEXT);
      CREATE TABLE "Wallet" ("id" TEXT PRIMARY KEY, "label" TEXT DEFAULT 'QA wallet', "family" "ChainFamily" DEFAULT 'EVM',
        "address" TEXT DEFAULT '0x1111111111111111111111111111111111111111', "chainId" INTEGER DEFAULT 1,
        "ownerUserId" TEXT, "ownerCompanyId" TEXT, "isDefault" BOOLEAN DEFAULT FALSE, "verifiedAt" TIMESTAMP(3) DEFAULT now(),
        "connectorType" TEXT, "authProvider" TEXT, "socialEmail" TEXT, "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3) DEFAULT now());
      CREATE TABLE "Donation" ("id" TEXT PRIMARY KEY, "walletId" TEXT, "status" TEXT, "amountUsd" DOUBLE PRECISION);
      INSERT INTO "User" VALUES ('qa-owner','existing-destination');
      INSERT INTO "Wallet" ("id","ownerUserId","ownerCompanyId") VALUES
        ('first','qa-owner',NULL), ('second','qa-owner',NULL), ('other','other-owner',NULL), ('company','qa-owner','qa-company');
      INSERT INTO "Wallet" ("id","ownerUserId","family") VALUES ('solana','qa-owner','SOLANA');
      INSERT INTO "Donation" VALUES ('pending','first','PENDING_CONFIRMATION',1000000), ('confirmed','first','CONFIRMED',3);`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 4 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_wallet_read_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
    }
  });
  it('filters by personal ownership/family and leaves payout settings unchanged during concurrent reads', async () => {
    const before = (await admin.query('SELECT * FROM "Wallet" ORDER BY "id"')).rows;
    const responses = await Promise.all([GET(), GET(), GET()]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      const { wallets } = await response.json();
      expect(wallets.map((w: { id: string }) => w.id).sort()).toEqual(['first', 'second']);
      expect(wallets.every((w: { isDefault: boolean }) => !w.isDefault)).toBe(true);
      expect(wallets.find((w: { id: string }) => w.id === 'first').donationTotalUsd).toBe(3);
    }
    expect((await admin.query('SELECT * FROM "Wallet" ORDER BY "id"')).rows).toEqual(before);
    expect((await admin.query('SELECT "defaultReceivingWalletId" FROM "User" WHERE "id"=$1', ['qa-owner'])).rows[0].defaultReceivingWalletId).toBe('existing-destination');
  });
});
