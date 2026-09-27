'use client';

import Link from 'next/link';
import { CreditCard, Store, WalletCards } from 'lucide-react';
import { MyProductCreationForm } from '@/components/uicustom/product/forms/product-form';
import { Button } from '@/components/ui/button';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { PageHeader } from "@/components/uicustom/chrome/page-header";

export default function MyProductCreationPage() {
  const { user } = useCurrentUserWithStatus();
  return (
    <div className="h-full w-full overflow-y-auto bg-background text-foreground">
      <section aria-label="Create product" className="mx-auto w-full max-w-[1040px] px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow={<span className="inline-flex items-center gap-2"><Store aria-hidden="true" className="h-3.5 w-3.5" /> Create listing</span>}
          title="Product details"
          description="Describe what you are selling, set the price and add files or shipping details."
          actions={<Link href="/products" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            Back to products
          </Link>}
          className="mb-5"
        />
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
            <p className="my-3 text-muted-foreground">Veggat Studio products use Sandbox locally and on Preview, and Live in production.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline"><Link href="/products/cveggatinterviewpack000001">Fjord Study</Link></Button>
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
