/** @fileOverview Explain revoked, previously used credits before another purchase. @stability experimental */
export default function CreditRefundNotice({ adjustment, purchasedCredits }: { adjustment: number; purchasedCredits?: number }) {
  if (adjustment <= 0) return null;
  return <div role="note" aria-label="Credit refund adjustment" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed">
    <p className="font-medium">Credit refund adjustment: {adjustment} credits</p>
    <p className="mt-2 text-muted-foreground">These credits were used before their payment was refunded, reversed, or placed under review. New credits first cover this adjustment. This is not a card charge or a cash bill.</p>
    {purchasedCredits !== undefined && <p className="mt-2 font-medium">This pack adds {purchasedCredits} credits: {Math.min(adjustment, purchasedCredits)} cover the adjustment and {Math.max(0, purchasedCredits - adjustment)} become available to use.</p>}
  </div>;
}
