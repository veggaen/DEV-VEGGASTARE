'use client';

/**
 * @fileOverview useSpeechToText — Whisper-Flow-style live dictation built on the
 *   browser's Web Speech API (SpeechRecognition). No dependency, no server: the
 *   browser streams interim + final transcripts which we surface so the caller
 *   can append dictated text into a composer.
 *
 *   - `supported` is false on browsers without the API (e.g. Firefox) so callers
 *     can hide the mic button instead of showing a dead control.
 *   - `interim` is the in-progress (not-yet-final) phrase, for a live preview.
 *   - `onResult(finalChunk)` fires once a phrase is finalized, so the caller
 *     appends stable text and never double-inserts the interim guess.
 * @stability experimental
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { describeCurrentMediaError, openMicrophoneStream } from '@/lib/voice/media-devices';
import { readVoicePrefs } from '@/lib/voice/voice-prefs';

// The Web Speech API isn't in the TS DOM lib by default; minimal shapes here.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface Options {
  /** Called with each finalized phrase (already trimmed, with trailing space). */
  onResult: (finalChunk: string) => void;
  lang?: string;
}

export function useSpeechToText({ onResult, lang = 'en-US' }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const requestingRef = useRef(false);
  // Keep the latest onResult without re-creating the recognizer each render.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (requestingRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // Reuse a single recognizer instance.
    if (!recRef.current) {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0]?.transcript ?? '';
          if (res.isFinal) {
            const clean = text.trim();
            if (clean) onResultRef.current(clean + ' ');
          } else {
            interimText += text;
          }
        }
        setInterim(interimText);
      };
      rec.onerror = (ev) => {
        // "no-speech" / "aborted" are benign; surface real permission issues.
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setError('Microphone access was blocked.');
        }
        setListening(false);
        setInterim('');
      };
      rec.onend = () => {
        setListening(false);
        setInterim('');
      };
      recRef.current = rec;
    }
    try {
      setError(null);
      requestingRef.current = true;
      setRequesting(true);
      void openMicrophoneStream(readVoicePrefs())
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          try {
            recRef.current?.start();
            setListening(true);
          } catch {
            // start() throws if already started — ignore.
          }
        })
        .catch(async (err) => {
          setError(await describeCurrentMediaError(err));
          setListening(false);
          setInterim('');
        })
        .finally(() => {
          requestingRef.current = false;
          setRequesting(false);
        });
    } catch {
      // Recognition construction can throw in hardened browser contexts.
      setError('Could not start dictation.');
      requestingRef.current = false;
      setRequesting(false);
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Clean up on unmount.
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, requesting, interim, error, start, stop, toggle };
}
