"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type ToneId, DEFAULT_TONE } from "@/lib/voice/tone";

export type ProductTitleAnimationMode = "letters" | "rsvp" | "off";

// Supported fiat currencies
export type FiatCurrency = "USD" | "NOK" | "EUR" | "GBP" | "SEK" | "DKK";

// Supported cryptocurrencies for display preference
export type CryptoCurrency = "ETH" | "SOL" | "BTC" | "USDC" | "NONE";

// Appearance style presets
export type StylePreset = "minimal" | "modern" | "vibrant";

// Page animation intensity
export type AnimationIntensity = "none" | "subtle" | "full";

// Hover effect style
export type HoverEffectStyle = "simple" | "colorful";

export type UiPreferences = {
  productTitleAnimationMode: ProductTitleAnimationMode;
  rsvpWpm: number; // words per minute
  // Currency display preferences
  preferredFiatCurrency: FiatCurrency;
  preferredCryptoCurrency: CryptoCurrency;
  showCryptoFirst: boolean; // If true, show crypto price first when available
  // Appearance settings (NEW)
  stylePreset: StylePreset;           // minimal (default) | modern | vibrant (fancy)
  enableGradientBackgrounds: boolean; // Gradient backgrounds on pages/cards
  enableGradientSpheres: boolean;     // Floating gradient orbs/spheres
  pageAnimations: AnimationIntensity; // Page transition animations
  hoverEffects: HoverEffectStyle;     // Simple vs colorful hover effects
  enableExperimentalEffects: boolean; // Opt-in for experimental fancy features
  toneOfVoice: ToneId;                // Brand voice for product copy (see lib/voice/tone)
};

const DEFAULT_PREFS: UiPreferences = {
  productTitleAnimationMode: "rsvp",
  rsvpWpm: 420,
  preferredFiatCurrency: "USD",
  preferredCryptoCurrency: "ETH",
  showCryptoFirst: true,
  // Appearance defaults - MINIMAL by default (clean look)
  stylePreset: "minimal",
  enableGradientBackgrounds: false,
  enableGradientSpheres: false,
  pageAnimations: "subtle",
  hoverEffects: "simple",
  enableExperimentalEffects: false,
  toneOfVoice: DEFAULT_TONE,
};

const VALID_FIAT: FiatCurrency[] = ["USD", "NOK", "EUR", "GBP", "SEK", "DKK"];
const VALID_CRYPTO: CryptoCurrency[] = ["ETH", "SOL", "BTC", "USDC", "NONE"];
const VALID_STYLE_PRESETS: StylePreset[] = ["minimal", "modern", "vibrant"];
const VALID_ANIMATION_INTENSITIES: AnimationIntensity[] = ["none", "subtle", "full"];
const VALID_HOVER_STYLES: HoverEffectStyle[] = ["simple", "colorful"];

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

  // Currency preferences
  const fiat = p?.preferredFiatCurrency;
  const preferredFiatCurrency: FiatCurrency = 
    VALID_FIAT.includes(fiat as FiatCurrency) ? (fiat as FiatCurrency) : DEFAULT_PREFS.preferredFiatCurrency;

  const crypto = p?.preferredCryptoCurrency;
  const preferredCryptoCurrency: CryptoCurrency = 
    VALID_CRYPTO.includes(crypto as CryptoCurrency) ? (crypto as CryptoCurrency) : DEFAULT_PREFS.preferredCryptoCurrency;

  const showCryptoFirst = typeof p?.showCryptoFirst === "boolean" ? p.showCryptoFirst : DEFAULT_PREFS.showCryptoFirst;

  // Appearance preferences
  const preset = p?.stylePreset;
  const stylePreset: StylePreset = 
    VALID_STYLE_PRESETS.includes(preset as StylePreset) ? (preset as StylePreset) : DEFAULT_PREFS.stylePreset;

  const enableGradientBackgrounds = typeof p?.enableGradientBackgrounds === "boolean" 
    ? p.enableGradientBackgrounds : DEFAULT_PREFS.enableGradientBackgrounds;
  
  const enableGradientSpheres = typeof p?.enableGradientSpheres === "boolean" 
    ? p.enableGradientSpheres : DEFAULT_PREFS.enableGradientSpheres;

  const anim = p?.pageAnimations;
  const pageAnimations: AnimationIntensity = 
    VALID_ANIMATION_INTENSITIES.includes(anim as AnimationIntensity) ? (anim as AnimationIntensity) : DEFAULT_PREFS.pageAnimations;

  const hover = p?.hoverEffects;
  const hoverEffects: HoverEffectStyle = 
    VALID_HOVER_STYLES.includes(hover as HoverEffectStyle) ? (hover as HoverEffectStyle) : DEFAULT_PREFS.hoverEffects;

  const enableExperimentalEffects = typeof p?.enableExperimentalEffects === "boolean"
    ? p.enableExperimentalEffects : DEFAULT_PREFS.enableExperimentalEffects;

  const tone = p?.toneOfVoice;
  const toneOfVoice: ToneId =
    (["vibe", "professional", "community"] as ToneId[]).includes(tone as ToneId)
      ? (tone as ToneId) : DEFAULT_PREFS.toneOfVoice;

  return {
    productTitleAnimationMode,
    rsvpWpm,
    preferredFiatCurrency,
    preferredCryptoCurrency,
    showCryptoFirst,
    stylePreset,
    enableGradientBackgrounds,
    enableGradientSpheres,
    pageAnimations,
    hoverEffects,
    enableExperimentalEffects,
    toneOfVoice,
  };
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
    if (!existing) return;
    const timeoutId = window.setTimeout(() => {
      setPrefsState(normalize(existing));
    }, 0);
    return () => window.clearTimeout(timeoutId);
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

/**
 * Convenience hook for checking if fancy/vibrant mode is enabled.
 * Use this to conditionally apply gradients, animations, etc.
 */
export function useFancyMode() {
  const { prefs } = useUiPreferences();
  
  return {
    /** True if style preset is "vibrant" (full fancy mode) */
    isVibrant: prefs.stylePreset === "vibrant",
    /** True if style preset is "modern" or "vibrant" */
    isModern: prefs.stylePreset !== "minimal",
    /** True if gradient backgrounds are enabled */
    showGradients: prefs.enableGradientBackgrounds,
    /** True if floating spheres/orbs are enabled */
    showSpheres: prefs.enableGradientSpheres,
    /** Animation intensity: "none" | "subtle" | "full" */
    animations: prefs.pageAnimations,
    /** True if colorful hover effects are enabled */
    colorfulHovers: prefs.hoverEffects === "colorful",
    /** True if experimental effects are enabled */
    experimental: prefs.enableExperimentalEffects,
    /** Full preferences object */
    prefs,
  };
}
