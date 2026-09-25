import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const m = vi.hoisted(() => ({ find: vi.fn(), unique: vi.fn(), list: vi.fn(), update: vi.fn(), claim: vi.fn(), create: vi.fn(),
  reserve: vi.fn(), settle: vi.fn(), balance: vi.fn(), image: vi.fn(), start: vi.fn(), read: vi.fn(), store: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: { aiMediaJob: { findUnique: m.find, findUniqueOrThrow: m.unique,
  findFirst: m.find, findMany: m.list, update: m.update, updateMany: m.claim, create: m.create } } }));
vi.mock('@/lib/ai-credit-ledger', () => ({ aiCreditEnvironment: () => 'SANDBOX',
  AiCreditError: class extends Error { constructor(public code: string, public status: number) { super(code); } },
  aiCreditLedger: { reserve: m.reserve, settle: m.settle, balance: m.balance } }));
vi.mock('@/lib/ai-chat/generation', () => ({ platformAiKey: () => 'fixture' }));
vi.mock('./provider', () => ({ generateImage: m.image, startVideo: m.start, readVideo: m.read,
  MediaProviderError: class extends Error { constructor(public code: string) { super(code); } } }));
vi.mock('./storage', () => ({ storeGeneratedMedia: m.store }));
import { prepareMedia, publicMediaJob, reconcileMediaJob, runMediaJob } from './service';
import type { AiMediaJob } from '@/generated/prisma/client';
const fixture = (): AiMediaJob => ({ id: randomUUID(), reservationId: randomUUID(), userId: 'fixture-user', environment: 'SANDBOX',
  kind: 'IMAGE', model: 'gpt-image-2.5-flare-2026-09-08', prompt: 'A quiet lake', state: 'PROCESSING', providerId: null,
  storageKey: null, mimeType: null, byteSize: null, actualMicroUsd: null, errorCode: null, pollAfter: new Date(),
  deadline: new Date(Date.now()+300000), createdAt: new Date(), updatedAt: new Date() });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('EDGE_STORE_ACCESS_KEY','fixture'); vi.stubEnv('EDGE_STORE_SECRET_KEY','fixture'); vi.stubEnv('AI_MEDIA_ENABLED','1');
  m.list.mockResolvedValue([]); m.find.mockResolvedValue(null); m.claim.mockResolvedValue({ count: 1 });
  m.store.mockResolvedValue('https://files.edgestore.dev/private.png');
  m.settle.mockImplementation(async (_id, _ok, callback) => { await callback({ aiMediaJob: { update: m.update } }); return true; });
});
afterEach(() => vi.unstubAllEnvs());
describe('media lifecycle', () => {
  it('refuses demo generation before any debit/provider call', async () => {
    await expect(prepareMedia({ requestId: randomUUID(), kind: 'IMAGE', prompt: 'A quiet lake' }, 'demo_fixture')).rejects.toMatchObject({ code: 'MEDIA_PERSONAL_ACCOUNT' });
    expect(m.reserve).not.toHaveBeenCalled(); expect(m.image).not.toHaveBeenCalled();
  });
  it('requires a funded reservation before scheduling paid work', async () => {
    m.reserve.mockRejectedValue(new Error('AI_CREDITS_REQUIRED'));
    await expect(prepareMedia({ requestId: randomUUID(), kind: 'IMAGE', prompt: 'A quiet lake' }, 'fixture-user')).rejects.toThrow('AI_CREDITS_REQUIRED');
    expect(m.image).not.toHaveBeenCalled(); expect(m.start).not.toHaveBeenCalled();
  });
  it('returns the same owned job on replay without another reservation', async () => {
    const job=fixture(); m.find.mockResolvedValue(job);
    expect((await prepareMedia({ requestId: job.id, kind: 'IMAGE', prompt: job.prompt }, job.userId)).start).toBe(false);
    expect(m.reserve).not.toHaveBeenCalled();
    await expect(prepareMedia({ requestId: job.id, kind: 'IMAGE', prompt: job.prompt }, 'other-user')).rejects.toMatchObject({ code: 'MEDIA_NOT_FOUND' });
  });
  it('does not start a paid request if another worker claimed it', async () => {
    m.claim.mockResolvedValue({ count: 0 }); await runMediaJob(randomUUID()); expect(m.image).not.toHaveBeenCalled();
  });
  it('stores privately before settling a successful generation', async () => {
    const job=fixture(); m.unique.mockResolvedValue(job); m.image.mockResolvedValue({ bytes: new Uint8Array([1,2]), actualMicroUsd: 6000 });
    await runMediaJob(job.id);
    expect(m.store).toHaveBeenCalledWith(job.userId,'IMAGE',expect.any(Uint8Array));
    expect(m.settle).toHaveBeenCalledWith(job.reservationId,true,expect.any(Function));
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state:'COMPLETED' }) }));
  });
  it('refunds a failed provider/storage call without publishing a file', async () => {
    const job=fixture(); m.unique.mockResolvedValue(job); m.image.mockRejectedValue(new Error('do not expose this'));
    await runMediaJob(job.id); expect(m.settle).toHaveBeenCalledWith(job.reservationId,false,expect.any(Function));
    expect(m.store).not.toHaveBeenCalled();
  });
  it('trips the persistent pricing-review gate for unexpected cost', async () => {
    const job=fixture(); m.unique.mockResolvedValue(job); m.image.mockResolvedValue({ bytes: new Uint8Array([1]), actualMicroUsd: 999999 });
    await runMediaJob(job.id); expect(m.store).not.toHaveBeenCalled();
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ errorCode:'MEDIA_COST_REVIEW' }) }));
    expect(m.settle).toHaveBeenCalledWith(job.reservationId,false,expect.any(Function));
  });
  it('returns expired media credits and never retries its paid start', async () => {
    const job={ ...fixture(), kind:'VIDEO', providerId:'fixture-provider-id',deadline:new Date(0) };
    await reconcileMediaJob(job); expect(m.settle).toHaveBeenCalledWith(job.reservationId,false,expect.any(Function));
    expect(m.start).not.toHaveBeenCalled(); expect(m.read).not.toHaveBeenCalled();
  });
  it('keeps transient poll failures recoverable until the deadline', async () => {
    const job={ ...fixture(), kind:'VIDEO',providerId:'fixture-provider-id' }; m.read.mockRejectedValue(new Error('temporary network'));
    await reconcileMediaJob(job); expect(m.settle).not.toHaveBeenCalled(); expect(m.start).not.toHaveBeenCalled();
  });
  it('refunds a provider-declared failed video', async () => {
    const job={ ...fixture(), kind:'VIDEO',providerId:'fixture-provider-id' }; m.read.mockResolvedValue({ status:'failed' });
    await reconcileMediaJob(job); expect(m.settle).toHaveBeenCalledWith(job.reservationId,false,expect.any(Function));
  });
  it('never exposes upstream IDs, storage URLs or user IDs in the response', () => {
    const result=publicMediaJob({ ...fixture(),state:'COMPLETED',providerId:'private-provider',storageKey:'https://secret.example/file' });
    expect(result).not.toHaveProperty('storageKey'); expect(result).not.toHaveProperty('providerId'); expect(result).not.toHaveProperty('userId');
    expect(result.contentUrl).toMatch(/^\/api\/ai-media\//);
  });
});
