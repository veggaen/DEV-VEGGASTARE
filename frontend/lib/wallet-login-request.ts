/** @fileOverview Same-origin and HttpOnly browser binding for public wallet login. @stability stable */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { WalletLinkError } from '@/lib/wallet-link';
export const walletLoginProofSchema = z.object({
  challengeId: z.string().min(1).max(128), signature: z.string().regex(/^0x[\da-f]{128}(?:[\da-f]{2})?$/i),
}).strict();
export const walletLoginCookieName = (origin: string) => origin.startsWith('https:') ? '__Host-veggat.wallet-login' : 'veggat.wallet-login';
export function walletLoginContext(request: Request, requireBrowser = true) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) throw new WalletLinkError('Open sign-in on this site and try again.', 403);
  const name = walletLoginCookieName(origin);
  const cookies = (request.headers.get('cookie') || '').split(';').map(c => c.trim()).filter(c => c.startsWith(`${name}=`));
  const browser = cookies.length === 1 ? cookies[0].slice(name.length + 1) : '';
  if (requireBrowser && !/^[a-f0-9]{64}$/.test(browser)) throw new WalletLinkError('Start wallet sign-in again in this browser.', 401);
  return { origin, browser: /^[a-f0-9]{64}$/.test(browser) ? browser : '' };
}
export function walletLoginResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function walletLoginFailure(error: unknown) {
  // Provider payloads, signatures, email addresses and codes never enter logs/responses.
  return walletLoginResponse({ error: 'Wallet sign-in could not be completed. Start again or use another sign-in method.' }, error instanceof WalletLinkError ? error.status : 503);
}
