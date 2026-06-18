"use client";

/**
 * @fileOverview useDictation — in-app voice-to-text (the "Wispr Flow" feature).
 *   Uses the browser SpeechRecognition API for live transcription (no new deps;
 *   the pragmatic v1, swappable for Deepgram later behind the same shape), then
 *   optionally polishes the raw transcript via /api/voice/polish (existing Gemini
 *   cleanup) before handing back the final text.
 *
 *   Returns:
 *     - supported : whether the browser exposes SpeechRecognition
 *     - listening : actively transcribing
 *     - interim   : live partial transcript (show it greyed while speaking)
 *     - error     : human-readable error (e.g. mic blocked)
 *     - start/stop/toggle
 *
 *   onResult(finalText) fires once per stop with the (optionally polished) text.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal structural type for the vendor-prefixed SpeechRecognition.
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
interface SREvent {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getSRClass(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictation(opts: {
  onResult: (text: string) => void;
  /** Run the transcript through /api/voice/polish before returning. Default true. */
  polish?: boolean;
  lang?: string;
}) {
  const { onResult, polish = true, lang = "en-US" } = opts;
  // Deterministic from the environment — compute once, no effect/setState needed.
  const [supported] = useState(() => getSRClass() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SR | null>(null);
  const finalRef = useRef("");
  const onResultRef = useRef(onResult);
  // Keep the latest callback without re-creating start()/the recognizer.
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const SRClass = getSRClass();
    if (!SRClass) { setError("Voice typing isn’t supported in this browser."); return; }
    if (recRef.current) return; // already running

    setError(null);
    setInterim("");
    finalRef.current = "";

    const rec = new SRClass();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SREvent) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access blocked."
          : e.error === "no-speech"
            ? "Didn’t catch that — try again."
            : "Voice typing error.",
      );
    };
    rec.onend = async () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      const raw = finalRef.current.trim();
      finalRef.current = "";
      if (!raw) return;

      if (!polish) { onResultRef.current(raw); return; }
      // Best-effort polish; fall back to raw on any failure.
      try {
        const res = await fetch("/api/voice/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
        const data = await res.json().catch(() => null);
        onResultRef.current((data?.ok && data.text) ? data.text : raw);
      } catch {
        onResultRef.current(raw);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setError("Couldn’t start voice typing.");
    }
  }, [lang, polish]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Clean up on unmount.
  useEffect(() => () => { recRef.current?.abort(); recRef.current = null; }, []);

  return { supported, listening, interim, error, start, stop, toggle };
}
