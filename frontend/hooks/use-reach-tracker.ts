/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Reach 7-Pillar System — Client-Side Interaction Tracker
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Lightweight client-side tracker that captures micro-interactions for the
 * 7-pillar reach system:
 *   - Dwell time (how long user is active on page)
 *   - Scroll depth (how far they scroll)
 *   - Deep reads (hover >3s over content sections)
 *   - Tab visibility (tabbed in vs tabbed out)
 *   - Clicks on interactive elements
 *   - Return visits (revisit detection)
 *   - Copy events (content copied to clipboard)
 *
 * Uses navigator.sendBeacon() for reliable unload sends.
 * Batches events and flushes every 10s or on page unload.
 *
 * Usage in a React component:
 *   const tracker = useReachTracker({ conversationId: 'xxx' });
 *   // Auto-tracks scroll, dwell, tab focus.
 *   // Manual: tracker.trackClick('comment-123');
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type EngagementEventType =
  | 'CLICK'
  | 'HOVER_DEEP_READ'
  | 'SCROLL_DEPTH'
  | 'DWELL_TIME'
  | 'SAVE_BOOKMARK'
  | 'COPY_TEXT'
  | 'TAB_REFOCUS'
  | 'RETURN_VISIT'
  | 'PRODUCT_VIEW'
  | 'PRODUCT_CLICK'
  | 'SHARE_EXTERNAL';

interface TrackedEvent {
  eventType: EngagementEventType;
  details?: Record<string, unknown>;
  timestamp: number;
}

interface TrackerConfig {
  conversationId?: string;
  productId?: string;
  companyId?: string;
  /** Flush interval in ms (default 10000) */
  flushIntervalMs?: number;
  /** Enable scroll depth tracking (default true) */
  trackScroll?: boolean;
  /** Enable dwell time tracking (default true) */
  trackDwell?: boolean;
  /** Enable hover deep-read tracking (default true) */
  trackHovers?: boolean;
  /** Enable copy event tracking (default true) */
  trackCopy?: boolean;
}

// ─── Session ID ──────────────────────────────────────────────────────────────

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem('reach_session_id');
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem('reach_session_id', sessionId);
  }
  return sessionId;
}

// ─── Return Visit Detection ──────────────────────────────────────────────────

function checkReturnVisit(targetId: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = `reach_last_visit_${targetId}`;
  const last = localStorage.getItem(key);
  const now = Date.now();
  localStorage.setItem(key, String(now));

  if (last) {
    const gapMs = now - parseInt(last, 10);
    return gapMs > 60 * 60 * 1000; // >1 hour gap = return visit
  }
  return false;
}

// ─── Flush Function ──────────────────────────────────────────────────────────

function flushEvents(
  events: TrackedEvent[],
  config: TrackerConfig,
  sessionId: string
) {
  if (events.length === 0) return;

  const payload = JSON.stringify({
    conversationId: config.conversationId,
    productId: config.productId,
    companyId: config.companyId,
    sessionId,
    events: events.map((e) => ({
      eventType: e.eventType,
      details: e.details,
      timestamp: e.timestamp,
    })),
  });

  // Use sendBeacon for reliable delivery on unload
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/interact', blob);
  } else {
    // Fallback to fetch
    fetch('/api/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Silent fail — beacons are best-effort
    });
  }
}

// ─── React Hook ──────────────────────────────────────────────────────────────

