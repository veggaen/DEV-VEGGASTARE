"use client";

import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="mt-auto shrink-0 border-t border-border/70 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
      {/* Soft maintenance notice */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-6 py-2">
        <p className="text-center text-xs text-amber-700 dark:text-amber-200/80">
          Pulse, polls, and Web3 trading are experimental modules.
        </p>
      </div>
      
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Veggat</span>
          <span className="mx-2 text-border">·</span>
          <span>© {year}</span>
          <span className="mx-2 text-border">·</span>
          <span>Org.nr: 937 051 107</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Link
            href="/info"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-[color,background-color] duration-200 motion-reduce:transition-none hover:bg-muted hover:text-foreground"
          >
            Kontakt
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-[color,background-color] duration-200 motion-reduce:transition-none hover:bg-muted hover:text-foreground"
          >
            Salgsvilkår
          </Link>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-[color,background-color] duration-200 motion-reduce:transition-none hover:bg-muted hover:text-foreground"
          >
            Personvern
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-[color,background-color] duration-200 motion-reduce:transition-none hover:bg-muted hover:text-foreground"
          >
            Markedsplass
          </Link>
        </div>
      </div>
    </footer>
  );
}
