/**
 * @fileOverview  HEX (hex.com) staking: the contract surface we read and
 *                write, and the pure maths around it (days ↔ dates, share
 *                estimates, accrued yield from the daily data). Same contract
 *                address on Ethereum and on PulseChain (a fork of Ethereum
 *                state). Nothing here signs; the panel does that through the
 *                wallet.
 * @stability     experimental
 */

export const HEX_ADDRESS = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39' as const;
export const HEX_CHAINS = [1, 369] as const;
export const HEARTS_PER_HEX = BigInt(100_000_000); // 1e8
export const HEX_DECIMALS = 8;
/** HEX day 0 started 2019-12-03 00:00:00 UTC. */
export const HEX_LAUNCH_SECONDS = 1_575_331_200;
export const HEX_MAX_STAKE_DAYS = 5555;
export const SHARE_RATE_SCALE = BigInt(100_000); // 1e5
const SHARES_PER_TSHARE = BigInt(1_000_000_000_000); // 1e12
// Longer Pays Better / Bigger Pays Better constants from the contract.
const LPB = BigInt(1820);
const LPB_MAX_DAYS = BigInt(3640);
const BPB_MAX_HEARTS = BigInt(150_000_000) * HEARTS_PER_HEX;
const BPB = BPB_MAX_HEARTS * BigInt(10);

