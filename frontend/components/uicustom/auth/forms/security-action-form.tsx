/** @fileOverview Old email links are informational only, including for mail scanners. @stability stable */
import { CardWrapper } from '../card-wrapper';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
export function MySecurityActionForm() {
  return <CardWrapper headerLabel="Review Web3 settings" backButtonLabel="Back to home" backButtonHref="/">
    <p className="mb-4 text-sm text-muted-foreground">This email link has been retired. Your settings have not changed.</p>
    <Link href="/settings?section=wallet" className={buttonVariants({ className: 'min-h-12 w-full' })}>Open Web3 settings</Link>
  </CardWrapper>;
}