export function useReachTracker(config: TrackerConfig) {
  const eventsRef = useRef<TrackedEvent[]>([]);
  const startTimeRef = useRef(0);
  const activeTimeRef = useRef(0);
  const isActiveRef = useRef(true);
  const lastActiveRef = useRef(0);
  const maxScrollRef = useRef(0);
  const scrollTrackedRef = useRef(false);
  const sessionIdRef = useRef('');
  const configRef = useRef(config);

  // Keep config ref current
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Initialize time refs on mount (avoids impure Date.now() during render)
  useEffect(() => {
    const now = Date.now();
    if (startTimeRef.current === 0) startTimeRef.current = now;
    if (lastActiveRef.current === 0) lastActiveRef.current = now;
  }, []);

  // Queue an event
  const queueEvent = useCallback(
    (eventType: EngagementEventType, details?: Record<string, unknown>) => {
      eventsRef.current.push({
        eventType,
        details,
        timestamp: Date.now(),
      });
    },
    []
  );

  // Manual tracking methods
  const trackClick = useCallback(
    (element: string, details?: Record<string, unknown>) => {
      queueEvent('CLICK', { element, ...details });
    },
    [queueEvent]
  );

  const trackProductClick = useCallback(
    (productId: string) => {
      queueEvent('PRODUCT_CLICK', { productId });
    },
    [queueEvent]
  );

  const trackShare = useCallback(
    (platform: string) => {
      queueEvent('SHARE_EXTERNAL', { platform });
    },
    [queueEvent]
  );

  const trackSave = useCallback(() => {
    queueEvent('SAVE_BOOKMARK');
  }, [queueEvent]);

  // Initialize all tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;

    sessionIdRef.current = getSessionId();
    startTimeRef.current = Date.now();
    activeTimeRef.current = 0;
    isActiveRef.current = true;
    lastActiveRef.current = Date.now();
    maxScrollRef.current = 0;
    scrollTrackedRef.current = false;

    // Check for return visit
    const targetId =
      config.conversationId || config.productId || config.companyId || '';
    if (targetId && checkReturnVisit(targetId)) {
      queueEvent('RETURN_VISIT', { targetId });
    }

    if (config.productId) {
      queueEvent('PRODUCT_VIEW', { productId: config.productId });
    }

    // ── Tab Visibility ─────────────────────────────────────────────────
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        isActiveRef.current = true;
        lastActiveRef.current = Date.now();
        queueEvent('TAB_REFOCUS');
      } else {
        if (isActiveRef.current) {
          activeTimeRef.current += Date.now() - lastActiveRef.current;
        }
        isActiveRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // ── Scroll Depth ───────────────────────────────────────────────────
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight > 0) {
          const depth = Math.round((window.scrollY / scrollHeight) * 100);
          if (depth > maxScrollRef.current) {
            maxScrollRef.current = depth;
          }
          // Track when >75% scrolled (once)
          if (depth >= 75 && !scrollTrackedRef.current) {
            scrollTrackedRef.current = true;
            queueEvent('SCROLL_DEPTH', { depth });
          }
        }
      }, 200);
    };
    if (config.trackScroll !== false) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    // ── Hover Deep-Read ────────────────────────────────────────────────
    const hoverTimers = new Map<Element, ReturnType<typeof setTimeout>>();
    const handleMouseEnter = (e: Event) => {
      const target = e.currentTarget as Element;
      const timer = setTimeout(() => {
        const identifier =
          target.getAttribute('data-reach-id') ||
          target.id ||
          target.className.substring(0, 50);
        queueEvent('HOVER_DEEP_READ', {
          element: identifier,
          durationMs: 3000,
        });
        hoverTimers.delete(target);
      }, 3000); // 3 second hover = deep read
      hoverTimers.set(target, timer);
    };
    const handleMouseLeave = (e: Event) => {
      const target = e.currentTarget as Element;
      const timer = hoverTimers.get(target);
      if (timer) {
        clearTimeout(timer);
        hoverTimers.delete(target);
      }
    };

    const hoverTargets: Element[] = [];
    if (config.trackHovers !== false) {
      // Track hovers on article sections, comments, images
      const selectors = [
        '[data-reach-hover]',
        'article',
        '[role="article"]',
        '.comment',
        '.vibe-message',
        '.pulse-content',
      ];
      const elements = document.querySelectorAll(selectors.join(','));
      elements.forEach((el) => {
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
        hoverTargets.push(el);
      });
    }

    // ── Copy Event ─────────────────────────────────────────────────────
    const handleCopy = () => {
      queueEvent('COPY_TEXT');
    };
    if (config.trackCopy !== false) {
      document.addEventListener('copy', handleCopy);
    }

    // ── Flush Interval ─────────────────────────────────────────────────
    const flushInterval = setInterval(() => {
      if (eventsRef.current.length > 0) {
        flushEvents(
          [...eventsRef.current],
          configRef.current,
          sessionIdRef.current
        );
        eventsRef.current = [];
      }
    }, config.flushIntervalMs ?? 10000);

    // ── Cleanup + Final Flush ──────────────────────────────────────────
    const handleUnload = () => {
      // Calculate final dwell time
      if (isActiveRef.current) {
        activeTimeRef.current += Date.now() - lastActiveRef.current;
      }

      const dwellMs = activeTimeRef.current;
      if (dwellMs > 1000) {
        // Only track if >1s
        eventsRef.current.push({
          eventType: 'DWELL_TIME',
          details: {
            dwellMs,
            maxScrollDepth: maxScrollRef.current,
            totalTimeMs: Date.now() - startTimeRef.current,
          },
          timestamp: Date.now(),
        });
      }

      flushEvents(
        [...eventsRef.current],
        configRef.current,
        sessionIdRef.current
      );
      eventsRef.current = [];
    };

    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleUnload();
      }
    });

    return () => {
      // Flush remaining events
      handleUnload();
      clearInterval(flushInterval);
      clearTimeout(scrollTimeout);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('beforeunload', handleUnload);
      hoverTimers.forEach((timer) => clearTimeout(timer));
      hoverTargets.forEach((el) => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, [config.conversationId, config.productId, config.companyId, queueEvent, config.flushIntervalMs, config.trackScroll, config.trackHovers, config.trackCopy]);

  return {
    /** Track a click on a named element */
    trackClick,
    /** Track a product-specific click */
    trackProductClick,
    /** Track an external share */
    trackShare,
    /** Track a save/bookmark action */
    trackSave,
    /** Queue any custom event */
    queueEvent,
  };
}
