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

const BAR_COUNT = 28;

export function useMicLevel(opts?: {
  deviceId?: string;
  active?: boolean;
  /** getUserMedia audio constraints (noiseSuppression/echo/AGC) — overrides deviceId. */
  constraints?: MediaTrackConstraints;
  /** Input gain multiplier applied via a GainNode so the meter reflects mic gain. */
  gain?: number;
}) {
  const active = opts?.active ?? false;
  const deviceId = opts?.deviceId;
  const constraints = opts?.constraints;
  const gain = opts?.gain ?? 1;

  const [bars, setBars] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef(0);

  // Live-update the gain node when the gain pref changes (no restart needed).
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  // Latest config read inside start() without making start() change identity
  // (constraints is a fresh object each render — depending on it would loop).
  const cfgRef = useRef({ deviceId, constraints, gain });
  cfgRef.current = { deviceId, constraints, gain };

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    gainRef.current = null;
    setRunning(false);
    setBars(new Array(BAR_COUNT).fill(0));
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const cfg = cfgRef.current;
      const audio: MediaTrackConstraints = cfg.constraints
        ? cfg.constraints
        : cfg.deviceId ? { deviceId: { exact: cfg.deviceId } } : {};
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: Object.keys(audio).length ? audio : true,
      });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
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
      const name = (e as { name?: string })?.name;
      setError(name === "NotAllowedError" ? "Microphone access blocked." : "Could not open the microphone.");
      setRunning(false);
    }
  }, []);

  // Start/stop with `active`, and restart when deviceId changes while active.
  useEffect(() => {
    if (active) void start();
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, deviceId]);

  return { bars, level, error, running, start, stop };
}
