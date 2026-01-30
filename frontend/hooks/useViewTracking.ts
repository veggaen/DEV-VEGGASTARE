'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface ViewTrackingOptions {
  /**
   * Minimum percentage of the element that must be visible (0-1)
   */
  threshold?: number;
  
  /**
   * Minimum time in ms the element must be visible before counting as a view
   */
  minViewTime?: number;
  
  /**
   * Debounce time in ms between view tracking calls
   */
  debounceMs?: number;
  
  /**
   * Whether the user is logged in (affects whether to track)
   */
  isLoggedIn?: boolean;
  
  /**
   * Callback when view is tracked
   */
  onViewTracked?: (result: ViewTrackResult) => void;
}

interface ViewTrackResult {
  conversationId: string;
  success: boolean;
  strength?: number;
  strengthCategory?: string;
  isFirstView?: boolean;
  verificationTier?: string;
}

// Track which conversations we've already sent view requests for in this session
const viewedInSession = new Set<string>();
// Track pending view requests to avoid duplicates
const pendingViews = new Set<string>();
// Last view time per conversation to debounce
const lastViewTime = new Map<string, number>();

/**
 * Hook to track when a post becomes visible in the viewport.
 * Uses IntersectionObserver for performance.
 */
export function useViewTracking(
  conversationId: string | undefined,
  options: ViewTrackingOptions = {}
) {
  const {
    threshold = 0.5, // 50% of element must be visible
    minViewTime = 1000, // Must be visible for 1 second
    debounceMs = 5000, // Don't re-track same post within 5 seconds
    onViewTracked,
  } = options;

  const elementRef = useRef<HTMLDivElement>(null);
  const visibleSince = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasTracked, setHasTracked] = useState(false);

  const trackView = useCallback(async () => {
    if (!conversationId) return;
    
    // Skip if already tracked in this session or pending
    if (viewedInSession.has(conversationId) || pendingViews.has(conversationId)) {
      return;
    }
    
    // Debounce check
    const lastTime = lastViewTime.get(conversationId) || 0;
    if (Date.now() - lastTime < debounceMs) {
      return;
    }

    try {
      pendingViews.add(conversationId);
      lastViewTime.set(conversationId, Date.now());

      const response = await fetch(`/api/conversations/${conversationId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        viewedInSession.add(conversationId);
        setHasTracked(true);
        
        onViewTracked?.({
          conversationId,
          success: true,
          strength: result.strength,
          strengthCategory: result.strengthCategory,
          isFirstView: result.isFirstView,
          verificationTier: result.verificationTier,
        });
      }
    } catch (error) {
      console.error('[ViewTracking] Error tracking view:', error);
      onViewTracked?.({
        conversationId,
        success: false,
      });
    } finally {
      pendingViews.delete(conversationId);
    }
  }, [conversationId, debounceMs, onViewTracked]);

  useEffect(() => {
    if (!conversationId || !elementRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            // Element became visible
            if (visibleSince.current === null) {
              visibleSince.current = Date.now();
              
              // Set timeout to track view after minViewTime
              timeoutRef.current = setTimeout(() => {
                if (visibleSince.current !== null) {
                  trackView();
                }
              }, minViewTime);
            }
          } else {
            // Element left viewport
            visibleSince.current = null;
            
            // Clear pending timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }
        }
      },
      {
        threshold: [threshold],
        rootMargin: '0px',
      }
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [conversationId, threshold, minViewTime, trackView]);

  return {
    ref: elementRef,
    hasTracked,
  };
}

/**
 * Simple utility to manually track a view (e.g., on click/expand)
 */
export async function trackViewManually(conversationId: string): Promise<ViewTrackResult> {
  try {
    const response = await fetch(`/api/conversations/${conversationId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const result = await response.json();
      viewedInSession.add(conversationId);
      return {
        conversationId,
        success: true,
        strength: result.strength,
        strengthCategory: result.strengthCategory,
        isFirstView: result.isFirstView,
        verificationTier: result.verificationTier,
      };
    }
    
    return { conversationId, success: false };
  } catch (error) {
    console.error('[ViewTracking] Error tracking view:', error);
    return { conversationId, success: false };
  }
}

/**
 * Check if a view has been tracked for a conversation in this session
 */
export function hasTrackedView(conversationId: string): boolean {
  return viewedInSession.has(conversationId);
}

/**
 * Reset view tracking (useful for testing or clearing session)
 */
export function resetViewTracking(): void {
  viewedInSession.clear();
  pendingViews.clear();
  lastViewTime.clear();
}
