"use client";

/**
 * @fileOverview Voice audio preferences — a single, persisted source of truth for
 *   the Discord/X-style controls (device IDs, noise suppression / echo cancel /
 *   AGC, input-sensitivity VAD gate, mic gain, output volume, push-to-talk mode).
 *   The settings modal writes these; useMicLevel + the voice providers read them so
 *   what you tune in settings is what actually transmits.
 *
 *   Persisted to localStorage and broadcast via a window event so every consumer
 *   (modal, providers) stays in sync without a context provider.
 */

import * as React from "react";

export type PttMode = "voice" | "ptt"; // voice-activated vs push-to-talk

export interface VoicePrefs {
  micDeviceId: string;       // "" = system default
  spkDeviceId: string;       // "" = system default
  noiseSuppression: boolean; // getUserMedia constraint (Krisp-like, browser-native)
  echoCancellation: boolean;
  autoGainControl: boolean;
  /** Input sensitivity gate 0..1 — RMS below this is treated as silence (VAD). */
  sensitivity: number;
  /** Mic input gain multiplier (0.5..2.0; 1 = unchanged). */
  micGain: number;
  /** Output volume 0..1 for what you hear from the room. */
  outputVolume: number;
  mode: PttMode;
  /** Hold key for push-to-talk (KeyboardEvent.code, e.g. "KeyV"). */
  pttKey: string;
}

export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  micDeviceId: "",
  spkDeviceId: "",
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  sensitivity: 0.04,
  micGain: 1,
  outputVolume: 1,
  mode: "voice",
  pttKey: "KeyV",
};

const STORAGE_KEY = "voice:prefs";
export const VOICE_PREFS_CHANGED_EVENT = "voice:prefs-changed";

// Legacy keys the modal used before this store — migrate them once.
const LEGACY_MIC = "voice:micDeviceId";
const LEGACY_SPK = "voice:spkDeviceId";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
}

function normalize(p: Partial<VoicePrefs> | null | undefined): VoicePrefs {
  const d = DEFAULT_VOICE_PREFS;
  return {
    micDeviceId: typeof p?.micDeviceId === "string" ? p.micDeviceId : d.micDeviceId,
    spkDeviceId: typeof p?.spkDeviceId === "string" ? p.spkDeviceId : d.spkDeviceId,
    noiseSuppression: typeof p?.noiseSuppression === "boolean" ? p.noiseSuppression : d.noiseSuppression,
    echoCancellation: typeof p?.echoCancellation === "boolean" ? p.echoCancellation : d.echoCancellation,
    autoGainControl: typeof p?.autoGainControl === "boolean" ? p.autoGainControl : d.autoGainControl,
    sensitivity: clamp(p?.sensitivity ?? d.sensitivity, 0, 0.5),
    micGain: clamp(p?.micGain ?? d.micGain, 0.25, 3),
    outputVolume: clamp(p?.outputVolume ?? d.outputVolume, 0, 1),
    mode: p?.mode === "ptt" ? "ptt" : "voice",
    pttKey: typeof p?.pttKey === "string" && p.pttKey ? p.pttKey : d.pttKey,
  };
}

export function readVoicePrefs(): VoicePrefs {
  if (typeof window === "undefined") return DEFAULT_VOICE_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    // First run: migrate legacy device-id keys if present.
    const legacy: Partial<VoicePrefs> = {
      micDeviceId: localStorage.getItem(LEGACY_MIC) ?? "",
      spkDeviceId: localStorage.getItem(LEGACY_SPK) ?? "",
    };
    return normalize(legacy);
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

export function writeVoicePrefs(next: VoicePrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Keep legacy keys in sync so anything still reading them works.
    localStorage.setItem(LEGACY_MIC, next.micDeviceId);
    localStorage.setItem(LEGACY_SPK, next.spkDeviceId);
    window.dispatchEvent(new CustomEvent(VOICE_PREFS_CHANGED_EVENT));
  } catch { /* storage blocked */ }
}

/** Reactive hook: current prefs + a partial setter. Syncs across components/tabs. */
export function useVoicePrefs() {
  const [prefs, setPrefs] = React.useState<VoicePrefs>(DEFAULT_VOICE_PREFS);

  // Hydrate on mount (avoids SSR mismatch) and subscribe to changes.
  React.useEffect(() => {
    setPrefs(readVoicePrefs());
    const onChange = () => setPrefs(readVoicePrefs());
    window.addEventListener(VOICE_PREFS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange); // cross-tab
    return () => {
      window.removeEventListener(VOICE_PREFS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = React.useCallback((patch: Partial<VoicePrefs>) => {
    setPrefs((prev) => {
      const next = normalize({ ...prev, ...patch });
      writeVoicePrefs(next);
      return next;
    });
  }, []);

  return { prefs, update };
}

/** Build getUserMedia audio constraints from prefs (device + noise toggles). */
export function audioConstraintsFromPrefs(p: VoicePrefs): MediaTrackConstraints {
  return {
    ...(p.micDeviceId ? { deviceId: { exact: p.micDeviceId } } : {}),
    noiseSuppression: p.noiseSuppression,
    echoCancellation: p.echoCancellation,
    autoGainControl: p.autoGainControl,
  };
}
