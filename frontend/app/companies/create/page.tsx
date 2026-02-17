/**
 * @fileOverview  Company creation page – responsive two-column layout on lg+.
 * @stability     stable
 */
'use client'

import { MyCompanyCreateForm } from "@/components/uicustom/company/company-create-form";
import { Building2, ArrowLeft, Lightbulb, Shield, Globe } from "lucide-react";
import Link from "next/link";

const CompanyCreatePage = () => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950/95">
      {/* ── Breadcrumb bar (sticky) ── */}
      <div className="border-b border-zinc-200/70 dark:border-zinc-800/40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <Link
            href="/companies"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
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
          <div className="min-w-0">
            <MyCompanyCreateForm />
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
                    <span>Adding your org number helps verify your business</span>
                  </li>
                  <li className="flex gap-3">
                    <Globe className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span>A website URL helps customers find you online</span>
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
