"use client";

import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Soft maintenance notice */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-6 py-2">
        <p className="text-center text-xs text-amber-700 dark:text-amber-200/80">
          Pulse, polls, and Web3 trading are experimental modules.
        </p>
      </div>
      
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">Veggat</span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
          <span>© {year}</span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
          <span>Org.nr: 937 051 107</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Link
            href="/info"
            className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors duration-200 motion-reduce:transition-none hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Kontakt
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors duration-200 motion-reduce:transition-none hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Salgsvilkår
          </Link>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors duration-200 motion-reduce:transition-none hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Personvern
          </Link>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors duration-200 motion-reduce:transition-none hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Markedsplass
          </Link>
        </div>
      </div>
    </footer>
  );
}
