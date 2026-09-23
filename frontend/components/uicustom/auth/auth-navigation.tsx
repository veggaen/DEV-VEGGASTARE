"use client";
/** @fileOverview In-flow navigation and theme control shared by auth pages. @stability stable */
import Link from "next/link";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useClientReady } from '@/hooks/use-client-ready';

export function AuthNavigation() {
  const ready = useClientReady();
  const { resolvedTheme, setTheme } = useTheme();
  return <nav aria-label="Account navigation" className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
      <ArrowLeft aria-hidden className="size-4" /> Back to Veggat
    </Link>
    <button type="button" disabled={!ready} aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
      <Sun aria-hidden className="hidden size-5 dark:block" /><Moon aria-hidden className="size-5 dark:hidden" />
    </button>
  </nav>;
}
