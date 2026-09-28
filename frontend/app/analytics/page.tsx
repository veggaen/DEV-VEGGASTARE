import Link from 'next/link';
import { ArrowUpRight, Building2, ChartNoAxesCombined, Package, Users } from 'lucide-react';
import AnalyticsShell from '@/components/uicustom/charts/analytics/AnalyticsShell';

const reports = [
  { href: 'products', name: 'Products', icon: Package, copy: 'Explore how the marketplace catalogue grows over time.' },
  { href: 'users', name: 'Users', icon: Users, copy: 'Follow cumulative account creation, day by day.' },
  { href: 'companies', name: 'Companies', icon: Building2, copy: 'Track the companies joining the marketplace.' },
];

export default function AnalyticsPage() {
  return <AnalyticsShell title="Analytics Dashboard" description="Understand the marketplace at a glance. Explore growth reports or the experimental market-data viewer." back={false}>
    <section aria-labelledby="growth-reports" className="space-y-4">
      <div>
        <h2 id="growth-reports" className="text-lg font-semibold">Marketplace growth</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Live platform data is private to administrators. Everyone else can explore clearly labelled, illustrative sample reports.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {reports.map(({ href, name, icon: Icon, copy }) => <Link key={href} href={'/analytics/' + href} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:p-6">
          <div className="flex items-center justify-between"><Icon className="text-brand-accent" size={24} aria-hidden="true" /><ArrowUpRight size={18} className="text-muted-foreground" aria-hidden="true" /></div>
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy}</p>
          <span className="mt-auto text-sm font-medium">Explore report</span>
        </Link>)}
      </div>
    </section>
    <section aria-labelledby="market-data" className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0 space-y-2"><span className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">Experimental</span><h2 id="market-data" className="flex items-center gap-2 text-lg font-semibold"><ChartNoAxesCombined size={20} aria-hidden="true" />Crypto market data</h2><p className="max-w-xl text-sm leading-relaxed text-muted-foreground">A separate public price-history viewer. This is not marketplace revenue or investment advice.</p></div>
      <Link href="/analytics/crypto" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Explore crypto<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </section>
  </AnalyticsShell>;
}
