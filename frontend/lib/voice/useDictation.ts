"use client";

/**
 * @fileOverview useDictation - in-app voice-to-text (Wispr Flow style).
 *
 * Browser SpeechRecognition is useful for live partial captions, but it does not
 * reliably honor an app-selected microphone. This hook opens the selected
 * getUserMedia input first, records that stream, and falls back to server STT on
 * release. Result: the UI can say "Listening" and still produce text even when
 * Chrome's SpeechRecognition emits no result events.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { describeCurrentMediaError, openMicrophoneStream } from "./media-devices";
import { readVoicePrefs } from "./voice-prefs";

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

type RecorderMime = "audio/webm;codecs=opus" | "audio/webm" | "audio/mp4" | "";

function getSRClass(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getRecorderMimeType(): RecorderMime {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates: RecorderMime[] = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function audioFileName(mimeType: string) {
  if (mimeType.includes("mp4")) return "dictation.mp4";
  if (mimeType.includes("webm")) return "dictation.webm";
  return "dictation.audio";
}

async function transcribeAudio(blob: Blob): Promise<string> {
  if (blob.size < 1024) return "";
  const form = new FormData();
  const file = new File([blob], audioFileName(blob.type), { type: blob.type || "audio/webm" });
  form.set("file", file);

  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message || data?.detail || data?.error || "Server transcription failed.";
    throw new Error(String(message));
  }
  return typeof data?.text === "string" ? data.text.trim() : "";
}

async function polishTranscript(raw: string) {
  try {
    const res = await fetch("/api/voice/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json().catch(() => null);
    return data?.ok && data.text ? String(data.text) : raw;
  } catch {
    return raw;
  }
}

export function useDictation(opts: {
  onResult: (text: string) => void;
  /** Called with live final+interim text while the user is still speaking. */
  onInterim?: (text: string) => void;
  /** Run the transcript through /api/voice/polish before returning. Default true. */
  polish?: boolean;
  lang?: string;
}) {
  const { onResult, onInterim, polish = true, lang = "en-US" } = opts;
  const [supported] = useState(() => getSRClass() !== null || typeof MediaRecorder !== "undefined");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SR | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");
  const liveRef = useRef("");
  const finishingRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  const cleanupMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const resetSpeechState = useCallback(() => {
    finalRef.current = "";
    liveRef.current = "";
    chunksRef.current = [];
    setInterim("");
  }, []);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setTranscribing(true);

    let raw = (finalRef.current.trim() || liveRef.current.trim()).trim();
    const chunks = chunksRef.current;
    chunksRef.current = [];

    if (chunks.length) {
      try {
        const type = chunks.find((chunk) => chunk.type)?.type || "audio/webm";
        const selectedMicTranscript = await transcribeAudio(new Blob(chunks, { type }));
        if (selectedMicTranscript) raw = selectedMicTranscript;
      } catch (e) {
        if (!raw) {
          setError(e instanceof Error ? e.message : "Could not transcribe the selected microphone.");
        }
      }
    }

    recRef.current = null;
    cleanupMedia();
    setListening(false);
    setTranscribing(false);
    setInterim("");
    finalRef.current = "";
    liveRef.current = "";

    if (!raw) {
      onInterimRef.current?.("");
      finishingRef.current = false;
      return;
    }

    const finalText = polish ? await polishTranscript(raw) : raw;
    onResultRef.current(finalText);
    onInterimRef.current?.("");
    finishingRef.current = false;
  }, [cleanupMedia, polish]);

  const stop = useCallback(() => {
    const speech = recRef.current;
    const recorder = recorderRef.current;
    try { speech?.stop(); } catch { /* already stopped */ }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      void finish();
    }
  }, [finish]);

  const stopAll = useCallback(() => {
    try { recRef.current?.abort(); } catch { /* already stopped */ }
    try {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch { /* already stopped */ }
    recRef.current = null;
    cleanupMedia();
    resetSpeechState();
    setListening(false);
    setTranscribing(false);
  }, [cleanupMedia, resetSpeechState]);

  const start = useCallback(async () => {
    const SRClass = getSRClass();
    if (!SRClass && typeof MediaRecorder === "undefined") {
      setError("Voice typing is not supported in this browser.");
      return;
    }
    if (recRef.current || recorderRef.current) return;

    setError(null);
    resetSpeechState();
    finishingRef.current = false;
    onInterimRef.current?.("");

    try {
      const stream = await openMicrophoneStream(readVoicePrefs());
      streamRef.current = stream;

      if (typeof MediaRecorder !== "undefined") {
        const mimeType = getRecorderMimeType();
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => { void finish(); };
        recorder.start(750);
      }
    } catch (e) {
      cleanupMedia();
      setError(await describeCurrentMediaError(e));
      return;
    }

    if (SRClass) {
      const rec = new SRClass();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: SREvent) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += ` ${r[0].transcript}`;
          else interimText += r[0].transcript;
        }
        const live = `${finalRef.current} ${interimText}`.replace(/\s+/g, " ").trim();
        liveRef.current = live;
        setInterim(live);
        onInterimRef.current?.(live);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError("Browser live captions are blocked. Release to transcribe the selected mic.");
        } else if (e.error !== "no-speech") {
          setError("Browser live captions paused. Release to transcribe the selected mic.");
        }
      };
      rec.onend = () => {
        recRef.current = null;
        if (!recorderRef.current) void finish();
      };
      recRef.current = rec;
      try {
        rec.start();
      } catch {
        recRef.current = null;
      }
    }

    setListening(true);
  }, [cleanupMedia, finish, lang, resetSpeechState]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  useEffect(() => () => { stopAll(); }, [stopAll]);

  return { supported, listening, transcribing, interim, error, start, stop, toggle };
}
