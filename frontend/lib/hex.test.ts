import { describe, expect, it } from 'vitest';
import { HEARTS_PER_HEX, SHARE_RATE_SCALE, accruedPayout, dayToDate, decodeDailyData, describeStake, estimateStakeShares, parseHex } from './hex';

describe('parseHex / dates', () => {
  it('turns typed HEX into hearts and rejects junk', () => {
    expect(parseHex('12.5')).toBe(BigInt(1_250_000_000));
    expect(parseHex('0.00000001')).toBe(BigInt(1));
    expect(parseHex('0')).toBeNull();
    expect(parseHex('abc')).toBeNull();
  });
  it('maps HEX days to calendar days from the launch', () => {
    expect(dayToDate(0).toISOString()).toBe('2019-12-03T00:00:00.000Z');
    expect(dayToDate(1000).toISOString()).toBe('2022-08-29T00:00:00.000Z');
  });
});

describe('describeStake', () => {
  const stake = { index: 0, stakeId: BigInt(1), stakedHearts: BigInt(1000) * HEARTS_PER_HEX, stakeShares: BigInt(5) * BigInt(1_000_000_000_000), lockedDay: 100, stakedDays: 200, unlockedDay: 0, isAutoStake: false };
  it('tracks progress and status through the stake life', () => {
    expect(describeStake(stake, 50).status).toBe('pending');
    const mid = describeStake(stake, 200);
    expect(mid.status).toBe('active');
    expect(mid.daysServed).toBe(100);
    expect(mid.progress).toBe(0.5);
    expect(mid.tShares).toBe(5);
    expect(mid.principalHex).toBe(1000);
    expect(describeStake(stake, 305).status).toBe('matured');
    expect(describeStake(stake, 400).status).toBe('late');
    expect(describeStake({ ...stake, unlockedDay: 250 }, 400).status).toBe('ended');
  });
});

describe('estimateStakeShares', () => {
  it('gives more shares for longer and bigger stakes, and none for bad input', () => {
    const rate = BigInt(200_000); // share rate 2.0 (scaled by 1e5)
    const hearts = BigInt(1000) * HEARTS_PER_HEX;
    const oneDay = estimateStakeShares(hearts, 1, rate);
    const base = (hearts * SHARE_RATE_SCALE) / rate;
    // Even a one-day stake gets the (tiny) bigger-pays-better bonus; no longer-pays-better yet.
    expect(oneDay).toBeGreaterThanOrEqual(base);
    expect(oneDay - base).toBeLessThan(base / BigInt(1000));
    expect(estimateStakeShares(hearts, 365, rate)).toBeGreaterThan(oneDay);
    expect(estimateStakeShares(hearts, 5555, rate)).toBeGreaterThan(estimateStakeShares(hearts, 365, rate));
    expect(estimateStakeShares(hearts * BigInt(10), 365, rate)).toBeGreaterThan(estimateStakeShares(hearts, 365, rate) * BigInt(10));
    expect(estimateStakeShares(BigInt(0), 10, rate)).toBe(BigInt(0));
  });
});

describe('daily data', () => {
  it('unpacks the contract word and accrues payout by share of the day', () => {
    const payout = BigInt(1_000_000), shares = BigInt(50_000), unclaimed = BigInt(7);
    const packed = payout | (shares << BigInt(72)) | (unclaimed << BigInt(144));
    expect(decodeDailyData(packed)).toEqual({ dayPayoutTotal: payout, dayStakeSharesTotal: shares, dayUnclaimedSatoshisTotal: unclaimed });
    expect(accruedPayout(BigInt(5_000), [packed, packed])).toBe(BigInt(200_000));
    expect(accruedPayout(BigInt(5_000), [BigInt(0)])).toBe(BigInt(0));
  });
});
