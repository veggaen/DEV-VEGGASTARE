/** @fileOverview Demo presentation cannot invent paid balances or reset spent allowance. @stability stable */
import { describe, expect, it } from 'vitest';
import { displayCreditPosition } from './ai-credit-display';

describe('read-only credit display', () => {
  it('includes the first-send demo allowance without claiming it is recorded', () => {
    expect(displayCreditPosition(null, 'DEMO')).toEqual({ available: 5, recordedBalance: 0, unclaimedDemoAllowance: 5, refundAdjustment: 0 });
  });
  it.each(['LIVE', 'SANDBOX'] as const)('never invents a grant for an empty %s account', environment => {
    expect(displayCreditPosition(null, environment)).toEqual({ available: 0, recordedBalance: 0, unclaimedDemoAllowance: 0, refundAdjustment: 0 });
  });
  it.each([0, 1, 3, 5])('preserves an existing demo balance of %i exactly', balance => {
    expect(displayCreditPosition({ balance, refundAdjustment: 0 }, 'DEMO')).toMatchObject({ available: balance, unclaimedDemoAllowance: 0 });
  });
  it('preserves refund adjustments and never subtracts reservations twice', () => {
    const account = Object.freeze({ balance: 30, refundAdjustment: 7 });
    expect(displayCreditPosition(account, 'SANDBOX')).toEqual({ available: 30, recordedBalance: 30, unclaimedDemoAllowance: 0, refundAdjustment: 7 });
  });
});
