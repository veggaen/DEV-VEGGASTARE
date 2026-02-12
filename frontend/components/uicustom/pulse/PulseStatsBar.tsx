'use client';

/**
 * PulseStatsBar — Real-time stats display for a pulse.
 * 
 * Receives initial values from server-rendered page, then subscribes to
 * Pusher for live updates when reactions change.
 */

import { useState, useCallback } from 'react';
import usePusher from '@/hooks/usePusher';
import { FiMessageCircle, FiEye, FiRepeat, FiTrendingUp, FiZap } from 'react-icons/fi';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';

interface PulseStatsBarProps {
  pulseId: string;
  initialStats: {
    messageCount: number;
    viewCount: number;
    repulseCount: number;
    positivePulseCount: number;
    reachScore: number;
    reachMomentum?: number;
  };
}

export function PulseStatsBar({ pulseId, initialStats }: PulseStatsBarProps) {
  const [stats, setStats] = useState(initialStats);

  // Subscribe to real-time reaction updates
  const channelName = `ConversationChannel_${pulseId}`;

  usePusher<{ conversationId: string; positivePulseCount: number; negativePulseCount: number }>(
    channelName,
    'pulse-stats-update',
    useCallback((data) => {
      setStats(prev => ({
        ...prev,
        positivePulseCount: data.positivePulseCount,
      }));
    }, [])
  );

  // Subscribe to new messages to update vibe count
  usePusher<{ message: { id: string } }>(
    channelName,
    'new-message',
    useCallback(() => {
      setStats(prev => ({
        ...prev,
        messageCount: prev.messageCount + 1,
      }));
    }, [])
  );

  // Subscribe to deleted messages to decrement vibe count
  usePusher<{ messageId: string }>(
    channelName,
    'delete-message',
    useCallback(() => {
      setStats(prev => ({
        ...prev,
        messageCount: Math.max(0, prev.messageCount - 1),
      }));
    }, [])
  );

  // Subscribe to view count updates
  usePusher<{ conversationId: string; viewCount: number; uniqueViewCount: number }>(
    channelName,
    'view-update',
    useCallback((data) => {
      setStats(prev => ({
        ...prev,
        viewCount: data.viewCount,
      }));
    }, [])
  );

  // Subscribe to repost count updates
  usePusher<{ conversationId: string; repostCount: number }>(
    channelName,
    'repost-update',
    useCallback((data) => {
      setStats(prev => ({
        ...prev,
        repulseCount: data.repostCount,
      }));
    }, [])
  );

  const totalVibes = Math.max(0, stats.messageCount - 1); // exclude root message

  return (
    <div className="flex items-center gap-5 text-sm text-muted-foreground border-y border-border/50 py-3 mb-4">
      {/* Heartbeats - always show */}
      <span className={`flex items-center gap-1.5 ${stats.positivePulseCount > 0 ? 'text-red-500 dark:text-red-400' : ''}`}>
        <PulseHeart size={16} filled={stats.positivePulseCount > 0} />
        {stats.positivePulseCount}
      </span>
      {/* Vibes - always show */}
      <span className="flex items-center gap-1.5">
        <FiMessageCircle className="w-4 h-4" />
        {totalVibes} {totalVibes === 1 ? 'vibe' : 'vibes'}
      </span>
      {/* Repulses - always show */}
      <span className="flex items-center gap-1.5">
        <FiRepeat className="w-4 h-4" />
        {stats.repulseCount}
      </span>
      {/* Views - always show */}
      <span className="flex items-center gap-1.5">
        <FiEye className="w-4 h-4" />
        {stats.viewCount.toLocaleString()}
      </span>
      {stats.reachScore > 0 && (
        <span className="flex items-center gap-1.5" title={`Lifetime: ${Math.round(stats.reachScore)} • Momentum: ${Math.round(stats.reachMomentum ?? 0)}`}>
          <FiTrendingUp className="w-4 h-4 text-amber-500" />
          {Math.round(stats.reachScore)} reach
          {(stats.reachMomentum ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-emerald-500">
              <FiZap className="w-3 h-3" />
              {Math.round(stats.reachMomentum!)}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
