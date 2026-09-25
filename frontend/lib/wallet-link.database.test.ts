/** @fileOverview Real PostgreSQL wallet proof races, isolation and rollback. @stability stable */
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { previewDatabaseUrl } from '@/lib/preview-database';
import { parseSiweMessage } from 'viem/siwe';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ db: null as unknown, codeMail: vi.fn(), linkedMail: vi.fn() }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => ({ id: 'qa-owner' }) }));
vi.mock('@/lib/rate-limit', () => ({ getClientIdentifier: () => 'qa', checkRateLimit: async () => ({ success: true }), rateLimitedResponse: vi.fn() }));
vi.mock('@/lib/mail', () => ({ sendTwoFactorTokenEmail: state.codeMail, sendWalletLinkedEmail: state.linkedMail }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: async () => null }));
import { createWalletLinkChallenge, verifyWalletLink } from '@/lib/wallet-link';
import { POST as issueRoute } from '@/app/api/wallets/evm/challenge/route';
import { POST as verifyRoute } from '@/app/api/wallets/evm/verify/route';

describe.skipIf(process.env.TEST_WALLET_LINK_DATABASE !== '1')('wallet linking in isolated PostgreSQL', () => {
  const schema = `qa_wallet_link_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  const account = privateKeyToAccount(generatePrivateKey()); // disposable, no funds
  const input = { userId: 'qa-owner', origin: 'http://localhost:3000', address: account.address, chainId: 1 };
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_wallet_link_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TYPE "ChainFamily" AS ENUM ('EVM','SOLANA');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "email" TEXT DEFAULT 'qa@example.test', "name" TEXT DEFAULT 'QA',
        "web3ModeEnabled" BOOLEAN DEFAULT TRUE, "isTwoFactorEnabled" BOOLEAN DEFAULT FALSE, "defaultReceivingWalletId" TEXT, "updatedAt" TIMESTAMP(3));
      CREATE TABLE "WalletVerificationChallenge" ("id" TEXT PRIMARY KEY, "userId" TEXT REFERENCES "User"("id"), "family" "ChainFamily",
        "address" TEXT, "chainId" INTEGER, "solanaCluster" TEXT, "nonce" TEXT, "message" TEXT, "expires" TIMESTAMP(3), "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3));
      CREATE TABLE "TwoFactorToken" ("id" TEXT PRIMARY KEY, "email" TEXT, "token" TEXT UNIQUE, "expires" TIMESTAMP(3), "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3));
      CREATE TABLE "Wallet" ("id" TEXT PRIMARY KEY, "label" TEXT, "family" "ChainFamily", "address" TEXT, "chainId" INTEGER,
        "solanaCluster" TEXT, "ownerUserId" TEXT, "ownerCompanyId" TEXT, "isDefault" BOOLEAN DEFAULT FALSE, "verifiedAt" TIMESTAMP(3),
        "connectorType" TEXT, "authProvider" TEXT, "socialEmail" TEXT, "donationTotalUsd" DOUBLE PRECISION DEFAULT 0, "riskTier" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3));`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 6 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_wallet_link_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
    }
  });
  beforeEach(async () => {
    state.codeMail.mockReset().mockResolvedValue(undefined); state.linkedMail.mockReset().mockResolvedValue(undefined);
    await admin.query(`TRUNCATE "WalletVerificationChallenge","Wallet","TwoFactorToken","User";
      INSERT INTO "User" ("id") VALUES ('qa-owner'), ('qa-other');`);
  });
  const issue = async (overrides = {}) => {
    const challenge = await createWalletLinkChallenge({ ...input, ...overrides });
    if (!challenge.challengeId) throw new Error('Unexpected code gate');
    return challenge;
  };
  const signed = async (overrides = {}) => {
    const challenge = await issue(overrides);
    return { userId: input.userId, origin: input.origin, challengeId: challenge.challengeId,
      signature: await account.signMessage({ message: challenge.message }) };
  };
  it.each(['http://localhost:3000', 'https://preview.example.test', 'https://www.veggat.com'])('binds a standard SIWE message to %s, account and chain', async origin => {
    const challenge = await issue({ origin, chainId: 8453 });
    expect(parseSiweMessage(challenge.message)).toMatchObject({ domain: new URL(origin).host, uri: `${origin}/settings`, requestId: input.userId, chainId: 8453, address: account.address });
    const proof = { userId: input.userId, origin, challengeId: challenge.challengeId, signature: await account.signMessage({ message: challenge.message }) };
    expect((await verifyWalletLink(proof)).wallet.chainId).toBe(8453);
  });
  it('concurrent replay commits exactly one wallet and one challenge consumption', async () => {
    const proof = await signed();
    const results = await Promise.allSettled([verifyWalletLink(proof), verifyWalletLink(proof), verifyWalletLink(proof)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(2);
    expect(await db.wallet.count()).toBe(1);
    expect(await db.walletVerificationChallenge.count({ where: { usedAt: { not: null } } })).toBe(1);
    const wallet = await db.wallet.findFirst();
    expect((await db.user.findUnique({ where: { id: input.userId }, select: { defaultReceivingWalletId: true } }))?.defaultReceivingWalletId).toBe(wallet?.id);
  });
  it('serializes challenge replacement without deleting the new challenge', async () => {
    const challenges = await Promise.all([issue(), issue(), issue()]);
    expect(await db.walletVerificationChallenge.count()).toBe(1);
    const retained = await db.walletVerificationChallenge.findFirst();
    expect(challenges.some(c => c.challengeId === retained?.id)).toBe(true);
    const proof = { ...input, challengeId: retained!.id, signature: await account.signMessage({ message: retained!.message }) };
    expect((await verifyWalletLink(proof)).wallet.address).toBe(account.address);
  });
  it.each(['owner', 'origin', 'signature', 'expired', '2fa-changed', 'disabled'])('rejects %s without consuming or linking', async fault => {
    const proof = await signed();
    if (fault === 'owner') proof.userId = 'qa-other';
    if (fault === 'origin') proof.origin = 'https://www.veggat.com';
    if (fault === 'signature') proof.signature = await privateKeyToAccount(generatePrivateKey()).signMessage({ message: 'other' });
    if (fault === 'expired') await db.walletVerificationChallenge.update({ where: { id: proof.challengeId }, data: { expires: new Date(0) } });
    if (fault === '2fa-changed') await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    if (fault === 'disabled') await admin.query(`UPDATE "User" SET "web3ModeEnabled"=FALSE WHERE "id"='qa-owner'`);
    await expect(verifyWalletLink(proof)).rejects.toThrow(); expect(await db.wallet.count()).toBe(0);
    expect((await db.walletVerificationChallenge.findUnique({ where: { id: proof.challengeId } }))?.usedAt).toBeNull();
  });
  it('rolls challenge consumption back when a wallet write fails', async () => {
    const proof = await signed();
    await admin.query(`ALTER TABLE "Wallet" ADD CONSTRAINT qa_reject_write CHECK ("ownerUserId" <> 'qa-owner')`);
    try { await expect(verifyWalletLink(proof)).rejects.toThrow(); }
    finally { await admin.query(`ALTER TABLE "Wallet" DROP CONSTRAINT qa_reject_write`); }
    expect((await db.walletVerificationChallenge.findUnique({ where: { id: proof.challengeId } }))?.usedAt).toBeNull();
    expect((await verifyWalletLink(proof)).wallet.verifiedAt).not.toBeNull();
  });
  it('preserves the existing receiving choice and updates a linked address instead of duplicating it', async () => {
    await admin.query(`UPDATE "User" SET "defaultReceivingWalletId"='existing-destination' WHERE "id"='qa-owner'`);
    await verifyWalletLink(await signed()); await verifyWalletLink(await signed());
    expect(await db.wallet.count()).toBe(1); expect((await db.wallet.findFirst())?.isDefault).toBe(false);
    expect((await db.user.findUnique({ where: { id: input.userId }, select: { defaultReceivingWalletId: true } }))?.defaultReceivingWalletId).toBe('existing-destination');
  });
  it('requires a purpose-scoped exact six-digit code and consumes it only once', async () => {
    await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    const gate = await createWalletLinkChallenge(input); expect(gate.twoFactor).toBe(true);
    expect(await db.walletVerificationChallenge.count()).toBe(0);
    await expect(createWalletLinkChallenge({ ...input, code: `${gate.code}0` })).rejects.toThrow('Incorrect code');
    const results = await Promise.allSettled([issue({ code: gate.code }), issue({ code: gate.code })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await db.twoFactorToken.count()).toBe(0);
    const retained = await db.walletVerificationChallenge.findFirst();
    const proof = { ...input, challengeId: retained!.id, signature: await account.signMessage({ message: retained!.message }) };
    expect((await verifyWalletLink(proof)).wallet.verifiedAt).not.toBeNull();
  });
  it('does not accept ordinary sign-in codes, expired codes or a code from another host', async () => {
    await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    await db.twoFactorToken.create({ data: { email: 'qa@example.test', token: '123456', expires: new Date(Date.now() + 300_000) } });
    await expect(issue({ code: '123456' })).rejects.toThrow('Incorrect code');
    const gate = await createWalletLinkChallenge(input);
    await expect(issue({ code: gate.code, origin: 'https://www.veggat.com' })).rejects.toThrow('Incorrect code');
    await db.twoFactorToken.updateMany({ where: { email: { startsWith: 'wallet-link:' } }, data: { expires: new Date(0) } });
    await expect(issue({ code: gate.code })).rejects.toThrow('expired');
    expect(await db.walletVerificationChallenge.count()).toBe(0);
  });
  it('routes complete a real signed code-gated link and send one mocked confirmation across a replay', async () => {
    await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    const request = (path: string, data: unknown) => new NextRequest(`${input.origin}/api/wallets/evm/${path}`, {
      method: 'POST', headers: { origin: input.origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const payload = { address: account.address, chainId: 1 };
    expect(await (await issueRoute(request('challenge', payload))).json()).toEqual({ twoFactor: true });
    expect(state.codeMail).toHaveBeenCalledTimes(1);
    const code = state.codeMail.mock.calls[0][1];
    expect((await db.twoFactorToken.findFirst())?.token).not.toBe(code);
    const issued = await issueRoute(request('challenge', { ...payload, code })); expect(issued.status).toBe(201);
    const challenge = await issued.json();
    const proof = { challengeId: challenge.challengeId, signature: await account.signMessage({ message: challenge.message }) };
    const results = await Promise.all([verifyRoute(request('verify', proof)), verifyRoute(request('verify', proof))]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const response = results.find(r => r.status === 200)!;
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).wallet).toMatchObject({ address: account.address, ownerUserId: input.userId, isDefault: true });
    expect(state.linkedMail).toHaveBeenCalledTimes(1); expect(await db.wallet.count()).toBe(1);
  });
});
