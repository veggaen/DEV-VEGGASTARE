/**
 * @fileOverview Sticky glass catalog toolbar: categories, search, and the filter
 *               button (below xl; on xl+ the filter column is always beside the grid).
 * @stability stable
 */
'use client';

import { LayoutGrid, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCategories } from '@/components/providers/categoriesContext';
import { useSidebar } from '@/components/providers/product-layoutProvider';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const chip = 'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border/60 bg-surface-1/75 px-3.5 text-sm font-medium text-foreground backdrop-blur-xl transition-[border-color,background-color,color] duration-200 hover:border-border hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ProductsToolbar() {
  const { categoriesWithCounts, categoriesLoading, selectedCategories, setSelectedCategories, searchTerm, setSearchTerm, activeFilterCount } = useCategories();
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  return (
    <div className="border-b border-border/60 bg-background/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(chip, 'size-11 px-0 sm:w-auto sm:px-3.5', selectedCategories.length > 0 && 'border-brand-accent/40 bg-brand-accent/10')} aria-label="Browse categories">
              <LayoutGrid className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Categories</span>
              {selectedCategories.length > 0 && <span className="hidden rounded-full bg-brand-accent/15 px-1.5 text-[11px] font-semibold text-brand-accent-hover sm:inline dark:text-brand-accent-light">{selectedCategories.length}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-90 max-h-[min(24rem,70dvh)] w-64 max-w-[calc(100%-2rem)] overflow-y-auto overscroll-contain rounded-2xl border-border/70 bg-popover/95 p-1.5 shadow-e3 backdrop-blur-xl">
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categories</DropdownMenuLabel>
            {categoriesLoading ? <p role="status" className="p-3 text-sm text-muted-foreground">Loading categories…</p>
              : categoriesWithCounts.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Categories are unavailable. Search still works.</p>
              : categoriesWithCounts.map(category => (
                <DropdownMenuCheckboxItem key={category.category} className="min-h-11 gap-3 rounded-lg text-sm"
                  checked={selectedCategories.includes(category.category)} onSelect={event => event.preventDefault()}
                  onCheckedChange={() => setSelectedCategories(previous => previous.includes(category.category)
                    ? previous.filter(value => value !== category.category) : [...previous, category.category])}>
                  <span className="min-w-0 flex-1 truncate capitalize">{category.category}</span>
                  <span className="tabular-nums text-muted-foreground">{category.count}</span>
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div role="search" className="relative min-w-0 flex-1">
          <label htmlFor="catalog-search" className="sr-only">Search products</label>
          {/* z-[1]: the blurred input paints above positioned siblings otherwise. */}
          <Search className="pointer-events-none absolute left-4 top-1/2 z-[1] size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input id="catalog-search" type="search" value={searchTerm} maxLength={200}
            onChange={event => setSearchTerm(event.target.value)} placeholder="Search artwork, credits, modules…"
            className="h-11 w-full min-w-0 rounded-full border border-border/60 bg-surface-1/75 pl-11 pr-11 text-base text-foreground backdrop-blur-xl transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)] [&::-webkit-search-cancel-button]:appearance-none" />
          {searchTerm && <button type="button" aria-label="Clear search" onClick={() => setSearchTerm('')}
            className="absolute right-1 top-1/2 z-[1] grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden="true" />
          </button>}
        </div>

        <button type="button" onClick={toggleSidebar} data-product-filter-trigger aria-label="Product filters" aria-expanded={isSidebarOpen}
          className={cn(chip, 'relative size-11 px-0 sm:w-auto sm:px-3.5 xl:hidden', (isSidebarOpen || activeFilterCount > 0) && 'border-brand-accent/40 bg-brand-accent/10')}>
          <SlidersHorizontal className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1 text-[11px] font-semibold text-brand-accent-foreground">{activeFilterCount}</span>}
        </button>
      </div>
    </div>
  );
}
