/**
 * @fileOverview  A wallet's on-chain history the way an explorer shows it:
 *                every transaction the address sent or received, with the
 *                token transfers folded into the transaction they belong to.
 *                Pure merging of Blockscout payloads; the route fetches.
 * @stability     evolving
 */

export type ChainEventKind = 'send' | 'receive' | 'self' | 'contract' | 'swap';

export type ChainTokenMove = {
  address: string;
  symbol: string;
  decimals: number;
  value: string;
  direction: 'in' | 'out';
  logo?: string | null;
  isScam?: boolean;
  counterparty: string | null;
};

export type ChainEvent = {
  id: string;
  hash: string;
  chainId: number;
  wallet: string;
  timestamp: number;
  block: number;
  kind: ChainEventKind;
  status: 'ok' | 'error' | 'pending';
  method: string | null;
  counterparty: string | null;
  counterpartyName: string | null;
  counterpartyIsContract: boolean;
  /** Native coin moved by this transaction, in wei, from the wallet's point of view. */
  nativeIn: string;
  nativeOut: string;
  feeWei: string | null;
  tokens: ChainTokenMove[];
};

type BsAddress = { hash?: string; name?: string | null; is_contract?: boolean; is_scam?: boolean; ens_domain_name?: string | null } | null;
export type BsTransaction = {
  hash: string;
  from?: BsAddress;
  to?: BsAddress;
  value?: string;
  method?: string | null;
  timestamp?: string;
  status?: string | null;
  result?: string | null;
  fee?: { value?: string } | string | null;
  block_number?: number;
};
export type BsTokenTransfer = {
  transaction_hash?: string;
  tx_hash?: string;
  from?: BsAddress;
  to?: BsAddress;
  timestamp?: string;
  method?: string | null;
  block_number?: number;
  token?: { address_hash?: string; address?: string; symbol?: string | null; decimals?: string | number | null; icon_url?: string | null; is_scam?: boolean } | null;
  total?: { value?: string; decimals?: string | number | null } | null;
};

const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const ts = (iso?: string) => { const n = iso ? Date.parse(iso) : NaN; return Number.isFinite(n) ? n : 0; };
const feeOf = (fee: BsTransaction['fee']): string | null => {
  if (!fee) return null;
  if (typeof fee === 'string') return fee;
  return fee.value ?? null;
};

