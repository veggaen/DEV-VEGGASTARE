/** @fileOverview Serialize verified EVM identities across sign-in and linking. @stability stable */
import type { Prisma } from '@/generated/prisma/client';
export async function lockWalletIdentity(tx: Prisma.TransactionClient, address: string) {
  // Address before User lock; manual/company addresses are not login identities.
  const key = `wallet-identity:${address.toLowerCase()}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}
