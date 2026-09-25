/** @fileOverview Same-host origin scope for wallet Server Actions; Next's CSRF checks stay enabled. @stability stable */
import { headers } from 'next/headers';
import { WalletLinkError } from '@/lib/wallet-link';
export async function walletActionOrigin() {
  const requestHeaders = await headers();
  const value = requestHeaders.get('origin');
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  let origin: URL;
  try { origin = new URL(value ?? ''); } catch { throw new WalletLinkError('Open payment settings on this site and try again.', 403); }
  if (origin.origin !== value || origin.host !== host || !['http:', 'https:'].includes(origin.protocol)) {
    throw new WalletLinkError('Open payment settings on this site and try again.', 403);
  }
  return origin.origin;
}
