/**
 * @fileOverview  Moving stacks between wallets: the shapes shared by the Send
 *                dialog, the internal transfer and P2P settlement, plus the
 *                pure helpers (amount parsing, error wording). The wallet
 *                interaction itself lives in hooks/use-send-stacks.ts.
 * @stability     evolving
 */
import { parseUnits } from 'viem';

export const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export type SendToken = {
  address: string;
  symbol: string;
  decimals: number;
  isNative: boolean;
  chainId: number;
  logo?: string;
  usdPrice?: number;
};

export type SendItem = { token: SendToken; rawAmount: bigint | string };

export type SendStepStatus = 'queued' | 'wallet' | 'pending' | 'confirmed' | 'failed';

export type SendStep = {
  key: string;
  symbol: string;
  amount: string;
  status: SendStepStatus;
  hash?: `0x${string}`;
  explorerUrl?: string;
  error?: string;
};

export const sameAddress = (a?: string | null, b?: string | null): boolean =>
  Boolean(a && b && a.toLowerCase() === b.toLowerCase());

export const shortAddress = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
export const looksLikeAddress = (a: string): boolean => ADDRESS_RE.test(a.trim());

/** Raw units → a readable amount: thousands separators, at most 6 decimals, never exponent form. */
export function formatTokenAmount(raw: bigint | string, decimals: number): string {
  let value: bigint;
  try { value = BigInt(raw); } catch { return '0'; }
  const negative = value < BigInt(0);
  const abs = negative ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;
  let fractionText = fraction.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
  if (whole === BigInt(0) && fraction > BigInt(0) && !fractionText) fractionText = '000001';
  const wholeText = whole.toLocaleString('en-US');
  return `${negative ? '-' : ''}${wholeText}${fractionText ? `.${fractionText}` : ''}`;
}

/** User-typed amount → raw units. Null when empty, invalid, zero, or over `max`. */
export function parseSendAmount(input: string, decimals: number, max: bigint): bigint | null {
  const text = input.trim().replace(',', '.');
  if (!text || !/^\d*\.?\d*$/.test(text)) return null;
  let raw: bigint;
  try { raw = parseUnits(text, decimals); } catch { return null; }
  if (raw <= BigInt(0) || raw > max) return null;
  return raw;
}

const codeOf = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'number') return direct;
  const cause = (error as { cause?: { code?: unknown } }).cause;
  return typeof cause?.code === 'number' ? cause.code : undefined;
};

/** One sentence a person can act on, from whatever the wallet or RPC threw. */
export function describeSendError(error: unknown): string {
  const code = codeOf(error);
  const message = error instanceof Error ? error.message : String(error ?? '');
  const short = (error as { shortMessage?: string } | null)?.shortMessage;
  if (code === 4001 || /user rejected|user denied|rejected the request|cancelled/i.test(message)) return 'You cancelled the request in your wallet. Nothing was sent.';
  if (code === -32002) return 'A request is already open in your wallet. Finish or cancel it there first.';
  if (/insufficient funds/i.test(message)) return 'Not enough native coin in the sending wallet to pay for gas.';
  if (/exceeds balance|transfer amount exceeds/i.test(message)) return 'The wallet no longer holds that much of this token.';
  if (/chain mismatch|does not match the target chain|unrecognized chain/i.test(message)) return 'Switch your wallet to this network and try again.';
  if (/timed out|timeout/i.test(message)) return 'Still waiting for the network to confirm. Check the explorer link before sending again.';
  if (/execution reverted/i.test(message)) return 'The token contract refused the transfer. Some tokens block sales or transfers.';
  return short || message.slice(0, 160) || 'The transfer did not go through.';
}
