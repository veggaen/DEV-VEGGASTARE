/**
 * @fileOverview  Server-side proof that a P2P party really sent what they
 *                offered: every offered stack must be covered by successful
 *                transactions from their wallet to the partner's wallet. The
 *                pure matcher is separate from the RPC lookup so it can be
 *                unit-tested without a chain.
 * @stability     evolving
 */
import { createPublicClient, erc20Abi, http, parseEventLogs, type Hex } from 'viem';
import { rpcUrlFor } from '@/lib/evm-rpc';
import { NATIVE_ADDRESS } from '@/lib/send-stacks';

export type ExpectedItem = { tokenAddress: string; amount: string; symbol?: string };

export type TxFacts = {
  hash: string;
  status: 'success' | 'reverted';
  from: string;
  to: string | null;
  value: bigint;
  transfers: { token: string; from: string; to: string; value: bigint }[];
};

export type Verification = { ok: boolean; problems: string[] };

const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const isNative = (address: string) => same(address, NATIVE_ADDRESS) || address === '0x0';

/** Pure: do these transactions cover every item from `from` to `to`? */
export function verifyItemsAgainstTxs(items: ExpectedItem[], from: string, to: string, txs: TxFacts[]): Verification {
  const problems: string[] = [];
  const covered = new Map<string, bigint>();
  const add = (token: string, value: bigint) => covered.set(token, (covered.get(token) ?? BigInt(0)) + value);
  for (const tx of txs) {
    if (tx.status !== 'success') { problems.push(`Transaction ${tx.hash.slice(0, 10)}… reverted.`); continue; }
    if (same(tx.from, from) && same(tx.to, to) && tx.value > BigInt(0)) add('native', tx.value);
    for (const t of tx.transfers) if (same(t.from, from) && same(t.to, to)) add(t.token.toLowerCase(), t.value);
  }
  for (const item of items) {
    const key = isNative(item.tokenAddress) ? 'native' : item.tokenAddress.toLowerCase();
    const have = covered.get(key) ?? BigInt(0);
    let need: bigint;
    try { need = BigInt(item.amount); } catch { problems.push(`Bad amount for ${item.symbol ?? item.tokenAddress}.`); continue; }
    if (have < need) problems.push(`${item.symbol ?? item.tokenAddress.slice(0, 10)}: expected ${need.toString()} from ${from.slice(0, 6)}… to ${to.slice(0, 6)}…, found ${have.toString()}.`);
  }
  return { ok: problems.length === 0, problems };
}

/** Receipt + transaction → the facts the matcher needs. Null when the chain does not know the hash yet. */
export async function fetchTxFacts(chainId: number, hash: Hex): Promise<TxFacts | null> {
  const url = rpcUrlFor(chainId);
  if (!url) return null;
  const client = createPublicClient({ transport: http(url) });
  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash }); } catch { return null; }
  const tx = await client.getTransaction({ hash }).catch(() => null);
  const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs, strict: false })
    .map((log) => ({ token: log.address, from: String(log.args.from ?? ''), to: String(log.args.to ?? ''), value: BigInt(log.args.value ?? 0) }));
  return {
    hash,
    status: receipt.status === 'success' ? 'success' : 'reverted',
    from: receipt.from,
    to: receipt.to ?? null,
    value: tx?.value ?? BigInt(0),
    transfers,
  };
}

/** Verify a party's settlement: every hash must be known and the items covered. */
export async function verifyTransfersOnChain(args: {
  chainId: number;
  from: string;
  to: string;
  items: ExpectedItem[];
  hashes: string[];
  lookup?: (chainId: number, hash: Hex) => Promise<TxFacts | null>;
}): Promise<Verification> {
  const lookup = args.lookup ?? fetchTxFacts;
  const facts: TxFacts[] = [];
  const problems: string[] = [];
  for (const hash of args.hashes) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) { problems.push(`${hash.slice(0, 12)}… is not a transaction hash.`); continue; }
    const f = await lookup(args.chainId, hash as Hex);
    if (!f) problems.push(`Transaction ${hash.slice(0, 10)}… is not confirmed on-chain yet.`);
    else facts.push(f);
  }
  const matched = verifyItemsAgainstTxs(args.items, args.from, args.to, facts);
  return { ok: problems.length === 0 && matched.ok, problems: [...problems, ...matched.problems] };
}
