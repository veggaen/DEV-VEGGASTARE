"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ProductTitleAnimationMode = "letters" | "rsvp" | "off";

export type UiPreferences = {
  productTitleAnimationMode: ProductTitleAnimationMode;
  rsvpWpm: number; // words per minute
};

const DEFAULT_PREFS: UiPreferences = {
  productTitleAnimationMode: "rsvp",
  rsvpWpm: 420,
};

const STORAGE_KEY = "veggastare:uiPreferences";

function safeParse(json: string | null): Partial<UiPreferences> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<UiPreferences>;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalize(p: Partial<UiPreferences> | null | undefined): UiPreferences {
  const mode = p?.productTitleAnimationMode;
  const productTitleAnimationMode: ProductTitleAnimationMode =
    mode === "letters" || mode === "rsvp" || mode === "off" ? mode : DEFAULT_PREFS.productTitleAnimationMode;

  const wpmRaw = typeof p?.rsvpWpm === "number" ? p.rsvpWpm : DEFAULT_PREFS.rsvpWpm;
  const rsvpWpm = clamp(Number.isFinite(wpmRaw) ? wpmRaw : DEFAULT_PREFS.rsvpWpm, 120, 900);

  return { productTitleAnimationMode, rsvpWpm };
}

type UiPreferencesContextValue = {
  prefs: UiPreferences;
  setPrefs: (next: Partial<UiPreferences> | ((prev: UiPreferences) => Partial<UiPreferences>)) => void;
  resetPrefs: () => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<UiPreferences>(DEFAULT_PREFS);

  // Load once on mount.
  useEffect(() => {
    const existing = safeParse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null);
    if (existing) setPrefsState(normalize(existing));
  }, []);

  // Persist.
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  const setPrefs = useCallback(
    (next: Partial<UiPreferences> | ((prev: UiPreferences) => Partial<UiPreferences>)) => {
      setPrefsState((prev) => normalize(typeof next === "function" ? next(prev) : next));
    },
    []
  );

  const resetPrefs = useCallback(() => setPrefsState(DEFAULT_PREFS), []);

  const value = useMemo<UiPreferencesContextValue>(() => ({ prefs, setPrefs, resetPrefs }), [prefs, setPrefs, resetPrefs]);

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  return ctx;
}
