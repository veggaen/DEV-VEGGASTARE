import AnalyticsShell from '@/components/uicustom/charts/analytics/AnalyticsShell';
import CryptoPriceChart from '@/components/uicustom/charts/analytics/CryptoPriceChart';

export default function CryptoAnalyticsPage() {
  return <AnalyticsShell title="Crypto Price Overview" description="Explore historical prices in your preferred currency. Choose a date range, compare daily observations or calendar averages, and inspect the underlying values.">
    <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <span className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium">Experimental</span>
      <p className="text-muted-foreground">Historical market data, not live trading quotes or investment advice. Availability depends on the provider.</p>
    </div>
    <CryptoPriceChart />
    <p className="text-sm leading-relaxed text-muted-foreground">Data from <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">CoinGecko API<span className="sr-only"> (opens in a new tab)</span></a>. Up to 365 days of history; cached for one hour. Dates use UTC.</p>
  </AnalyticsShell>;
}
