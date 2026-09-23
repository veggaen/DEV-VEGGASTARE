/** @fileOverview Bounded, first-paint-readable account entry layout. @stability stable */
import type { ReactNode } from "react";
import Link from "next/link";
import { Download, ShieldCheck, Sparkles } from "lucide-react";
import { AuthNavigation } from "./auth-navigation";

export function AuthPageShell({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return <div className="w-full min-w-0 bg-background text-foreground">
    <AuthNavigation />
    <div data-auth-canvas className="mx-auto grid w-full max-w-7xl min-w-0 gap-8 px-4 pb-8 pt-3 sm:px-6 sm:pb-12 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pt-8">
      <aside className="hidden min-w-0 self-start rounded-3xl border border-border bg-card p-8 lg:block xl:p-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-accent">Veggat marketplace</p>
        <h2 className="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-tight">Digital products.<br />Built on trust.</h2>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">Discover digital products, keep your purchases in one place, and get secure access to your files.</p>
        <ul className="mt-8 space-y-6">
          {[{ Icon: Download, title: "Your files, in your account", text: "Private downloads with time-limited links." },
            { Icon: ShieldCheck, title: "Clear checkout", text: "Review the price and items before you pay." },
            { Icon: Sparkles, title: "Explore before you buy", text: "Try the free demo. No card or payment required." }].map(({ Icon, title: label, text }) =>
            <li key={label} className="flex items-start gap-3"><Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-accent" /><div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p></div></li>)}
        </ul>
        <Link href="/products" className="mt-8 inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-brand-accent hover:underline focus-visible:outline-2 focus-visible:outline-ring">Browse the marketplace →</Link>
      </aside>
      <div className="mx-auto w-full min-w-0 max-w-md">
        <header className="mb-6"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><div className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</div></header>
        {children}
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">By continuing, you agree to our <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">Terms</Link> and <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>.</p>
      </div>
    </div>
  </div>;
}
