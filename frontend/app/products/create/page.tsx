'use client';

/**
 * @fileOverview  Create listing — a one-screen shell: a slim header row, the
 *                step rail on the left and the active step in a panel that
 *                scrolls inside itself, with Back / Continue pinned below.
 *                The page never scrolls; the step does.
 * @stability     evolving
 */

import Link from 'next/link';
import { ArrowLeft, ChevronDown, CreditCard, Store, WalletCards } from 'lucide-react';
import { MyProductCreationForm } from '@/components/uicustom/product/forms/product-form';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { StatusPill } from '@/components/uicustom/settings/settings-primitives';

export default function MyProductCreationPage() {
  const { user } = useCurrentUserWithStatus();
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
      <section aria-label="Create product" className="mx-auto flex min-h-0 w-full max-w-[1040px] flex-1 flex-col px-4 pb-3 pt-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border/60 pb-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-accent-hover dark:text-brand-accent-light"><Store aria-hidden="true" className="size-3.5" /> Create listing</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">New listing</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {user?.isDemo
                ? 'Demo mode: explore the steps freely. Uploading files and publishing need your own account.'
                : 'Describe it, price it, add files or shipping. Listings stay browse-only until seller checkout opens; a saved PayPal address or wallet does not enable payments.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={user?.isDemo ? 'neutral' : 'warning'}>{user?.isDemo ? 'Demo' : 'Browse-only checkout'}</StatusPill>
            {user?.role === 'OWNER' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="vegaNormalBtn" size="sm" className="min-h-9 gap-1">Owner tools <ChevronDown aria-hidden="true" className="size-3.5 opacity-70" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[120] min-w-56 rounded-xl border-border/70 bg-popover/95 p-1 shadow-e3 backdrop-blur-xl">
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Studio products use Sandbox locally and on Preview, Live in production</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-10 rounded-lg"><Link href="/products/cveggatinterviewpack000001">Fjord Study</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className="min-h-10 rounded-lg"><Link href="/products/cveggatinterviewcredits01">AI credits</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-10 rounded-lg"><Link href="/settings?section=payments"><CreditCard aria-hidden="true" className="mr-2 size-4" />Payments</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className="min-h-10 rounded-lg"><Link href="/settings?section=wallet"><WalletCards aria-hidden="true" className="mr-2 size-4" />Wallet</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link href="/products" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft aria-hidden="true" className="size-4" /> Back to products
            </Link>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <MyProductCreationForm />
        </div>
      </section>
    </div>
  );
}
