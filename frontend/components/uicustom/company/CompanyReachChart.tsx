/** @fileOverview Honest, server-renderable storefront activity summary. @stability stable */
interface CompanyReachChartProps {
  companyName: string;
  stats: { totalProductViews: number; productCount: number; averageRating: number; reviewCount: number };
}

export default function CompanyReachChart({ companyName, stats }: CompanyReachChartProps) {
  const number = new Intl.NumberFormat('en');
  const metrics = [
    { label: 'Product views', value: number.format(stats.totalProductViews) },
    { label: 'Listed products', value: number.format(stats.productCount) },
    { label: 'Reviews', value: number.format(stats.reviewCount) },
    { label: 'Average rating', value: stats.reviewCount > 0 ? `${stats.averageRating.toFixed(1)} / 5` : 'Not rated yet' },
  ];
  return (
    <section aria-label={`${companyName} activity`} className="mt-8 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-6">
      <h2 className="text-lg font-semibold">Storefront activity</h2>
      <p className="mt-1 text-sm text-muted-foreground">Recorded activity across this company’s public products.</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(metric => <div key={metric.label} className="min-w-0 rounded-lg bg-muted/40 p-3 sm:p-4">
          <dt className="text-sm text-muted-foreground">{metric.label}</dt>
          <dd className="mt-2 break-words text-lg font-semibold tabular-nums sm:text-xl">{metric.value}</dd>
        </div>)}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Views may include repeat visits. Unique visitors and sales are not measured in this summary.</p>
    </section>
  );
}
