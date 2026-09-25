import 'server-only';
import { dbPrisma } from '@/lib/db';
import { aiCreditEnvironment, aiCreditLedger, AiCreditError } from '@/lib/ai-credit-ledger';
import { platformAiKey } from '@/lib/ai-chat/generation';
import { isDemoUserId } from '@/lib/demo-policy';
import { MEDIA_MODELS, IMAGE_JOB_LIMIT_MS, MEDIA_JOB_LIMIT_MS, MediaRequest, mediaPricingReviewed, type MediaKind } from './policy';
import { generateImage, startVideo, readVideo, MediaProviderError } from './provider';
import { storeGeneratedMedia } from './storage';
import type { AiMediaJob } from '@/generated/prisma/client';

const active = ['CREATING', 'PROCESSING'];
export function mediaConfigured(kind: MediaKind) {
  return process.env.AI_MEDIA_ENABLED !== '0' && mediaPricingReviewed() && Boolean(platformAiKey(MEDIA_MODELS[kind].provider)) &&
    Boolean(process.env.EDGE_STORE_ACCESS_KEY && process.env.EDGE_STORE_SECRET_KEY);
}
export function publicMediaJob(job: AiMediaJob) {
  return { id: job.id, kind: job.kind as MediaKind, prompt: job.prompt, state: job.state,
    credits: MEDIA_MODELS[job.kind as MediaKind].credits, createdAt: job.createdAt.toISOString(),
    errorCode: job.errorCode, contentUrl: job.state === 'COMPLETED' ? `/api/ai-media/${job.id}/content` : null };
}
async function finish(job: AiMediaJob, result?: { bytes: Uint8Array; actualMicroUsd: number }, errorCode = 'MEDIA_FAILED') {
  const quote = MEDIA_MODELS[job.kind as MediaKind];
  if (result && result.actualMicroUsd > quote.reserveMicroUsd) {
    await dbPrisma.aiMediaJob.update({ where: { id: job.id }, data: { actualMicroUsd: result.actualMicroUsd, errorCode: 'MEDIA_COST_REVIEW' } });
    return finish(job, undefined, 'MEDIA_COST_REVIEW');
  }
  // Storage must succeed before credits settle. Lost upload responses can leave
  // an orphan private file, never an uncharged public result or a second render.
  const storageKey = result ? await storeGeneratedMedia(job.userId, job.kind as MediaKind, result.bytes) : undefined;
  await aiCreditLedger.settle(job.reservationId, Boolean(result), async tx => {
    await tx.aiMediaJob.update({ where: { id: job.id }, data: result ? {
      state: 'COMPLETED', storageKey, mimeType: quote.mime, byteSize: result.bytes.length, actualMicroUsd: result.actualMicroUsd, errorCode: null,
    } : { state: 'FAILED', errorCode } });
  });
}
export async function prepareMedia(raw: unknown, userId: string) {
  const parsed = MediaRequest.safeParse(raw);
  if (!parsed.success) throw new AiCreditError('INVALID_REQUEST', 400);
  if (isDemoUserId(userId)) throw new AiCreditError('MEDIA_PERSONAL_ACCOUNT', 403);
  const input = parsed.data, environment = aiCreditEnvironment(userId);
  const existing = await dbPrisma.aiMediaJob.findUnique({ where: { id: input.requestId } });
  if (existing) {
    if (existing.userId !== userId || existing.environment !== environment) throw new AiCreditError('MEDIA_NOT_FOUND', 404);
    if (existing.kind !== input.kind || existing.prompt !== input.prompt) throw new AiCreditError('AI_REQUEST_ALREADY_USED', 409);
    return { job: existing, start: false };
  }
  if (!mediaConfigured(input.kind)) throw new AiCreditError('MEDIA_UNAVAILABLE', 503);
  if (await dbPrisma.aiMediaJob.findFirst({ where: { errorCode: 'MEDIA_COST_REVIEW' }, select: { id: true } })) throw new AiCreditError('MEDIA_UNAVAILABLE', 503);
  await reconcileMediaUser(userId);
  const quote = MEDIA_MODELS[input.kind];
  await aiCreditLedger.reserve({ userId, actorKey: userId, requestId: input.requestId, provider: quote.provider,
    model: quote.model, funding: 'PLATFORM', credits: quote.credits, reservedMicroUsd: quote.reserveMicroUsd,
  }, async (tx, reservationId) => {
    await tx.aiMediaJob.create({ data: { id: input.requestId, reservationId, userId, environment, kind: input.kind,
      model: quote.model, prompt: input.prompt, deadline: new Date(Date.now() + (input.kind === 'IMAGE' ? IMAGE_JOB_LIMIT_MS : MEDIA_JOB_LIMIT_MS)) } });
  });
  const job = await dbPrisma.aiMediaJob.findUniqueOrThrow({ where: { id: input.requestId } });
  return { job, start: true };
}
export async function runMediaJob(id: string) {
  // Compare-and-swap owns the only paid start, across replicas and retries.
  const claim = await dbPrisma.aiMediaJob.updateMany({ where: { id, state: 'CREATING' }, data: { state: 'PROCESSING', pollAfter: new Date(Date.now() + 120_000) } });
  if (!claim.count) return;
  const job = await dbPrisma.aiMediaJob.findUniqueOrThrow({ where: { id } });
  try {
    if (job.kind === 'IMAGE') await finish(job, await generateImage(job.prompt));
    else {
      const providerId = await startVideo(job.prompt);
      await dbPrisma.aiMediaJob.update({ where: { id }, data: { providerId, pollAfter: new Date(Date.now() + 10_000) } });
    }
  } catch (error) {
    const code = error instanceof MediaProviderError ? error.code : error instanceof Error && error.message === 'MEDIA_COST_REVIEW' ? error.message : 'MEDIA_FAILED';
    await finish(job, undefined, code);
  }
}
export async function reconcileMediaJob(job: AiMediaJob) {
  if (!active.includes(job.state)) return;
  if (job.deadline.getTime() < Date.now()) { await finish(job, undefined, 'MEDIA_TIMED_OUT'); return; }
  if (job.kind !== 'VIDEO' || !job.providerId) return;
  // Poll lock lasts longer than the bounded read/download/upload. Recoverable
  // after a worker crash. No provider POST is ever retried here.
  const claim = await dbPrisma.aiMediaJob.updateMany({ where: { id: job.id, state: 'PROCESSING', pollAfter: { lte: new Date() } },
    data: { pollAfter: new Date(Date.now() + 120_000) } });
  if (!claim.count) return;
  try {
    const result = await readVideo(job.providerId);
    if (result.status === 'done' && result.bytes) await finish(job, { bytes: result.bytes, actualMicroUsd: result.actualMicroUsd! });
    else if (result.status === 'expired' || result.status === 'failed') await finish(job, undefined, 'MEDIA_PROVIDER_FAILED');
  } catch {
    // Transient poll/storage errors keep the reservation until a later poll or
    // the deadline. The customer's credits cannot become stuck indefinitely.
  } finally {
    await dbPrisma.aiMediaJob.updateMany({ where: { id: job.id, state: 'PROCESSING' }, data: { pollAfter: new Date(Date.now() + 15_000) } });
  }
}
export async function reconcileMediaUser(userId: string) {
  const jobs = await dbPrisma.aiMediaJob.findMany({ where: { userId, environment: aiCreditEnvironment(userId), state: { in: active } }, take: 2 });
  await Promise.all(jobs.map(reconcileMediaJob));
}
export async function readMediaWorkspace(userId: string) {
  await reconcileMediaUser(userId);
  const [jobs, balance, review] = await Promise.all([
    dbPrisma.aiMediaJob.findMany({ where: { userId, environment: aiCreditEnvironment(userId) }, orderBy: { createdAt: 'desc' }, take: 24 }),
    aiCreditLedger.balance(userId), dbPrisma.aiMediaJob.findFirst({ where: { errorCode: 'MEDIA_COST_REVIEW' }, select: { id: true } }),
  ]);
  return { jobs: jobs.map(publicMediaJob), balance, isDemo: isDemoUserId(userId), options: Object.values(MEDIA_MODELS).map(({ kind, label, credits, detail }) =>
    ({ kind, label, credits, detail, available: mediaConfigured(kind) && !review })) };
}
export async function mediaMaintenance() {
  const jobs = await dbPrisma.aiMediaJob.findMany({ where: { state: { in: active }, pollAfter: { lte: new Date() } }, orderBy: { createdAt: 'asc' }, take: 4 });
  await Promise.all(jobs.map(reconcileMediaJob));
  return { checked: jobs.length };
}
