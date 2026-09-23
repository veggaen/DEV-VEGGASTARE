/**
 * @fileOverview  Company creation page – responsive two-column layout on lg+.
 * @stability     stable
 */
'use client'

import { MyCompanyCreateForm } from "@/components/uicustom/company/company-create-form";
import { Building2, ArrowLeft, Lightbulb, Shield, Globe, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';

const CompanyCreatePage = () => {
  const { user, isLoading } = useCurrentUserWithStatus();
  const isDemo = isDemoUserId(user?.id);
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950/95">
      {/* ── Breadcrumb bar (sticky) ── */}
      <div className="border-b border-zinc-200/70 dark:border-zinc-800/40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <Link
            href="/companies"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" />
            Companies
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="hidden sm:flex items-center justify-center size-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 ring-1 ring-emerald-200 dark:ring-emerald-800">
            <Building2 className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Create Your Company
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Set up your business profile to start selling products and managing your team
            </p>
          </div>
        </div>

        {/* Two-column: form + sidebar on lg */}
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-10">
          {/* Form */}
          <div className="min-w-0 max-w-xl">
            {isLoading ? <p role="status">Loading your workspace…</p> : isDemo ? (
              <section aria-label="Company setup preview" className="rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-6">
                <h2 className="text-lg font-semibold">Company setup preview</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your demo can browse storefronts, products and checkout. Publishing a company, uploading files and inviting team members require your own account.</p>
                <ol className="mt-5 list-inside list-decimal space-y-3 text-sm"><li>Add your company profile and branding.</li><li>Verify your registered organization, if applicable.</li><li>Invite your team and publish your first product.</li></ol>
                <Link href="/companies" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Explore companies</Link>
              </section>
            ) : user ? <MyCompanyCreateForm /> : <p className="rounded-xl border border-border p-5">Sign in to create your company. <Link className="inline-flex min-h-11 items-center underline" href="/auth/login?callbackUrl=%2Fcompanies%2Fcreate">Sign in</Link></p>}
          </div>

          {/* Sidebar – desktop only */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/40 bg-white dark:bg-zinc-900/50 shadow-sm dark:shadow-none p-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Quick tips
                </h3>
                <ul className="space-y-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <li className="flex gap-3">
                    <Lightbulb className="size-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>Choose a clear, memorable name that represents your brand</span>
                  </li>
                  <li className="flex gap-3">
                    <Shield className="size-4 shrink-0 mt-0.5 text-blue-500" />
                    <span title="Your org link stays pending until verified through the official registered email.">Adding your org number starts legal ownership verification</span>
                  </li>
                  <li className="flex gap-3">
                    <Globe className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span>A website URL helps customers find you online</span>
                  </li>
                  <li className="flex gap-3">
                    <ExternalLink className="size-4 shrink-0 mt-0.5 text-violet-500" />
                    <span>
                      Need to register a business first?{' '}
                      <a className="underline underline-offset-2" href="https://www.altinn.no/en/start-and-run-business/" target="_blank" rel="noreferrer">Altinn</a>{' '}
                      /{' '}
                      <a className="underline underline-offset-2" href="https://www.brreg.no/en/" target="_blank" rel="noreferrer">Brønnøysund</a>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default CompanyCreatePage;
