/**
 * @fileOverview Stable, keyboard-accessible catalog search and filter controls.
 * @stability stable
 */
'use client';

import { LayoutGrid, PanelsLeftRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCategories } from '@/components/providers/categoriesContext';
import { useSidebar, type SidebarDock } from '@/components/providers/product-layoutProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

const docks: { value: SidebarDock; label: string }[] = [
  { value: 'edge-left', label: 'Left edge' }, { value: 'frame-left', label: 'Beside products, left' },
  { value: 'frame-right', label: 'Beside products, right' }, { value: 'edge-right', label: 'Right edge' },
];

export function ProductsToolbar() {
  const { categoriesWithCounts, categoriesLoading, selectedCategories, setSelectedCategories,
    searchTerm, setSearchTerm, activeFilterCount } = useCategories();
  const { isSidebarOpen, toggleSidebar, sidebarDock, setSidebarDock } = useSidebar();
  return (
    <div className="border-y border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="size-11 shrink-0 px-0 sm:w-auto sm:gap-2 sm:px-3" aria-label="Browse categories">
              <LayoutGrid className="size-4" aria-hidden /><span className="hidden sm:inline">Categories</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-90 max-h-[min(24rem,70dvh)] w-64 max-w-[calc(100%-2rem)] overflow-y-auto overscroll-contain">
            <DropdownMenuLabel>Product categories</DropdownMenuLabel>
            {categoriesLoading ? <p role="status" className="p-3 text-sm text-muted-foreground">Loading categories…</p>
              : categoriesWithCounts.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Categories are unavailable. Search is still available.</p>
              : categoriesWithCounts.map(category => (
                <DropdownMenuCheckboxItem key={category.category} className="min-h-11 gap-3 text-sm"
                  checked={selectedCategories.includes(category.category)} onSelect={event => event.preventDefault()}
                  onCheckedChange={() => setSelectedCategories(previous => previous.includes(category.category)
                    ? previous.filter(value => value !== category.category) : [...previous, category.category])}>
                  <span className="min-w-0 flex-1 truncate">{category.category}</span>
                  <span className="tabular-nums text-muted-foreground">{category.count}</span>
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div role="search" className="relative min-w-0 flex-1">
          <label htmlFor="catalog-search" className="sr-only">Search products</label>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
          <input id="catalog-search" type="search" value={searchTerm} maxLength={200}
            onChange={event => setSearchTerm(event.target.value)} placeholder="Search products…"
            className="h-11 w-full min-w-0 rounded-lg border border-input bg-background pl-9 pr-11 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none" />
          {searchTerm && <button type="button" aria-label="Clear search" onClick={() => setSearchTerm('')}
            className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
            <X className="size-4" aria-hidden />
          </button>}
        </div>
        <Button variant={isSidebarOpen ? 'secondary' : 'outline'} onClick={toggleSidebar}
          data-product-filter-trigger aria-label="Product filters" aria-expanded={isSidebarOpen}
          className="relative size-11 shrink-0 px-0 sm:w-auto sm:gap-2 sm:px-3">
          <SlidersHorizontal className="size-4" aria-hidden /><span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">{activeFilterCount}</span>}
        </Button>
        <div className="hidden lg:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-11" aria-label="Filter panel position"><PanelsLeftRight className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-90">
              <DropdownMenuLabel>Filter panel position</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sidebarDock} onValueChange={value => setSidebarDock(value as SidebarDock)}>
                {docks.map(dock => <DropdownMenuRadioItem key={dock.value} value={dock.value} className="min-h-11">{dock.label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
