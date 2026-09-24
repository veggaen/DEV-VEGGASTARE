/** @fileOverview Honest promotion availability with useful marketplace destinations. @stability stable */
import Link from 'next/link';
import { ArrowRight, ChevronRight, Gift, ShoppingBag, Tag, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiteFooter from '@/components/uicustom/site-footer';
import { catalogFrame } from './CatalogHeader';
import { CREDIT_PRICE_TIERS, MIN_PURCHASE_CREDITS, MAX_PURCHASE_CREDITS } from '@/lib/ai-credit-purchase';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';

const copy = {
  deals: {
    title: 'Daily deals',
    description: 'Discover digital products with clear pricing. Scheduled daily promotions are not available yet.',
    heading: 'No daily promotion is running here',
    detail: 'Browse the marketplace at listed prices, or explore prepaid AI credits with standard volume pricing. There is no countdown or coupon to claim.',
    icon: Tag,
    question: 'Will a promotion change my existing order?',
    answer: 'The price confirmed at checkout belongs to that order. Browsing this page does not change your cart, charge your payment method or apply a discount.',
  },
  members: {
    title: 'Member discounts',
    description: 'A place for future member offers. There is no paid membership or exclusive discount to unlock here today.',
    heading: 'Member-only offers are not available yet',
    detail: 'You do not need to join a membership to browse products. The current AI-credit volume pricing is available to everyone buying eligible credits.',
    icon: Gift,
    question: 'Do I need a paid membership to buy credits?',
    answer: 'No. AI credits are a one-time purchase, not a membership subscription. Sign in to keep purchases and usage attached to your account; no membership discount is promised.',
  },
} as const;

const number = (value: number) => new Intl.NumberFormat('en').format(value);

export default function MarketplaceOffers({ kind }: { kind: keyof typeof copy }) {
  const content = copy[kind];
  const Icon = content.icon;
  return <>
    <section aria-labelledby="offers-title" className={`${catalogFrame} min-h-full py-6 sm:py-8 lg:py-10`}>
      <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/products" className="inline-flex min-h-11 items-center rounded-md px-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Marketplace</Link>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        <span aria-current="page" className="min-w-0 px-2">{content.title}</span>
      </nav>
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Marketplace offers</p>
        <h1 id="offers-title" className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{content.title}</h1>
        <p className="mt-3 text-pretty text-base leading-7 text-muted-foreground">{content.description}</p>
      </header>
      <nav aria-label="Marketplace offers" className="mt-6 flex flex-wrap gap-2 border-b border-border pb-5">
        {([{ key: 'all', href: '/products', label: 'All products' }, { key: 'deals', href: '/products/daily-deals', label: 'Daily deals' }, { key: 'members', href: '/products/member-discount', label: 'Member discounts' }] as const).map(item =>
          <Button asChild key={item.key} variant={kind === item.key ? 'secondary' : 'ghost'} className="min-h-11 whitespace-normal">
            <Link href={item.href} aria-current={kind === item.key ? 'page' : undefined}>{item.label}</Link>
          </Button>)}
      </nav>
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="offer-availability" className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-6" /></span>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">Planned · not active</span>
            </div>
            <h2 id="offer-availability" className="mt-5 text-balance text-xl font-semibold">{content.heading}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.detail}</p>
            <Button asChild className="mt-6 min-h-11 w-full gap-2 whitespace-normal sm:w-auto"><Link href="/products">Browse marketplace<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></Button>
          </section>
          <section aria-labelledby="offers-help" className="rounded-2xl border border-border p-5 sm:p-7">
            <h2 id="offers-help" className="text-lg font-semibold">Before you buy</h2>
            <details className="mt-3 group">
              <summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{content.question}</summary>
              <p className="pb-3 text-sm leading-6 text-muted-foreground">{content.answer}</p>
            </details>
            <Link href="/terms" className="inline-flex min-h-11 items-center rounded-md text-sm underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">Read the sales terms</Link>
          </section>
        </div>
        <section aria-labelledby="available-now" className="min-w-0 rounded-2xl border border-border bg-muted/30 p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Available now</p>
          <h2 id="available-now" className="mt-3 flex items-center gap-2 text-xl font-semibold"><Zap aria-hidden="true" className="size-5 shrink-0 text-primary" />AI credit volume pricing</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Choose any whole amount from {number(MIN_PURCHASE_CREDITS)} to {number(MAX_PURCHASE_CREDITS)} credits on the product page. These are standard quantity-based prices, not a daily or members-only promotion.</p>
          <dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-background px-4">
            {CREDIT_PRICE_TIERS.map((tier, index) => <div key={tier.upTo} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-4 text-sm">
              <dt className="font-medium tabular-nums">Credits {number(index ? CREDIT_PRICE_TIERS[index - 1].upTo + 1 : 1)}–{number(tier.upTo)}</dt>
              <dd className="text-muted-foreground">{tier.discountBps ? `${number(tier.discountBps / 100)}% off these credits` : 'Base rate'}</dd>
            </div>)}
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Each reduction applies only to credits within that band, not to the entire purchase. The product page shows your calculated total before checkout.</p>
          <Button asChild variant="outline" className="mt-5 min-h-11 w-full gap-2 whitespace-normal"><Link href={`/products/${SHOWCASE_PRODUCTS.credits.id}`}>Choose AI credits<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></Button>
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag aria-hidden="true" className="size-4 shrink-0" />Want to try a digital download?</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">The Veggat Interview Pack is a clearly labelled reviewer listing with image and text files. Inspect what is included before buying.</p>
            <Link href={`/products/${SHOWCASE_PRODUCTS.interviewPack.id}`} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">View Interview Pack<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link>
          </div>
        </section>
      </div>
    </section>
    <SiteFooter />
  </>;
}
