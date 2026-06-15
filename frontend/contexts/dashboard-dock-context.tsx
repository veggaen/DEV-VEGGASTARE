/**
 * @fileOverview  Dashboard dock context — lets users reposition the sidebar
 *                to left, right, top, or bottom. Persists to localStorage.
 * @stability     evolving
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ── Types ─────────────────────────────────────────────── */

export type DockPosition = "left" | "right" | "top" | "bottom";

interface DashboardDockState {
  /** Current dock position */
  position: DockPosition;
  /** Whether the dock is expanded (full-width/height) vs collapsed (icon strip) */
  isExpanded: boolean;
  /** Change dock position */
  setPosition: (pos: DockPosition) => void;
  /** Set expanded state */
  setExpanded: (expanded: boolean) => void;
  /** Toggle expanded/collapsed */
  toggleExpanded: () => void;
  /** Whether dock is in a horizontal orientation (top/bottom) */
  isHorizontal: boolean;
}

const STORAGE_KEY = "veggat:dock-position";
const EXPANDED_KEY = "veggat:dock-expanded";
const DEFAULT_POSITION: DockPosition = "left";

/* ── Context ───────────────────────────────────────────── */

const DashboardDockContext = createContext<DashboardDockState | null>(null);

/* ── Provider ──────────────────────────────────────────── */

export function DashboardDockProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<DockPosition>(() => {
    if (typeof window === 'undefined') return DEFAULT_POSITION;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as DockPosition | null;
      if (stored && ["left", "right", "top", "bottom"].includes(stored)) return stored;
    } catch { /* SSR or localStorage unavailable */ }
    return DEFAULT_POSITION;
  });
  const [isExpanded, setExpandedState] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(EXPANDED_KEY);
      if (stored !== null) return stored === "true";
    } catch { /* noop */ }
    return false;
  });
  const hydrated = true; // Initializer runs synchronously — always hydrated

  const setPosition = useCallback((pos: DockPosition) => {
    setPositionState(pos);
    try {
      localStorage.setItem(STORAGE_KEY, pos);
    } catch {
      /* noop */
    }
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    setExpandedState(expanded);
    try {
      localStorage.setItem(EXPANDED_KEY, String(expanded));
    } catch {
      /* noop */
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpandedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(EXPANDED_KEY, String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const isHorizontal = position === "top" || position === "bottom";

  const value = useMemo<DashboardDockState>(
    () => ({
      position,
      isExpanded,
      setPosition,
      setExpanded,
      toggleExpanded,
      isHorizontal,
    }),
    [position, isExpanded, setPosition, setExpanded, toggleExpanded, isHorizontal],
  );

  // Avoid hydration mismatch — render children only after hydrating
  if (!hydrated) {
    return <>{children}</>;
  }

  return (
    <DashboardDockContext.Provider value={value}>
      {children}
    </DashboardDockContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────── */

export function useDashboardDock(): DashboardDockState {
  const ctx = useContext(DashboardDockContext);
  if (!ctx) {
    // Fallback when not inside provider (e.g. render outside dashboard)
    return {
      position: "left",
      isExpanded: false,
      setPosition: () => {},
      setExpanded: () => {},
      toggleExpanded: () => {},
      isHorizontal: false,
    };
  }
  return ctx;
}
