/**
 * @fileOverview Shared catalog geometry used by the page and its initial loading boundary.
 * @stability stable
 */
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/uicustom/chrome/page-header';

export const catalogFrame = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8';
/** Container-query grid: column count follows the width beside the filter column, not the viewport. */
export const catalogGrid = 'grid grid-cols-1 gap-4 @sm:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4 lg:gap-5';

export function CatalogHeader() {
  return <div className={catalogFrame}>
    <PageHeader
      eyebrow="Marketplace"
      title="Digital goods, built on trust"
      description="Artwork, prepaid AI credits and experimental modules from verified sellers. Buy with card, PayPal or crypto."
      className="py-6 sm:py-8"
      actions={
        <Link href="/products/create" aria-label="Create listing"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform,box-shadow] duration-200 hover:bg-brand-accent-hover hover:shadow-[0_8px_30px_-12px_hsl(var(--brand-accent)/0.6)] motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Plus className="size-4" aria-hidden="true" />
          <span className="sm:hidden">Sell</span><span className="hidden sm:inline">Create listing</span>
        </Link>
      }
    />
  </div>;
}
