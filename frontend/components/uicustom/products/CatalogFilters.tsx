"use client";

/**
 * @fileOverview  CatalogFilters — the marketplace filter panel. One component,
 *                two homes: a sticky glass column beside the grid on xl+ and a
 *                left Sheet below that. It never pushes the page around; the
 *                grid simply has fewer columns next to it.
 *
 *                Price (in the display currency), categories and sellers with
 *                live counts, page size, and a reset. Tokens only.
 * @stability     evolving
 */

import * as React from "react";
import { ChevronDown, Grid2x2, Info, PanelLeftClose, RotateCcw, Search, SlidersHorizontal, Users } from "lucide-react";
import { HeaderTip } from "@/components/uicustom/chrome/header-tip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiPreferences } from "@/components/providers/ui-preferences";
import { useCategories } from "@/components/providers/categoriesContext";
import { useSidebar } from "@/components/providers/product-layoutProvider";
import { Checkbox } from "@/components/ui/checkbox";
import CatalogPriceFilter from "@/components/uicustom/product/catalog-price-filter";
import { cn } from "@/lib/utils";

function Group({ title, icon: Icon, count, selected, hint, open, onToggle, onReset, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>; count?: number; selected?: number;
  /** One line of context, shown as a tooltip on an info icon instead of taking sidebar space. */
  hint?: string;
  open: boolean; onToggle: () => void; onReset?: () => void; children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    // Vertical padding keeps the header's hover fill clear of the divider lines.
    <section className="border-b border-border/60 py-1.5 last:border-b-0">
      <div className="flex items-center gap-1 px-1">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-[13px] font-semibold text-foreground">{title}</span>
          {typeof count === "number" && <span className="text-[11px] tabular-nums text-muted-foreground">({count})</span>}
          {hint && (
            <HeaderTip label={hint} side="top">
              <span role="img" tabIndex={0} aria-label={hint} onClick={(e) => e.stopPropagation()} className="grid size-5 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Info className="size-3.5" aria-hidden="true" />
              </span>
            </HeaderTip>
          )}
          {typeof selected === "number" && selected > 0 && <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent/15 px-1.5 text-[11px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">{selected}</span>}
          <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180", typeof selected === "number" && selected > 0 ? "" : "ml-auto")} />
        </button>
        {onReset && (
          <button type="button" onClick={onReset} aria-label={`Reset ${title.toLowerCase()}`}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div id={id} hidden={!open} className="px-2 pb-3 pt-0.5">{children}</div>
    </section>
  );
}

function Row({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className={cn("flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm transition-colors hover:bg-foreground/[0.05]", checked && "bg-brand-accent/[0.08]")}>
      <Checkbox checked={checked} onCheckedChange={onChange} className="size-4 rounded border-border data-[state=checked]:border-brand-accent data-[state=checked]:bg-brand-accent" />
      <span className={cn("min-w-0 flex-1 truncate capitalize", checked ? "font-medium text-foreground" : "text-foreground/85")}>{label}</span>
      <span className={cn("text-[11px] tabular-nums", count === 0 ? "text-muted-foreground/60" : "text-muted-foreground")}>{count}</span>
    </label>
  );
}

export function CatalogFilters({ variant, onClose, onHide, className }: {
  variant: "inline" | "sheet";
  onClose?: () => void;
  /** Inline column only: collapse the column so the grid takes the whole frame. */
  onHide?: () => void;
  className?: string;
}) {
  const {
    categoriesWithCounts, categoriesLoading, selectedCategories, setSelectedCategories,
    sellers, sellersLoading, selectedSellers, setSelectedSellers,
    minPrice, maxPrice, setMinPrice, setMaxPrice, initialPriceRange,
    resetAllFilters, resetPriceFilters, resetCategoryFilters, resetSellerFilters, activeFilterCount,
  } = useCategories();
  const { perPage, setPerPage } = useSidebar();
  const fiat = useUiPreferences().prefs.preferredFiatCurrency;
  const [open, setOpen] = React.useState({ price: true, categories: true, sellers: true, view: false });
  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const [sellerQuery, setSellerQuery] = React.useState("");
  const visibleSellers = sellerQuery.trim() ? sellers.filter((s) => s.name.toLowerCase().includes(sellerQuery.trim().toLowerCase())) : sellers;
  const priceTouched = minPrice !== null || maxPrice !== null;

  return (
    // Radix tooltips need a provider; the panel lives outside the header, which has its own.
    <TooltipProvider delayDuration={200} skipDelayDuration={200}>
    <div className={cn("flex min-h-0 flex-col", className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent/15 px-1.5 text-[11px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">{activeFilterCount}</span>}
        </h2>
        {/* The Sheet renders its own close control; the inline column can be hidden entirely. */}
        {variant === "sheet" && onClose && <span className="w-9" aria-hidden="true" />}
        {variant === "inline" && onHide && (
          <button type="button" onClick={onHide} aria-label="Hide filters" title="Hide filters"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
        <Group title="Price" icon={SlidersHorizontal} hint={`Prices in ${fiat}. Your budget carries across currencies at estimated exchange rates.`} open={open.price} onToggle={() => toggle("price")} onReset={priceTouched ? resetPriceFilters : undefined}>
          <CatalogPriceFilter minUsd={minPrice} maxUsd={maxPrice} rangeMaxUsd={initialPriceRange?.max ?? 10000} setMinUsd={setMinPrice} setMaxUsd={setMaxPrice} variant={variant} />
        </Group>

        <Group title="Categories" icon={Grid2x2} count={categoriesWithCounts.length} selected={selectedCategories.length} open={open.categories} onToggle={() => toggle("categories")} onReset={selectedCategories.length ? resetCategoryFilters : undefined}>
          {categoriesLoading ? <p role="status" className="px-2 py-2 text-sm text-muted-foreground">Loading categories…</p>
            : categoriesWithCounts.length === 0 ? <p className="px-2 py-2 text-sm text-muted-foreground">No categories yet.</p>
            : <div className="space-y-0.5">{categoriesWithCounts.map((c) => (
              <Row key={c.category} label={c.category} count={c.count} checked={selectedCategories.includes(c.category)}
                onChange={() => setSelectedCategories((prev) => prev.includes(c.category) ? prev.filter((v) => v !== c.category) : [...prev, c.category])} />
            ))}</div>}
        </Group>

        <Group title="Sellers" icon={Users} count={sellers.length} selected={selectedSellers.length} open={open.sellers} onToggle={() => toggle("sellers")} onReset={selectedSellers.length ? resetSellerFilters : undefined}>
          {sellersLoading ? <p role="status" className="px-2 py-2 text-sm text-muted-foreground">Loading sellers…</p>
            : sellers.length === 0 ? <p className="px-2 py-2 text-sm text-muted-foreground">No sellers yet.</p>
            : <div className="space-y-2">
              {sellers.length > 6 && (
                <label className="relative block">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="search" value={sellerQuery} onChange={(e) => setSellerQuery(e.target.value)} placeholder="Search sellers" aria-label="Search sellers"
                    className="h-10 w-full rounded-lg border border-border/60 bg-foreground/[0.04] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)] [&::-webkit-search-cancel-button]:appearance-none" />
                </label>
              )}
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                {visibleSellers.length ? visibleSellers.map((s) => (
                  <Row key={s.id} label={s.name} count={s.count} checked={selectedSellers.includes(s.id)}
                    onChange={() => setSelectedSellers((prev) => prev.includes(s.id) ? prev.filter((v) => v !== s.id) : [...prev, s.id])} />
                )) : <p className="px-2 py-2 text-sm text-muted-foreground">No seller matches “{sellerQuery}”.</p>}
              </div>
            </div>}
        </Group>

        <Group title="View" icon={Grid2x2} open={open.view} onToggle={() => toggle("view")}>
          <div className="flex items-center justify-between gap-3 px-2">
            <span className="text-sm text-muted-foreground">Products per page</span>
            <div role="radiogroup" aria-label="Products per page" className="flex gap-0.5 rounded-lg bg-foreground/[0.04] p-0.5">
              {[10, 20, 50].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={perPage === n} onClick={() => setPerPage(n)}
                  className={cn("min-h-8 rounded-md px-2.5 text-xs font-medium tabular-nums transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", perPage === n ? "bg-card text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Group>
      </div>

      <footer className="shrink-0 border-t border-border/60 p-3">
        <button type="button" onClick={resetAllFilters} disabled={activeFilterCount === 0}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/60 text-sm font-medium text-foreground transition-[background-color,border-color] duration-200 hover:border-border hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset all filters
        </button>
      </footer>
    </div>
    </TooltipProvider>
  );
}

export default CatalogFilters;
