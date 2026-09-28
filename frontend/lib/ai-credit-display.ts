/** @fileOverview Consistent read-only credit presentation; never authorizes a grant or provider call. @stability stable */
export const DEMO_AI_CREDITS = 5;
type CreditPosition = { balance: number; refundAdjustment: number };

export function displayCreditPosition(account: CreditPosition | null, environment: 'DEMO' | 'LIVE' | 'SANDBOX') {
  // Only a missing DEMO account has an unclaimed allowance. An existing zero
  // balance remains zero; neither receipts nor history replenish spent credits.
  const unclaimedDemoAllowance = account === null && environment === 'DEMO' ? DEMO_AI_CREDITS : 0;
  return {
    available: (account?.balance ?? 0) + unclaimedDemoAllowance,
    recordedBalance: account?.balance ?? 0,
    unclaimedDemoAllowance,
    refundAdjustment: account?.refundAdjustment ?? 0,
  };
}
