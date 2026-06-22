"use client";

/**
 * @fileOverview useMicLevel — taps a microphone via Web Audio and exposes a live
 *   frequency snapshot for a visualizer (the "flat when silent, bounces when you
 *   speak" line). Used by the mic-settings test and the speaking glow.
 *
 *   - `bars`: a small Float array (0..1) updated each animation frame.
 *   - `level`: overall loudness 0..1 (drives the glow intensity / speaking).
 *   - Optionally accepts a deviceId so the settings modal can test a specific mic.
 *   - Fully cleans up (closes AudioContext, stops tracks) on stop/unmount.
 * @stability experimental
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { describeCurrentMediaError, getMediaErrorName, isSelectedDeviceError, queryMicrophonePermission } from "./media-devices";

const BAR_COUNT = 28;

export function useMicLevel(opts?: {
  deviceId?: string;
  active?: boolean;
  /** getUserMedia audio constraints (noiseSuppression/echo/AGC) — overrides deviceId. */
  constraints?: MediaTrackConstraints;
  /** Input gain multiplier applied via a GainNode so the meter reflects mic gain. */
  gain?: number;
  /** Stable key that restarts the stream when selected device/constraints change. */
  restartKey?: string;
}) {
  const active = opts?.active ?? false;
  const deviceId = opts?.deviceId;
  const constraints = opts?.constraints;
  const gain = opts?.gain ?? 1;
  const restartKey = opts?.restartKey ?? deviceId ?? "";

  const [bars, setBars] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorName, setErrorName] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef(0);
  const pendingTimerRef = useRef(0);
  const startSeqRef = useRef(0);
  const requestSeqRef = useRef(0);
  const requestingRef = useRef(false);

  // Live-update the gain node when the gain pref changes (no restart needed).
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  // Latest config read inside start() without making start() change identity
  // (constraints is a fresh object each render — depending on it would loop).
  const cfgRef = useRef({ deviceId, constraints, gain });
  cfgRef.current = { deviceId, constraints, gain };

  const stop = useCallback(() => {
    startSeqRef.current += 1;
    window.clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    gainRef.current = null;
    if (!requestingRef.current) setRequesting(false);
    setRunning(false);
    setBars(new Array(BAR_COUNT).fill(0));
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setRequesting(true);
    window.clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = window.setTimeout(() => {
      if (!requestingRef.current) return;
      setError(
        "Still waiting for Chrome to open the microphone. If no browser prompt is visible, close the site-info bubble, check the address bar for a hidden prompt, or reset microphone permission for this site and try again."
      );
      setDebugInfo(
        `Browser request is still pending. Permissions-Policy microphone: ${getFeaturePolicyState("microphone")}. Secure context: ${
          typeof window !== "undefined" && window.isSecureContext ? "yes" : "no"
        }.`
      );
    }, 6500);
    const seq = startSeqRef.current + 1;
    startSeqRef.current = seq;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    gainRef.current = null;
    setRunning(false);
    try {
      setError(null);
      setErrorName(null);
      setDebugInfo(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is unavailable in this browser or context.");
      }
      const cfg = cfgRef.current;
      const audio: MediaTrackConstraints = cfg.constraints
        ? cfg.constraints
        : cfg.deviceId ? { deviceId: { exact: cfg.deviceId } } : {};
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: Object.keys(audio).length ? audio : true,
        });
      } catch (err) {
        if (!isSelectedDeviceError(err) || !hasExactDeviceConstraint(audio)) throw err;
        const fallbackAudio = stripDeviceConstraint(audio);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: Object.keys(fallbackAudio).length ? fallbackAudio : true,
        });
      }
      if (startSeqRef.current !== seq) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      await ctx.resume().catch(() => undefined);
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      // Route through a GainNode so the meter reflects the user's mic-gain setting.
      const gainNode = ctx.createGain();
      gainNode.gain.value = cfg.gain;
      gainRef.current = gainNode;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(gainNode);
      gainNode.connect(analyser);
      analyserRef.current = analyser;
      setRunning(true);
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = 0;

      const freq = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(freq);
        // Down-sample the lower (voice) range into BAR_COUNT bars.
        const usable = Math.floor(freq.length * 0.7);
        const step = Math.max(1, Math.floor(usable / BAR_COUNT));
        const next: number[] = [];
        let sum = 0;
        for (let i = 0; i < BAR_COUNT; i++) {
          let acc = 0;
          for (let j = 0; j < step; j++) acc += freq[i * step + j] ?? 0;
          const v = acc / step / 255;
          next.push(v);
          sum += v;
        }
        setBars(next);
        setLevel(sum / BAR_COUNT);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const name = getMediaErrorName(e);
      const permission = await queryMicrophonePermission();
      const message = e instanceof Error && e.message ? `: ${e.message}` : "";
      setErrorName(name);
      setDebugInfo(
        `Browser error: ${name}${message}. Permission API: ${permission}. Permissions-Policy microphone: ${getFeaturePolicyState("microphone")}. Secure context: ${
          typeof window !== "undefined" && window.isSecureContext ? "yes" : "no"
        }.`
      );
      setError(await describeCurrentMediaError(e));
      setRunning(false);
    } finally {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = 0;
      if (requestSeqRef.current === requestSeq) {
        requestingRef.current = false;
        setRequesting(false);
      }
    }
  }, []);

  // Start/stop with `active`, and restart when selected device/constraints change.
  useEffect(() => {
    if (active) void start();
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, restartKey]);

  return { bars, level, error, errorName, debugInfo, running, requesting, start, stop };
}

function getFeaturePolicyState(feature: string) {
  if (typeof document === "undefined") return "unknown";
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature?: (name: string) => boolean };
    featurePolicy?: { allowsFeature?: (name: string) => boolean };
  };
  try {
    const policy = doc.permissionsPolicy ?? doc.featurePolicy;
    if (!policy?.allowsFeature) return "unknown";
    return policy.allowsFeature(feature) ? "allowed" : "blocked";
  } catch {
    return "unknown";
  }
}

function hasExactDeviceConstraint(audio: MediaTrackConstraints) {
  return Boolean(audio.deviceId);
}

function stripDeviceConstraint(audio: MediaTrackConstraints): MediaTrackConstraints {
  const rest = { ...audio };
  delete rest.deviceId;
  return rest;
}
