'use client';

/**
 * @fileOverview  Nexus — the business hub: one screen of doors to profile,
 *                community, the job board and business tools. Each group is a
 *                trailing-box grid; cards keep their own surface and the box
 *                is the hover.
 * @stability     evolving
 */

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { CiInboxIn } from 'react-icons/ci';
import { SiGooglebigquery } from 'react-icons/si';
import { FiArrowRight, FiBriefcase, FiGrid, FiMessageCircle, FiSettings, FiShoppingBag, FiUser } from 'react-icons/fi';
import { MdBusiness } from 'react-icons/md';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { cn } from '@/lib/utils';

type Tint = 'accent' | 'violet' | 'rose' | 'amber' | 'muted';
const tint: Record<Tint, string> = {
  accent: 'bg-brand-accent/10 text-brand-accent',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  muted: 'bg-foreground/[0.06] text-muted-foreground',
};

const GROUPS: { section: string; items: { href: string; label: string; description: string; icon: React.ComponentType<{ className?: string }>; tint: Tint }[] }[] = [
  { section: 'Account', items: [
    { href: '/profile', label: 'My profile', description: 'View and customise your public profile', icon: FiUser, tint: 'violet' },
    { href: '/settings', label: 'Settings', description: 'Account, security and preferences', icon: FiSettings, tint: 'muted' },
  ] },
  { section: 'Community', items: [
    { href: '/pulse', label: 'Pulse', description: 'Public feed and discussions', icon: PulseHeart, tint: 'rose' },
    { href: '/conversations', label: 'Messages', description: 'Your private conversations', icon: FiMessageCircle, tint: 'accent' },
  ] },
  { section: 'Job board', items: [
    { href: '/jobs', label: 'Browse requests', description: 'Find work opportunities', icon: CiInboxIn, tint: 'violet' },
    { href: '/jobs/post', label: 'Post a request', description: 'Get quotes from companies', icon: SiGooglebigquery, tint: 'accent' },
  ] },
  { section: 'Business', items: [
    { href: '/companies', label: 'Companies', description: 'Manage your companies', icon: MdBusiness, tint: 'amber' },
    { href: '/my-sales', label: 'My sales', description: 'Orders containing your products', icon: FiBriefcase, tint: 'accent' },
    { href: '/products', label: 'Marketplace', description: 'Browse and list products', icon: FiGrid, tint: 'muted' },
    { href: '/my-orders', label: 'My orders', description: 'Receipts and purchases', icon: FiShoppingBag, tint: 'muted' },
  ] },
];

export default function NexusPage() {
  const reduceMotion = useReducedMotion();
  const { user, status } = useCurrentUserWithStatus();

  // If the session resolved and the visitor is NOT authenticated, sign out to
  // clear any stale/invalid session cookie (which the edge middleware would
  // otherwise treat as "logged in" and bounce us back here → redirect loop),
  // then land on the login page. `force=1` tells middleware to let us stay.
  useEffect(() => {
    if (status === 'unauthenticated') signOut({ callbackUrl: '/auth/login?force=1' });
  }, [status]);

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{status === 'loading' ? 'Loading…' : 'Redirecting to sign in…'}</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-20 top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -10, 0], y: [0, 8, 0], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'radial-gradient(closest-side, hsl(var(--brand-accent) / 0.14), hsl(var(--brand-accent) / 0.05), transparent 70%)' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.div initial={reduceMotion ? undefined : { opacity: 0, y: 14 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <PageHeader eyebrow="Your workspace" title="Nexus" description="Your command centre: profile, community, jobs and business tools in one place." className="mb-8" />

          <div className="space-y-8">
            {GROUPS.map((group, index) => (
              <motion.section key={group.section} aria-label={group.section} initial={reduceMotion ? undefined : { opacity: 0, y: 12 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.05 }}>
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">{group.section}</h2>
                <HoverChaser className="grid gap-3 sm:grid-cols-2" boxClassName="rounded-2xl">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-chase
                      className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-e1 backdrop-blur-xl transition-[transform,border-color] duration-200 motion-safe:hover:-translate-y-0.5 hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', tint[item.tint])}><item.icon className="size-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="block text-xs text-muted-foreground">{item.description}</span>
                      </span>
                      <FiArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-brand-accent" />
                    </Link>
                  ))}
                </HoverChaser>
              </motion.section>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground/70">
            Press <kbd className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl</kbd> + <kbd className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">K</kbd> to open the command palette anywhere
          </p>
        </motion.div>
      </div>
    </div>
  );
}
