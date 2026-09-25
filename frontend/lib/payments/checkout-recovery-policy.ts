/** @fileOverview Shared unpaid-order recovery eligibility; never payment proof. @stability stable */
export const CHECKOUT_WINDOW_MS = 3_600_000;
export function checkoutExpiresAt(createdAt: Date) {
  const midnight = new Date(createdAt); midnight.setUTCHours(24, 0, 0, 0);
  return new Date(Math.min(createdAt.getTime() + CHECKOUT_WINDOW_MS, midnight.getTime()));
}
export function checkoutRecovery(attempt: { state: string; environment: string; captureId: string | null; createdAt: Date }, environment: string, now = new Date()) {
  const expiresAt = checkoutExpiresAt(attempt.createdAt).toISOString();
  const eligible = attempt.environment === environment && attempt.environment !== 'DEMO' && !attempt.captureId;
  const pending = ['PREPARED', 'APPROVAL_PENDING'].includes(attempt.state);
  const expired = eligible && pending && now.getTime() >= new Date(expiresAt).getTime();
  return { canResume: eligible && ((pending && !expired) || attempt.state === 'CAPTURE_PENDING'),
    canCancel: eligible && (pending || attempt.state === 'CANCEL_PENDING'), expired, expiresAt };
}
