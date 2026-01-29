'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MyProductCreationForm } from '@/components/uicustom/product/forms/product-form';

export default function MyProductCreationPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Animated background effects with noise overlay to prevent gradient banding */}
      <div className="pointer-events-none fixed inset-0 noise-overlay">
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/5" />
        
        {/* Primary emerald/sky glow - top right */}
        <motion.div
          className="absolute -right-20 top-20 h-[600px] w-[600px] rounded-full"
          animate={
            reduceMotion
              ? undefined
              : { x: [0, -20, 0], y: [0, 15, 0], opacity: [0.12, 0.24, 0.12], scale: [1, 1.08, 1] }
          }
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(closest-side, rgba(34,197,94,0.27) 0%, rgba(34,197,94,0.18) 30%, rgba(56,189,248,0.12) 55%, rgba(34,197,94,0.03) 80%, rgba(34,197,94,0) 100%)',
            mixBlendMode: 'screen',
            filter: 'blur(60px)',
          }}
        />
        
        {/* Secondary violet/pink glow - bottom left */}
        <motion.div
          className="absolute -left-20 bottom-10 h-[650px] w-[650px] rounded-full"
          animate={
            reduceMotion
              ? undefined
              : { x: [0, 22, 0], y: [0, -16, 0], opacity: [0.10, 0.22, 0.10], scale: [1, 1.06, 1] }
          }
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(closest-side, rgba(167,139,250,0.20) 0%, rgba(167,139,250,0.12) 30%, rgba(236,72,153,0.08) 55%, rgba(56,189,248,0.02) 80%, rgba(56,189,248,0) 100%)',
            mixBlendMode: 'screen',
            filter: 'blur(60px)',
          }}
        />

        {/* Subtle center glow */}
        <motion.div
          className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full"
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0.05, 0.12, 0.05], scale: [0.9, 1.1, 0.9] }
          }
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(closest-side, rgba(56,189,248,0.17) 0%, rgba(56,189,248,0.10) 35%, rgba(167,139,250,0.05) 60%, transparent 85%)',
            mixBlendMode: 'screen',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="space-y-6"
        >
          {/* Header section */}
          <header className="text-center sm:text-left">
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm"
            >
              <motion.span
                className="h-2 w-2 rounded-full bg-emerald-400"
                aria-hidden
                animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span>Marketplace</span>
              <span className="text-white/30">/</span>
              <span>Create listing</span>
            </motion.div>
            
            <motion.h1
              className="mt-3 text-2xl font-semibold text-white sm:text-3xl lg:text-4xl"
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
            >
              Create a new listing
            </motion.h1>
            
            <motion.p
              className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base"
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
            >
              Fill in the details below to list your product on the marketplace. 
              Add images, set your price, and reach buyers instantly.
            </motion.p>
          </header>

          {/* Form container with glass effect */}
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/25 backdrop-blur-xl"
            initial={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.2 }}
          >
            {/* Subtle top gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <div className="p-4 sm:p-6 lg:p-8">
              <MyProductCreationForm />
            </div>
          </motion.div>

          {/* Helper text */}
          <motion.p
            className="text-center text-xs text-white/40"
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            By creating a listing, you agree to our marketplace guidelines and terms of service.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}