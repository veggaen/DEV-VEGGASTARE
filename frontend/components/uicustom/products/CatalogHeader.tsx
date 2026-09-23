/**
 * @fileOverview Shared catalog geometry used by the page and its initial loading boundary.
 * @stability stable
 */
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const catalogFrame = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
export const catalogGrid = 'grid grid-cols-1 gap-4 @sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4';

export function CatalogHeader() {
  return <header className={catalogFrame}>
    <div className="py-5 sm:py-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Marketplace</h1>
        <Button asChild variant="outline" className="min-h-11 shrink-0 gap-2">
          <Link href="/products/create" aria-label="Create listing"><Plus className="size-4" aria-hidden />
            <span className="sm:hidden">Sell</span><span className="hidden sm:inline">Create listing</span>
          </Link>
        </Button>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Digital products, clear ownership. Explore independent creators and try the reviewer packs.</p>
    </div>
  </header>;
}
