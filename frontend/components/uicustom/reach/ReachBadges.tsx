'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ReachBadge {
  id: string;
  label: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  description: string;
  earned: boolean;
  progress: number;
}

interface ReachBadgesProps {
  badges: ReachBadge[];
  compact?: boolean;
  className?: string;
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  bronze: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800/50',
    text: 'text-orange-700 dark:text-orange-300',
    glow: 'rgba(234, 88, 12, 0.2)',
  },
  silver: {
    bg: 'bg-zinc-50 dark:bg-zinc-800/30',
    border: 'border-zinc-300 dark:border-zinc-600/50',
    text: 'text-zinc-700 dark:text-zinc-300',
    glow: 'rgba(161, 161, 170, 0.2)',
  },
  gold: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700/50',
    text: 'text-amber-700 dark:text-amber-300',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  platinum: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-700/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    glow: 'rgba(99, 102, 241, 0.25)',
  },
  diamond: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-200 dark:border-cyan-700/50',
    text: 'text-cyan-700 dark:text-cyan-300',
    glow: 'rgba(6, 182, 212, 0.25)',
  },
};

export default function ReachBadges({ badges, compact, className = '' }: ReachBadgesProps) {
  const reduceMotion = useReducedMotion();
  const earned = badges.filter(b => b.earned);
  const inProgress = badges.filter(b => !b.earned).sort((a, b) => b.progress - a.progress);

  if (compact) {
    // Compact: show only earned badges as small icons
    return (
      <div className={`flex flex-wrap gap-1.5 ${className}`}>
        {earned.map(badge => (
          <div
            key={badge.id}
            title={`${badge.label}: ${badge.description}`}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${TIER_COLORS[badge.tier].bg} ${TIER_COLORS[badge.tier].border} ${TIER_COLORS[badge.tier].text}`}
          >
            <span>{badge.icon}</span>
            <span>{badge.label}</span>
          </div>
        ))}
        {earned.length === 0 && (
          <span className="text-xs text-muted-foreground">No achievements reached yet</span>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Earned badges */}
      {earned.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Reached ({earned.length})
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {earned.map(badge => {
              const colors = TIER_COLORS[badge.tier];
              return (
                <motion.div
                  key={badge.id}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border-2 px-3 py-2.5 ${colors.bg} ${colors.border}`}
                  style={{ boxShadow: `0 0 12px ${colors.glow}` }}
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold text-sm ${colors.text}`}>{badge.label}</div>
                    <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{badge.description}</div>
                  </div>
                  <span className="text-xs font-bold text-green-500">✓</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* In-progress badges */}
      {inProgress.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Within reach ({inProgress.length})
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {inProgress.map(badge => {
              const progress = Math.max(0, Math.min(100, badge.progress));
              return (
                <div
                  key={badge.id}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
                >
                  <span className="text-2xl grayscale">{badge.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-foreground">{badge.label}</div>
                    <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{badge.description}</div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-200"
                        style={{
                          transform: `scaleX(${progress / 100})`,
                          backgroundColor: TIER_COLORS[badge.tier].glow.replace('0.2', '0.8'),
                        }}
                      />
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{progress}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export type { ReachBadge };
