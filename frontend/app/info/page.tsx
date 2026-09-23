/** @fileOverview Public product story and contact route; readable before hydration. @stability stable */
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ShieldCheck, PackageOpen, MessageSquare } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About & Contact',
  description: 'Veggat is a trust-first marketplace for digital products. Explore the free demo, private downloads and credit-gated AI, or contact the builder.',
};

const linkStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-center text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const steps = [
  { icon: PackageOpen, title: 'Explore the marketplace', text: 'Browse the reviewer products and add a digital file pack or AI credits to your basket.' },
  { icon: ShieldCheck, title: 'Try a free demo order', text: 'Use an isolated demo workspace. Checkout shows a 0 NOK receipt and gives you real sample JPG and TXT downloads, without opening a payment provider.' },
  { icon: MessageSquare, title: 'See the safeguards', text: 'The demo starts with five one-time AI credits. Message costs are shown before sending, and premium requests stop when the balance runs out.' },
];
const architecture = [
  { name: 'Next.js', purpose: 'The reference client: storefront, account screens and server-side application routes.' },
  { name: 'Hapi', purpose: 'A separate integration core for shipping, warehouse services and realtime connections.' },
  { name: 'PostgreSQL & Prisma', purpose: 'Products, orders, entitlements and an atomic AI-credit ledger.' },
  { name: 'NextAuth', purpose: 'Account sessions and protected routes, with provider sign-in and email/password flows.' },
];

export default function InfoPage() {
  return <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:space-y-10 sm:px-6 sm:py-12 lg:px-8">
    <header className="max-w-3xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About Veggat</p>
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Digital products. Clear ownership.</h1>
      <p className="text-pretty text-base leading-relaxed text-muted-foreground">Veggat is a trust-first marketplace for digital products. Explore a complete buying journey, receive private downloads and try AI with clear usage costs.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/products" className={linkStyle + ' border-brand-accent bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-hover'}>Browse products</Link>
        <Link href="/" className={linkStyle}>Open the free demo</Link>
        <Link href="#contact" className={linkStyle}>Contact the builder</Link>
      </div>
    </header>

    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="demo-walkthrough-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 id="demo-walkthrough-title" className="text-xl font-semibold">A demo you can actually use</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">No shared password and no card required. Each visitor gets a separate temporary workspace.</p>
          <ol className="mt-6 space-y-6">
            {steps.map(({ icon: Icon, title, text }, index) => <li key={title} className="flex min-w-0 gap-3 sm:gap-4">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted"><Icon className="size-5 text-brand-accent" /></span>
              <div className="min-w-0 space-y-1">
                <h3 className="text-base font-medium">{index + 1}. {title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </li>)}
          </ol>
          <p className="mt-6 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">Real purchases are separate from the demo and use PayPal only when checkout is configured. Products and credits are never granted from a return URL alone.</p>
        </section>

        <section aria-labelledby="architecture-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 id="architecture-title" className="text-xl font-semibold">How it fits together</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">One product, with clear boundaries between the interface, integrations and durable data.</p>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            {architecture.map(item => <div key={item.name} className="min-w-0">
              <dt className="text-sm font-semibold">{item.name}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.purpose}</dd>
            </div>)}
          </dl>
        </section>

        <section aria-labelledby="experiments-title" className="rounded-2xl border border-border p-5 sm:p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Experimental modules</p>
          <h2 id="experiments-title" className="text-xl font-semibold">More to explore</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pulse, polls, trading and warehouse tools explore the same underlying platform. They are not required for the digital-product demo, and some controls are intentionally read-only in demo mode.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/pulse" className={linkStyle}>Explore Pulse</Link>
            <Link href="/analytics" className={linkStyle}>View analytics previews</Link>
          </div>
        </section>
      </div>

      <aside aria-label="About the builder" className="min-w-0 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <a href="https://github.com/veggaen" target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-center gap-4 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <Image src="https://avatars.githubusercontent.com/veggaen" alt="" width={96} height={96} sizes="96px" className="size-20 shrink-0 rounded-full border border-border object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105" />
            <div className="min-w-0"><p className="font-semibold">Veggaen</p><p className="mt-1 text-sm text-muted-foreground">Builder of Veggat</p><span className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4">GitHub <ArrowUpRight aria-hidden="true" className="size-4" /><span className="sr-only"> (opens in a new tab)</span></span></div>
          </a>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">A full-stack project focused on useful workflows, explicit permissions and responsive interfaces.</p>
        </div>
        <div className="rounded-2xl border border-border p-5 sm:p-6">
          <h2 className="text-lg font-semibold">What matters here</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Server-owned prices and verified fulfillment.</li>
            <li>Private, time-limited downloads checked against your order.</li>
            <li>Prepaid AI limits with failure refunds and a platform spending cap.</li>
            <li>Keyboard access, readable loading states and mobile-first reflow.</li>
          </ul>
          <Link href="/pricing" className={linkStyle + ' mt-5 w-full'}>See pricing & limits</Link>
        </div>
      </aside>
    </div>

    <section id="contact" tabIndex={-1} aria-labelledby="contact-title" className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:p-8">
      <h2 id="contact-title" className="text-2xl font-semibold">Contact</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Want to discuss the project, collaborate or report a bug? Find Veggaen on GitHub. Do not include passwords, API keys or private account details in public messages.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href="https://github.com/veggaen" target="_blank" rel="noopener noreferrer" className={linkStyle}>Contact via GitHub <ArrowUpRight aria-hidden="true" className="size-4" /><span className="sr-only">(opens in a new tab)</span></a>
        <Link href="/products" className={linkStyle}>Explore marketplace</Link>
        <Link href="/" className={linkStyle}>Back home</Link>
      </div>
    </section>
  </div>;
}
