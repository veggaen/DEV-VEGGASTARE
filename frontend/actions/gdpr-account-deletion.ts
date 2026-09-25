'use server';

/** Account-owned erasure requests. Execution requires a separate retention review;
 * never expose a cascading user delete as a public Server Action. */
import { headers } from 'next/headers';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isDemoUserId } from '@/lib/demo-policy';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';

export interface AccountDeletionResult { success: boolean; error?: string; scheduledFor?: string; requestId?: string }
class DeletionRequestError extends Error {}

async function requestActor() {
  const user = await MyLibUserAuth();
  if (!user?.id || user.isImpersonating || isDemoUserId(user.id)) throw new DeletionRequestError('Logg inn på din egen konto for å sende en forespørsel.');
  const h = await headers(), value = h.get('origin');
  let origin: URL;
  try { origin = new URL(value ?? ''); } catch { throw new DeletionRequestError('Åpne innstillingene på dette nettstedet og prøv igjen.'); }
  if (origin.origin !== value || !['https:', 'http:'].includes(origin.protocol) || origin.host !== (h.get('x-forwarded-host') ?? h.get('host'))) throw new DeletionRequestError('Åpne innstillingene på dette nettstedet og prøv igjen.');
  if (!await allowAuthAttempt('account-deletion-request', user.id)) throw new DeletionRequestError('For mange forsøk. Prøv igjen om noen minutter.');
  return user.id;
}

export async function requestAccountDeletion(reason?: string): Promise<AccountDeletionResult> {
  try {
    const userId = await requestActor();
    const parsed = z.string().trim().max(1000).optional().safeParse(reason);
    if (!parsed.success) return { success: false, error: 'Begrunnelsen må være tekst på høyst 1000 tegn.' };
    return await dbPrisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new DeletionRequestError('Logg inn igjen.');
      const existing = await tx.accountDeletionRequest.findFirst({ where: { userId, status: { in: ['PENDING', 'PROCESSING'] }, cancelledAt: null }, select: { id: true } });
      if (existing) return { success: false, error: 'Du har allerede en åpen slettingsforespørsel.' };
      const scheduledFor = new Date(Date.now() + 30 * 86_400_000);
      const request = await tx.accountDeletionRequest.create({ data: { userId, reason: parsed.data || null, scheduledFor, status: 'PENDING' }, select: { id: true } });
      return { success: true, scheduledFor: scheduledFor.toISOString(), requestId: request.id };
    });
  } catch (error) {
    return { success: false, error: error instanceof DeletionRequestError ? error.message : 'Forespørselen kunne ikke bekreftes. Oppdater siden før du prøver igjen.' };
  }
}

export async function cancelAccountDeletion(): Promise<AccountDeletionResult> {
  try {
    const userId = await requestActor();
    return await dbPrisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const changed = await tx.accountDeletionRequest.updateMany({ where: { userId, status: 'PENDING', cancelledAt: null }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      return changed.count > 0 ? { success: true } : { success: false, error: 'Ingen ventende forespørsel å avbryte. Kontakt oss hvis den allerede behandles.' };
    });
  } catch (error) {
    return { success: false, error: error instanceof DeletionRequestError ? error.message : 'Avbrytelsen kunne ikke bekreftes. Oppdater siden før du prøver igjen.' };
  }
}
