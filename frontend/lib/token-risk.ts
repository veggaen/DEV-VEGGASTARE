/**
 * @fileOverview  Token risk: turns what GoPlus Token Security says about a
 *                contract and what the DEX data says about its liquidity into
 *                one level with plain-language reasons. The inventory greys
 *                out anything that is not "ok" and leaves its value out of the
 *                total until the user chooses to count it. Pure; no fetching.
 * @stability     evolving
 */

export type RiskLevel = 'ok' | 'caution' | 'danger' | 'unknown';

export type TokenRisk = {
  level: RiskLevel;
  /** Short, user-facing reasons, worst first. */
  reasons: string[];
  liquidityUsd?: number;
  volume24hUsd?: number;
  honeypot?: boolean;
  buyTaxPct?: number;
  sellTaxPct?: number;
  /** Where the verdict came from: "goplus", "dex", "known". */
  sources: string[];
};

/** The subset of a GoPlus `token_security` entry we act on (all fields are "0"/"1" strings or decimals-as-strings). */
export type GoPlusSecurity = Partial<{
  is_honeypot: string;
  honeypot_with_same_creator: string;
  is_airdrop_scam: string;
  fake_token: string;
  cannot_sell_all: string;
  cannot_buy: string;
  transfer_pausable: string;
  is_blacklisted: string;
  is_whitelisted: string;
  owner_change_balance: string;
  hidden_owner: string;
  selfdestruct: string;
  external_call: string;
  is_mintable: string;
  is_open_source: string;
  is_proxy: string;
  is_in_dex: string;
  trust_list: string;
  buy_tax: string;
  sell_tax: string;
  holder_count: string;
  dex: { liquidity?: string }[];
}>;

export type RiskInput = {
  isNative?: boolean;
  /** Well-known symbol on its home chain (USDC on Ethereum, HEX, …). */
  isKnown?: boolean;
  goplus?: GoPlusSecurity | null;
  liquidityUsd?: number;
  volume24hUsd?: number;
};

const THIN_LIQUIDITY_USD = 10_000;
const NO_LIQUIDITY_USD = 1_000;
const DANGER_TAX = 0.10;
const CAUTION_TAX = 0.03;

const flag = (v: string | undefined) => v === '1';
const pct = (v: string | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
const money = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${Math.round(n)}`;

export function assessToken(input: RiskInput): TokenRisk {
  if (input.isNative) return { level: 'ok', reasons: [], sources: ['known'] };
  const danger: string[] = [];
  const caution: string[] = [];
  const sources: string[] = [];
  const g = input.goplus ?? undefined;

  let liquidityUsd = input.liquidityUsd;
  if (g) {
    sources.push('goplus');
    const dexLiquidity = (g.dex ?? []).reduce((sum, d) => sum + (Number(d.liquidity) || 0), 0);
    if (liquidityUsd === undefined && g.dex) liquidityUsd = dexLiquidity;
    if (flag(g.is_honeypot)) danger.push('Honeypot: buyers cannot sell this token.');
    if (flag(g.honeypot_with_same_creator)) danger.push('Made by a creator with earlier honeypots.');
    if (flag(g.is_airdrop_scam)) danger.push('Flagged as an airdrop scam.');
    if (flag(g.fake_token)) danger.push('Imitates a known token.');
    if (flag(g.cannot_sell_all)) danger.push('Holders cannot sell their whole balance.');
    if (flag(g.cannot_buy)) danger.push('Buying is blocked.');
    if (flag(g.transfer_pausable)) danger.push('The owner can pause transfers.');
    if (flag(g.is_blacklisted)) danger.push('The owner can blacklist wallets.');
    if (flag(g.owner_change_balance)) danger.push('The owner can change any balance.');
    if (flag(g.hidden_owner)) danger.push('Hidden owner.');
    if (flag(g.selfdestruct)) danger.push('The contract can self-destruct.');
    const sell = pct(g.sell_tax), buy = pct(g.buy_tax);
    if (sell !== undefined && sell >= DANGER_TAX) danger.push(`Sell tax ${Math.round(sell * 100)}%.`);
    else if (sell !== undefined && sell >= CAUTION_TAX) caution.push(`Sell tax ${Math.round(sell * 100)}%.`);
    if (buy !== undefined && buy >= DANGER_TAX) caution.push(`Buy tax ${Math.round(buy * 100)}%.`);
    if (flag(g.is_mintable)) caution.push('Supply can be minted.');
    if (g.is_open_source === '0') caution.push('Source code not verified.');
    if (g.is_in_dex === '0') caution.push('Not listed on any DEX.');
  }

  if (liquidityUsd !== undefined) {
    if (!sources.includes('dex') && input.liquidityUsd !== undefined) sources.push('dex');
    if (liquidityUsd < NO_LIQUIDITY_USD) danger.push(`Almost no liquidity (${money(liquidityUsd)}): the shown price cannot be realised.`);
    else if (liquidityUsd < THIN_LIQUIDITY_USD) caution.push(`Thin liquidity (${money(liquidityUsd)}).`);
  }
  if (input.volume24hUsd !== undefined && input.volume24hUsd < 100 && (liquidityUsd ?? 0) < THIN_LIQUIDITY_USD) caution.push('No trading in the last 24 hours.');

  const base = { liquidityUsd, volume24hUsd: input.volume24hUsd, honeypot: g ? flag(g.is_honeypot) : undefined, buyTaxPct: g ? pct(g.buy_tax) : undefined, sellTaxPct: g ? pct(g.sell_tax) : undefined, sources };
  if (danger.length) return { level: 'danger', reasons: [...danger, ...caution], ...base };
  if (g && flag(g.trust_list)) return { level: 'ok', reasons: [], ...base, sources: [...sources, 'known'] };
  if (input.isKnown && !caution.length) return { level: 'ok', reasons: [], ...base, sources: [...sources, 'known'] };
  if (caution.length) return { level: 'caution', reasons: caution, ...base };
  if (!sources.length) return { level: 'unknown', reasons: ['No security or liquidity data for this token yet.'], ...base };
  return { level: 'ok', reasons: [], ...base };
}

/** Does this token's price count toward totals? "ok" always; anything else only when the user chose to trust it. */
export function valueCounts(level: RiskLevel | undefined, trusted: boolean): boolean {
  return level === 'ok' || trusted;
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  ok: 'Verified market',
  caution: 'Unverified value',
  danger: 'Likely scam',
  unknown: 'No market data',
};
