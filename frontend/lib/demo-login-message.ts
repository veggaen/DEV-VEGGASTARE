/** @fileOverview Allowlisted demo messages; never render provider/server text. @stability stable */
export function demoLoginMessage(code?: string): string {
  switch (code) {
    case 'demo_retry_later':
      return 'Too many demo requests. Wait a minute before trying again. You can still browse products.';
    case 'demo_daily_limit':
      return 'Today’s demo allowance for your connection has been used. It resets at 00:00 UTC. You can still browse products or sign in to your own account.';
    case 'demo_capacity':
      return 'The demo has reached today’s capacity. It resets at 00:00 UTC. Browsing products and signing in to your own account are still available.';
    default:
      return 'We couldn’t open the demo right now. Please try again later, browse products, or sign in to your own account.';
  }
}
