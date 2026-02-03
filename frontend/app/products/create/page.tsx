'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MyProductCreationForm } from '@/components/uicustom/product/forms/product-form';

export default function MyProductCreationPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="h-full w-full overflow-y-auto">
      {/* Main content: scrollable within the overflow-hidden parent */}
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-3 pb-8 sm:px-6 lg:px-8">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col gap-3"
        >
          {/* Header row */}
          <header>
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                <span>Marketplace</span>
                <span className="text-muted-foreground/50">/</span>
                <span>Create listing</span>
              </div>

              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                Create a new listing
              </h1>

              <p className="max-w-3xl text-sm text-muted-foreground">
                Add details, pricing, shipping, images, then publish. Designed to fit on one screen on desktop.
              </p>
            </div>
          </header>

          {/* Form section - grows with content */}
          <motion.section
            className="relative rounded-xl border border-border bg-card shadow-sm"
            initial={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.99 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
          >
            <div className="p-3 sm:p-4 md:p-6">
              <MyProductCreationForm />
            </div>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}