'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, FlaskConical, Store, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { MyProductCreationForm } from '@/components/uicustom/product/forms/product-form';
import { Button } from '@/components/ui/button';
import { ensureOwnerCheckoutTestProductAction } from '@/actions/products';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';

function OwnerCheckoutTestPanel() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUserWithStatus();
  const [isPending, startTransition] = useTransition();

  if (isLoading || user?.role !== 'OWNER') {
    return null;
  }

  const handleCreateTestProduct = () => {
    startTransition(async () => {
      const result = await ensureOwnerCheckoutTestProductAction();
      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      router.push(`/products/${result.productId}`);
      router.refresh();
    });
  };

  return (
    <details className="mt-8 border-t border-border pt-5 text-sm">
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Owner checkout tools
      </summary>
      <div className="mt-4 flex flex-col gap-3 border-l border-emerald-500/30 pl-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <FlaskConical className="h-4 w-4 text-emerald-500" />
            Live $1 digital test listing
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Seed a buyable product for checkout verification without interrupting the listing form.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleCreateTestProduct}
            disabled={isPending}
            className="h-9 rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isPending ? 'Preparing...' : 'Create test listing'}
          </Button>
          <Button asChild variant="outline" className="h-9 rounded-lg bg-transparent">
            <Link href="/settings?section=payments">
              <CreditCard className="mr-2 h-4 w-4" />
              Payments
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-9 rounded-lg bg-transparent">
            <Link href="/settings?section=wallet">
              <WalletCards className="mr-2 h-4 w-4" />
              Wallet
            </Link>
          </Button>
        </div>
      </div>
    </details>
  );
}

export default function MyProductCreationPage() {
  return (
    <div className="h-full w-full overflow-y-auto bg-background text-foreground">
      <main className="mx-auto w-full max-w-[1040px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
              Create listing
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              Product details
            </h1>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to products
          </Link>
        </div>

        <MyProductCreationForm />
        <OwnerCheckoutTestPanel />
      </main>
    </div>
  );
}
