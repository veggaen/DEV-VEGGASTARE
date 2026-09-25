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
import { mutateWallet } from '@/lib/wallet-mutation';
import { PATCH as patchRoute, DELETE as deleteRoute } from '@/app/api/wallets/evm/[walletId]/route';
import { POST as createRoute } from '@/app/api/wallets/route';

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
        "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3));
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "receiverWalletId" TEXT REFERENCES "Wallet"("id") ON DELETE SET NULL);
      CREATE TABLE "ProductAcceptedToken" ("id" TEXT PRIMARY KEY, "receiverWalletId" TEXT REFERENCES "Wallet"("id") ON DELETE SET NULL);
      CREATE TABLE "Company" ("id" TEXT PRIMARY KEY, "ownerId" TEXT, "defaultReceivingWalletId" TEXT REFERENCES "Wallet"("id") ON DELETE SET NULL);
      CREATE TABLE "Donation" ("id" TEXT PRIMARY KEY, "walletId" TEXT REFERENCES "Wallet"("id") ON DELETE CASCADE);`);
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
    await admin.query(`TRUNCATE "Product","ProductAcceptedToken","Company","Donation","WalletVerificationChallenge","Wallet","TwoFactorToken","User";
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
  const seedWallets = async () => {
    await db.wallet.createMany({ data: ['qa-first', 'qa-second'].map((id, index) => ({ id, label: id, address: `0x${String(index + 1).repeat(40)}`, family: 'EVM', ownerUserId: input.userId, verifiedAt: new Date(), isDefault: index === 0 })) });
    await admin.query(`UPDATE "User" SET "defaultReceivingWalletId"='qa-first' WHERE "id"='qa-owner'`);
  };
  const change = (action: 'setPrimary' | 'unlink', overrides = {}) => mutateWallet({ userId: input.userId, origin: input.origin, walletId: 'qa-second', action, ...overrides });
  const destination = () => db.user.findUnique({ where: { id: input.userId }, select: { defaultReceivingWalletId: true } });
  it('renames without changing the receiving wallet or requiring a code', async () => {
    await seedWallets(); await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    await mutateWallet({ userId: input.userId, origin: input.origin, walletId: 'qa-second', action: 'rename', label: 'Savings' });
    expect((await db.wallet.findUnique({ where: { id: 'qa-second' } }))?.label).toBe('Savings');
    expect((await destination())?.defaultReceivingWalletId).toBe('qa-first'); expect(await db.twoFactorToken.count()).toBe(0);
  });
  it('serializes competing receiving choices and keeps the actual destination consistent', async () => {
    await seedWallets();
    await Promise.all([change('setPrimary'), change('setPrimary', { walletId: 'qa-first' }), change('setPrimary')]);
    const defaults = await db.wallet.findMany({ where: { isDefault: true } });
    expect(defaults).toHaveLength(1); expect((await destination())?.defaultReceivingWalletId).toBe(defaults[0].id);
  });
  it.each(['owner', 'company', 'family', 'unverified', 'disabled'])('rejects %s before issuing a code or changing the destination', async fault => {
    await seedWallets(); await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    if (fault === 'owner') await db.wallet.update({ where: { id: 'qa-second' }, data: { ownerUserId: 'qa-other' } });
    if (fault === 'company') await db.wallet.update({ where: { id: 'qa-second' }, data: { ownerCompanyId: 'qa-company' } });
    if (fault === 'family') await db.wallet.update({ where: { id: 'qa-second' }, data: { family: 'SOLANA' } });
    if (fault === 'unverified') await db.wallet.update({ where: { id: 'qa-second' }, data: { verifiedAt: null } });
    if (fault === 'disabled') await admin.query(`UPDATE "User" SET "web3ModeEnabled"=FALSE WHERE "id"='qa-owner'`);
    await expect(change('setPrimary')).rejects.toThrow(); expect(await db.twoFactorToken.count()).toBe(0);
    expect((await destination())?.defaultReceivingWalletId).toBe('qa-first');
  });
  it('binds an exact, one-use action code to the host, target wallet and action', async () => {
    await seedWallets(); await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    const gate = await change('setPrimary'); expect(gate.twoFactor).toBe(true);
    for (const overrides of [{ code: `${gate.code}0` }, { code: gate.code, origin: 'https://www.veggat.com' }, { code: gate.code, walletId: 'qa-first' }]) {
      await expect(change('setPrimary', overrides)).rejects.toThrow('Incorrect code');
    }
    await expect(change('unlink', { code: gate.code })).rejects.toThrow('Incorrect code');
    const results = await Promise.allSettled([change('setPrimary', { code: gate.code }), change('setPrimary', { code: gate.code })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await db.twoFactorToken.count()).toBe(0);
    expect((await destination())?.defaultReceivingWalletId).toBe('qa-second');
  });
  it('does not accept login/link codes or expired action codes', async () => {
    await seedWallets(); await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    await db.twoFactorToken.create({ data: { email: 'qa@example.test', token: '123456', expires: new Date(Date.now() + 300_000) } });
    await expect(change('setPrimary', { code: '123456' })).rejects.toThrow('Incorrect code');
    const linked = await createWalletLinkChallenge(input);
    await expect(change('setPrimary', { code: linked.code })).rejects.toThrow('Incorrect code');
    const gate = await change('setPrimary');
    await db.twoFactorToken.updateMany({ where: { email: { startsWith: 'wallet-change:' } }, data: { expires: new Date(0) } });
    await expect(change('setPrimary', { code: gate.code })).rejects.toThrow('expired');
    expect((await destination())?.defaultReceivingWalletId).toBe('qa-first');
  });
  it('rolls back code consumption and wallet flags if the destination write fails', async () => {
    await seedWallets(); await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    const gate = await change('setPrimary');
    await admin.query(`ALTER TABLE "User" ADD CONSTRAINT qa_reject_destination CHECK ("defaultReceivingWalletId" IS DISTINCT FROM 'qa-second')`);
    try { await expect(change('setPrimary', { code: gate.code })).rejects.toThrow(); }
    finally { await admin.query(`ALTER TABLE "User" DROP CONSTRAINT qa_reject_destination`); }
    expect((await destination())?.defaultReceivingWalletId).toBe('qa-first');
    expect((await db.wallet.findFirst({ where: { isDefault: true } }))?.id).toBe('qa-first');
    expect(await db.twoFactorToken.count()).toBe(1);
    await change('setPrimary', { code: gate.code }); expect((await destination())?.defaultReceivingWalletId).toBe('qa-second');
  });
  it('removes a primary wallet without silently selecting a replacement', async () => {
    await seedWallets(); await change('unlink', { walletId: 'qa-first' });
    expect((await destination())?.defaultReceivingWalletId).toBeNull(); expect(await db.wallet.count()).toBe(1);
    expect(await db.wallet.count({ where: { isDefault: true } })).toBe(0);
  });
  it('removing a non-primary wallet preserves the explicit destination', async () => {
    await seedWallets(); await change('unlink');
    expect((await destination())?.defaultReceivingWalletId).toBe('qa-first');
  });
  it.each(['Product', 'ProductAcceptedToken', 'Company', 'Donation', 'User'])('preserves %s references and sends no action code for prohibited removal', async kind => {
    await seedWallets(); await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    if (kind === 'User') await admin.query(`UPDATE "User" SET "defaultReceivingWalletId"='qa-second' WHERE "id"='qa-other'`);
    else {
      const column = kind === 'Company' ? 'defaultReceivingWalletId' : kind === 'Donation' ? 'walletId' : 'receiverWalletId';
      await admin.query(`INSERT INTO "${kind}" ("id","${column}") VALUES ('qa-reference','qa-second')`);
    }
    await expect(change('unlink')).rejects.toThrow(kind === 'Donation' ? 'donation records' : 'product or business');
    expect(await db.wallet.count()).toBe(2); expect(await db.twoFactorToken.count()).toBe(0);
  });
  it('route removal consumes the code once and sends one mocked notification across concurrent replay', async () => {
    await seedWallets(); await admin.query(`UPDATE "User" SET "isTwoFactorEnabled"=TRUE WHERE "id"='qa-owner'`);
    const request = (method: string, data: unknown) => new NextRequest(`${input.origin}/api/wallets/evm/qa-second`, { method, headers: { origin: input.origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const ctx = { params: Promise.resolve({ walletId: 'qa-second' }) };
    expect(await (await deleteRoute(request('DELETE', {}), ctx)).json()).toEqual({ twoFactor: true });
    expect(state.codeMail).toHaveBeenCalledTimes(1); const code = state.codeMail.mock.calls[0][1];
    expect((await patchRoute(request('PATCH', { action: 'setPrimary', code }), ctx)).status).toBe(400);
    const results = await Promise.all([deleteRoute(request('DELETE', { code }), ctx), deleteRoute(request('DELETE', { code }), ctx)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 404]); expect(state.linkedMail).toHaveBeenCalledTimes(1);
    expect(await db.wallet.count()).toBe(1); expect(await db.twoFactorToken.count()).toBe(0);
  });
  it('manual creation cannot grant proof/defaults or clear another account’s wallet flags', async () => {
    await seedWallets();
    await db.wallet.create({ data: { id: 'qa-other-wallet', label: 'Other owner', family: 'EVM', address: '0x' + '4'.repeat(40), ownerUserId: 'qa-other', isDefault: true, verifiedAt: new Date() } });
    const request = (override = {}) => new NextRequest(`${input.origin}/api/wallets`, { method: 'POST', headers: { origin: input.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Manual', family: 'EVM', address: '0x' + '5'.repeat(40), chainId: 1, ...override }) });
    expect((await createRoute(request({ isDefault: true }))).status).toBe(400);
    const created = await createRoute(request()); expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ isDefault: false, verifiedAt: null, ownerUserId: input.userId });
    expect((await destination())?.defaultReceivingWalletId).toBe('qa-first');
    expect((await db.wallet.findUnique({ where: { id: 'qa-other-wallet' } }))?.isDefault).toBe(true);
    expect(await db.wallet.count({ where: { isDefault: true } })).toBe(2);
  });
  it('manual company wallets require current ownership and never become defaults', async () => {
    await admin.query(`INSERT INTO "Company" ("id","ownerId") VALUES ('qa-company','qa-other')`);
    const request = () => new NextRequest(`${input.origin}/api/wallets`, { method: 'POST', headers: { origin: input.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Company', family: 'EVM', address: '0x' + '5'.repeat(40), chainId: 1, ownerCompanyId: 'qa-company' }) });
    expect((await createRoute(request())).status).toBe(403); expect(await db.wallet.count()).toBe(0);
    await admin.query(`UPDATE "Company" SET "ownerId"='qa-owner' WHERE "id"='qa-company'`);
    const created = await createRoute(request()); expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ ownerUserId: null, ownerCompanyId: 'qa-company', isDefault: false, verifiedAt: null });
  });
});