export const hexAbi = [
  { type: 'function', name: 'stakeCount', stateMutability: 'view', inputs: [{ name: 'stakerAddr', type: 'address' }], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'stakeLists', stateMutability: 'view',
    inputs: [{ name: 'stakerAddr', type: 'address' }, { name: 'stakeIndex', type: 'uint256' }],
    outputs: [
      { name: 'stakeId', type: 'uint40' }, { name: 'stakedHearts', type: 'uint72' }, { name: 'stakeShares', type: 'uint72' },
      { name: 'lockedDay', type: 'uint16' }, { name: 'stakedDays', type: 'uint16' }, { name: 'unlockedDay', type: 'uint16' }, { name: 'isAutoStake', type: 'bool' },
    ],
  },
  { type: 'function', name: 'currentDay', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'globals', stateMutability: 'view', inputs: [],
    outputs: [
      { name: 'lockedHeartsTotal', type: 'uint72' }, { name: 'nextStakeSharesTotal', type: 'uint72' }, { name: 'shareRate', type: 'uint40' }, { name: 'stakePenaltyTotal', type: 'uint72' },
      { name: 'dailyDataCount', type: 'uint16' }, { name: 'stakeSharesTotal', type: 'uint72' }, { name: 'latestStakeId', type: 'uint40' }, { name: 'claimStats', type: 'uint128' },
    ],
  },
  { type: 'function', name: 'dailyDataRange', stateMutability: 'view', inputs: [{ name: 'beginDay', type: 'uint256' }, { name: 'endDay', type: 'uint256' }], outputs: [{ name: 'list', type: 'uint256[]' }] },
  { type: 'function', name: 'stakeStart', stateMutability: 'nonpayable', inputs: [{ name: 'newStakedHearts', type: 'uint256' }, { name: 'newStakedDays', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'stakeEnd', stateMutability: 'nonpayable', inputs: [{ name: 'stakeIndex', type: 'uint256' }, { name: 'stakeIdParam', type: 'uint40' }], outputs: [] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export type HexStake = {
  index: number;
  stakeId: bigint;
  stakedHearts: bigint;
  stakeShares: bigint;
  lockedDay: number;
  stakedDays: number;
  unlockedDay: number;
  isAutoStake: boolean;
};

export type HexStakeView = HexStake & {
  /** Day the stake matures (lockedDay + stakedDays). */
  endDay: number;
  daysServed: number;
  progress: number;
  status: 'pending' | 'active' | 'matured' | 'late' | 'ended';
  tShares: number;
  principalHex: number;
  startDate: Date;
  endDate: Date;
};

export const dayToDate = (day: number): Date => new Date((HEX_LAUNCH_SECONDS + day * 86_400) * 1000);
export const heartsToHex = (hearts: bigint): number => Number(hearts) / Number(HEARTS_PER_HEX);
export const sharesToTShares = (shares: bigint): number => Number(shares) / Number(SHARES_PER_TSHARE);

/** Hearts from a typed HEX amount ("12.5" → 1250000000n). Null when not a positive number. */
export function parseHex(input: string): bigint | null {
  const text = input.trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(text) || !text) return null;
  const [whole = '0', frac = ''] = text.split('.');
  const hearts = BigInt(whole) * HEARTS_PER_HEX + BigInt((frac + '00000000').slice(0, 8));
  return hearts > BigInt(0) ? hearts : null;
}

export function describeStake(stake: HexStake, currentDay: number): HexStakeView {
  const endDay = stake.lockedDay + stake.stakedDays;
  const ended = stake.unlockedDay > 0;
  const started = currentDay >= stake.lockedDay;
  const daysServed = ended ? Math.min(stake.unlockedDay, endDay) - stake.lockedDay : started ? Math.min(currentDay, endDay) - stake.lockedDay : 0;
  const progress = stake.stakedDays > 0 ? Math.max(0, Math.min(1, daysServed / stake.stakedDays)) : 0;
  // HEX gives 14 days of grace after maturity before late penalties start.
  const status: HexStakeView['status'] = ended ? 'ended' : !started ? 'pending' : currentDay < endDay ? 'active' : currentDay <= endDay + 14 ? 'matured' : 'late';
  return { ...stake, endDay, daysServed, progress, status, tShares: sharesToTShares(stake.stakeShares), principalHex: heartsToHex(stake.stakedHearts), startDate: dayToDate(stake.lockedDay), endDate: dayToDate(endDay) };
}

/** The contract's stake-start share formula, for an "≈ X T-shares" preview. */
export function estimateStakeShares(hearts: bigint, days: number, shareRate: bigint): bigint {
  if (hearts <= BigInt(0) || days < 1 || shareRate <= BigInt(0)) return BigInt(0);
  const d = BigInt(Math.min(days, HEX_MAX_STAKE_DAYS));
  const cappedExtraDays = d > BigInt(1) ? (d <= LPB_MAX_DAYS ? d - BigInt(1) : LPB_MAX_DAYS) : BigInt(0);
  const cappedHearts = hearts <= BPB_MAX_HEARTS ? hearts : BPB_MAX_HEARTS;
  const bonus = (hearts * (cappedExtraDays * BPB + cappedHearts * LPB)) / (LPB * BPB);
  return ((hearts + bonus) * SHARE_RATE_SCALE) / shareRate;
}

/** One packed `dailyDataRange` word → the day's payout and total shares. */
export function decodeDailyData(packed: bigint): { dayPayoutTotal: bigint; dayStakeSharesTotal: bigint; dayUnclaimedSatoshisTotal: bigint } {
  const mask72 = (BigInt(1) << BigInt(72)) - BigInt(1);
  const mask56 = (BigInt(1) << BigInt(56)) - BigInt(1);
  return {
    dayPayoutTotal: packed & mask72,
    dayStakeSharesTotal: (packed >> BigInt(72)) & mask72,
    dayUnclaimedSatoshisTotal: (packed >> BigInt(144)) & mask56,
  };
}

/** Hearts earned so far by `stakeShares` over the given days' packed data (the contract's own payout loop). */
export function accruedPayout(stakeShares: bigint, dailyData: bigint[]): bigint {
  let total = BigInt(0);
  for (const packed of dailyData) {
    const d = decodeDailyData(packed);
    if (d.dayStakeSharesTotal === BigInt(0)) continue;
    total += (d.dayPayoutTotal * stakeShares) / d.dayStakeSharesTotal;
  }
  return total;
}

export const formatHex = (hearts: bigint, digits = 2): string => heartsToHex(hearts).toLocaleString('en-US', { maximumFractionDigits: digits });
