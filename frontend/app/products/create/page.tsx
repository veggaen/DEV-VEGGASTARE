'use client';

import Link from 'next/link';
import { CreditCard, Store, WalletCards } from 'lucide-react';
import { MyProductCreationForm } from '@/components/uicustom/product/forms/product-form';
import { Button } from '@/components/ui/button';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';

export default function MyProductCreationPage() {
  const { user } = useCurrentUserWithStatus();
  return (
    <div className="h-full w-full overflow-y-auto bg-background text-foreground">
      <section aria-label="Create product" className="mx-auto w-full max-w-[1040px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Store aria-hidden="true" className="h-3.5 w-3.5" /> Create listing
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Product details</h1>
          </div>
          <Link href="/products" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            Back to products
          </Link>
        </div>
        <aside aria-label="Listing availability" className="mb-6 rounded-lg border border-border bg-muted/25 p-4 text-sm leading-relaxed">
          <p className="font-medium">{user?.isDemo ? 'Explore listing creation in demo mode' : 'Publishing does not activate checkout'}</p>
          <p className="mt-1 text-muted-foreground">
            {user?.isDemo ? 'You can explore the form and its review steps. Uploading files and publishing require your own account. ' : ''}
            General listings are browse-only while seller checkout is being completed.
            Saving a PayPal address or wallet does not enable payments.
          </p>
        </aside>
        <MyProductCreationForm />
        {user?.role === 'OWNER' && (
          <details className="mt-8 border-t border-border pt-5 text-sm">
            <summary className="min-h-11 cursor-pointer font-semibold focus-visible:ring-2 focus-visible:ring-ring">Owner checkout tools</summary>
            <p className="my-3 text-muted-foreground">Use the existing reviewer products. Local and Preview use Sandbox; production uses Live. These links do not create products or charge anyone.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline"><Link href="/products/cveggatinterviewpack000001">Interview Pack</Link></Button>
              <Button asChild variant="outline"><Link href="/products/cveggatinterviewcredits01">AI credits</Link></Button>
              <Button asChild variant="outline"><Link href="/settings?section=payments"><CreditCard aria-hidden="true" className="mr-2 h-4 w-4" />Payments</Link></Button>
              <Button asChild variant="outline"><Link href="/settings?section=wallet"><WalletCards aria-hidden="true" className="mr-2 h-4 w-4" />Wallet</Link></Button>
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
