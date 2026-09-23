/** @fileOverview Shared, bounded analytics page geometry. @stability stable */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AnalyticsShell({ title, description, back = true, children }: {
  title: string; description: string; back?: boolean; children: ReactNode;
}) {
  return <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header className="space-y-3">
      {back && <Link href="/analytics" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <ArrowLeft size={16} aria-hidden="true" />All analytics
      </Link>}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Insights · Veggat</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{description}</p>
    </header>
    {children}
  </div>;
}
