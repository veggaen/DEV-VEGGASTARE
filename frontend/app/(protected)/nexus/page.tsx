'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useCurrentUser } from '@/hooks/use-current-user';
import { CiInboxIn } from "react-icons/ci";
import { SiGooglebigquery } from "react-icons/si";
import { 
  FiUser, FiSettings, FiMessageCircle, FiBriefcase,
  FiChevronRight, FiGrid
} from 'react-icons/fi';
import { MdBusiness } from 'react-icons/md';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';

export default function NexusPage() {
  const reduceMotion = useReducedMotion();
  const user = useCurrentUser();

  const quickLinks = [
    {
      section: 'Account',
      items: [
        { 
          href: '/profile', 
          label: 'My Profile', 
          description: 'View and customize your public profile',
          icon: FiUser,
          color: 'indigo'
        },
        { 
          href: '/settings', 
          label: 'Settings', 
          description: 'Account, security, and preferences',
          icon: FiSettings,
          color: 'slate'
        },
      ]
    },
    {
      section: 'Community',
      items: [
        { 
          href: '/pulse', 
          label: 'Pulse', 
          description: 'Public feed and discussions',
          icon: PulseHeart,
          color: 'pink'
        },
        { 
          href: '/conversations', 
          label: 'Messages', 
          description: 'Your private conversations',
          icon: FiMessageCircle,
          color: 'blue'
        },
      ]
    },
    {
      section: 'Job Board',
      items: [
        { 
          href: '/jobs', 
          label: 'Browse Requests', 
          description: 'Find work opportunities',
          icon: CiInboxIn,
          color: 'indigo'
        },
        { 
          href: '/jobs/post', 
          label: 'Post a Request', 
          description: 'Get quotes from companies',
          icon: SiGooglebigquery,
          color: 'emerald'
        },
      ]
    },
    {
      section: 'Business',
      items: [
        { 
          href: '/companies', 
          label: 'Companies', 
          description: 'Manage your companies',
          icon: MdBusiness,
          color: 'amber'
        },
        { 
          href: '/products', 
          label: 'Marketplace', 
          description: 'Browse and list products',
          icon: FiGrid,
          color: 'cyan'
        },
      ]
    },
  ];

  const colorClasses: Record<string, string> = {
    indigo: 'text-indigo-500 group-hover:bg-indigo-500/10',
    slate: 'text-slate-500 group-hover:bg-slate-500/10',
    pink: 'text-pink-500 group-hover:bg-pink-500/10',
    blue: 'text-blue-500 group-hover:bg-blue-500/10',
    emerald: 'text-emerald-500 group-hover:bg-emerald-500/10',
    amber: 'text-amber-500 group-hover:bg-amber-500/10',
    cyan: 'text-cyan-500 group-hover:bg-cyan-500/10',
  };

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/5 dark:from-black/15 dark:to-black/5" />
        <motion.div
          className="absolute -right-20 top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -10, 0], y: [0, 8, 0], opacity: [0.06, 0.12, 0.06] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "radial-gradient(closest-side, rgba(99,102,241,0.1), rgba(168,85,247,0.06), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-6 py-10 lg:py-12">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header */}
          <header className="mb-10">
            <h1 className="text-3xl font-semibold text-foreground sm:text-4xl mb-2">Nexus</h1>
            <p className="text-muted-foreground text-sm">Your command center. Quick access to everything.</p>
          </header>

          {/* Quick Links Grid */}
          <div className="space-y-8">
            {quickLinks.map((section, sectionIndex) => (
              <motion.div
                key={section.section}
                initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: sectionIndex * 0.05 }}
              >
                <h2 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
                  {section.section}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/30 p-4 transition-all hover:bg-card/60 hover:border-border"
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${colorClasses[item.color]}`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                      <FiChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Keyboard shortcut hint */}
          <div className="mt-10 text-center">
            <p className="text-xs text-muted-foreground/60">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">K</kbd> to open command palette anywhere
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