/** Fold transactions and token transfers for `wallet` into one list, newest first. */
export function mergeChainHistory(chainId: number, wallet: string, txs: BsTransaction[], transfers: BsTokenTransfer[], limit = 100): ChainEvent[] {
  const byHash = new Map<string, ChainEvent>();

  for (const tx of txs) {
    if (!tx.hash) continue;
    const from = tx.from?.hash ?? '';
    const to = tx.to?.hash ?? null;
    const outgoing = same(from, wallet);
    const value = tx.value ?? '0';
    const counterparty = outgoing ? to : from || null;
    const counterpartyAddr = outgoing ? tx.to : tx.from;
    byHash.set(tx.hash.toLowerCase(), {
      id: `${chainId}:${tx.hash}`,
      hash: tx.hash,
      chainId,
      wallet,
      timestamp: ts(tx.timestamp),
      block: tx.block_number ?? 0,
      kind: 'contract',
      status: tx.status === 'ok' || tx.result === 'success' ? 'ok' : tx.status === 'error' || (tx.result && tx.result !== 'success' && tx.result !== 'pending') ? 'error' : tx.status ? 'pending' : 'ok',
      method: tx.method ?? null,
      counterparty,
      counterpartyName: counterpartyAddr?.ens_domain_name ?? counterpartyAddr?.name ?? null,
      counterpartyIsContract: Boolean(counterpartyAddr?.is_contract),
      nativeIn: !outgoing && same(to, wallet) && value !== '0' ? value : '0',
      nativeOut: outgoing && value !== '0' ? value : '0',
      feeWei: outgoing ? feeOf(tx.fee) : null,
      tokens: [],
    });
  }

  for (const t of transfers) {
    const hash = (t.transaction_hash ?? t.tx_hash ?? '').toLowerCase();
    if (!hash) continue;
    const from = t.from?.hash ?? '';
    const to = t.to?.hash ?? '';
    const outgoing = same(from, wallet);
    const incoming = same(to, wallet);
    if (!outgoing && !incoming) continue;
    const move: ChainTokenMove = {
      address: t.token?.address_hash ?? t.token?.address ?? '',
      symbol: t.token?.symbol || '???',
      decimals: Number(t.total?.decimals ?? t.token?.decimals ?? 18) || 18,
      value: t.total?.value ?? '0',
      direction: outgoing ? 'out' : 'in',
      logo: t.token?.icon_url ?? null,
      isScam: Boolean(t.token?.is_scam),
      counterparty: outgoing ? to || null : from || null,
    };
    const existing = byHash.get(hash);
    if (existing) { existing.tokens.push(move); continue; }
    const cp = outgoing ? t.to : t.from;
    byHash.set(hash, {
      id: `${chainId}:${t.transaction_hash ?? t.tx_hash}`,
      hash: t.transaction_hash ?? t.tx_hash ?? '',
      chainId,
      wallet,
      timestamp: ts(t.timestamp),
      block: t.block_number ?? 0,
      kind: 'contract',
      status: 'ok',
      method: t.method && !/^0x/.test(t.method) ? t.method : null,
      counterparty: move.counterparty,
      counterpartyName: cp?.ens_domain_name ?? cp?.name ?? null,
      counterpartyIsContract: Boolean(cp?.is_contract),
      nativeIn: '0',
      nativeOut: '0',
      feeWei: null,
      tokens: [move],
    });
  }

  const events = Array.from(byHash.values());
  for (const e of events) e.kind = classify(e, wallet);
  events.sort((a, b) => b.timestamp - a.timestamp || b.block - a.block);
  return events.slice(0, limit);
}

/** What happened, from the wallet's point of view. */
export function classify(e: Pick<ChainEvent, 'nativeIn' | 'nativeOut' | 'tokens' | 'counterparty' | 'counterpartyIsContract' | 'method'>, wallet: string): ChainEventKind {
  const ins = e.tokens.filter((t) => t.direction === 'in').length + (e.nativeIn !== '0' ? 1 : 0);
  const outs = e.tokens.filter((t) => t.direction === 'out').length + (e.nativeOut !== '0' ? 1 : 0);
  if (same(e.counterparty, wallet)) return 'self';
  if (ins && outs) return 'swap';
  if (outs) return 'send';
  if (ins) return 'receive';
  return 'contract';
}

/** Human title for a row, e.g. "Sent 1 ETH", "Received 39.4M ZC", "Swap", "setContenthash". */
export function describeEvent(e: ChainEvent, nativeSymbol: string, fmt: (raw: string, decimals: number) => string): string {
  const parts: string[] = [];
  if (e.nativeOut !== '0') parts.push(`${fmt(e.nativeOut, 18)} ${nativeSymbol}`);
  if (e.nativeIn !== '0') parts.push(`${fmt(e.nativeIn, 18)} ${nativeSymbol}`);
  for (const t of e.tokens.slice(0, 2)) parts.push(`${fmt(t.value, t.decimals)} ${t.symbol}`);
  const extra = e.tokens.length > 2 ? ` +${e.tokens.length - 2}` : '';
  switch (e.kind) {
    case 'send': return `Sent ${parts.join(', ')}${extra}`;
    case 'receive': return `Received ${parts.join(', ')}${extra}`;
    case 'self': return `Moved ${parts.join(', ')}${extra} to yourself`;
    case 'swap': return `Swap ${parts.join(' → ')}${extra}`;
    default: return e.method ? `Contract call · ${e.method}` : 'Contract call';
  }
}
