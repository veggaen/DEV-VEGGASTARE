'use client';

/**
 * PulseStatsBar — Real-time stats display for a pulse.
 * 
 * Receives initial values from server-rendered page, then subscribes to
 * Pusher for live updates when reactions change.
 */

import { useState, useCallback } from 'react';
import usePusher from '@/hooks/usePusher';
import { FiMessageCircle, FiEye, FiRepeat, FiTrendingUp } from 'react-icons/fi';

interface PulseStatsBarProps {
  pulseId: string;
  initialStats: {
    messageCount: number;
    viewCount: number;
    repulseCount: number;
    positivePulseCount: number;
    reachScore: number;
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

  const totalReplies = stats.messageCount - 1; // exclude root message

  return (
    <div className="flex items-center gap-5 text-sm text-muted-foreground border-y border-border/50 py-3 mb-4">
      {totalReplies > 0 && (
        <span className="flex items-center gap-1.5">
          <FiMessageCircle className="w-4 h-4" />
          {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
        </span>
      )}
      {stats.viewCount > 0 && (
        <span className="flex items-center gap-1.5">
          <FiEye className="w-4 h-4" />
          {stats.viewCount.toLocaleString()} views
        </span>
      )}
      {stats.repulseCount > 0 && (
        <span className="flex items-center gap-1.5">
          <FiRepeat className="w-4 h-4" />
          {stats.repulseCount} repulses
        </span>
      )}
      {stats.positivePulseCount > 0 && (
        <span className="flex items-center gap-1.5">
          ❤️ {stats.positivePulseCount}
        </span>
      )}
      {stats.reachScore > 0 && (
        <span className="flex items-center gap-1.5">
          <FiTrendingUp className="w-4 h-4 text-amber-500" />
          {Math.round(stats.reachScore)} reach
        </span>
      )}
    </div>
  );
}
