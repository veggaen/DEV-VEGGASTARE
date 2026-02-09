'use client';

/**
 * PulseReachTracker — Client wrapper that activates the useReachTracker hook
 * for pulse detail pages. Renders no visible UI; purely behavioral.
 *
 * Drop this into any pulse page to auto-track scroll depth, dwell time,
 * tab visibility, hover deep-reads, copy events, and return visits.
 */

import { useReachTracker } from '@/hooks/use-reach-tracker';

interface PulseReachTrackerProps {
  conversationId: string;
  companyId?: string;
}

export function PulseReachTracker({ conversationId, companyId }: PulseReachTrackerProps) {
  useReachTracker({
    conversationId,
    companyId,
    trackScroll: true,
    trackHovers: true,
    trackCopy: true,
  });

  return null; // No visible UI — just tracking behavior
}
