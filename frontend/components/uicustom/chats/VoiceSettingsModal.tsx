"use client";

/**
 * @fileOverview VoiceSettingsModal - microphone permission, live input test,
 * audio input/output selection, and voice processing preferences.
 * @stability experimental
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiHeadphones,
  FiMic,
  FiMicOff,
  FiRefreshCw,
  FiSliders,
  FiVolume2,
  FiX,
  FiZap,
} from "react-icons/fi";
import { useMicLevel } from "@/lib/voice/useMicLevel";
import { MicWaveform } from "./MicWaveform";
import { ThemedSelect, type SelectOption } from "./ThemedSelect";
import { useVoicePrefs, audioConstraintsFromPrefs } from "@/lib/voice/voice-prefs";
import {
  enumerateAudioDevices,
  queryMicrophonePermission,
  selectAudioOutputDevice,
  supportsAudioOutputPicker,
  watchMicrophonePermission,
  type MicPermissionState,
} from "@/lib/voice/media-devices";
import { cn } from "@/lib/utils";

export function VoiceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const { prefs, update } = useVoicePrefs();
  const [mounted, setMounted] = React.useState(false);
  const [mics, setMics] = React.useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = React.useState<MediaDeviceInfo[]>([]);
  const [permission, setPermission] = React.useState<MicPermissionState>("unknown");
  const [testActive, setTestActive] = React.useState(false);
  const [micAttempt, setMicAttempt] = React.useState(0);
  const [triedMic, setTriedMic] = React.useState(false);
  const [deviceNotice, setDeviceNotice] = React.useState<string | null>(null);
  const [outputNotice, setOutputNotice] = React.useState<string | null>(null);
  const [testingOutput, setTestingOutput] = React.useState(false);

  const micRestartKey = React.useMemo(
    () => [
      prefs.micDeviceId,
      micAttempt,
      prefs.noiseSuppression ? "ns1" : "ns0",
      prefs.echoCancellation ? "ec1" : "ec0",
      prefs.autoGainControl ? "agc1" : "agc0",
    ].join("|"),
    [micAttempt, prefs.autoGainControl, prefs.echoCancellation, prefs.micDeviceId, prefs.noiseSuppression],
  );

  const { bars, level, error, errorName, debugInfo, running, requesting, stop } = useMicLevel({
    active: open && testActive,
    constraints: audioConstraintsFromPrefs(prefs),
    gain: prefs.micGain,
    restartKey: micRestartKey,
  });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const loadDevices = React.useCallback(async () => {
    try {
      const devices = await enumerateAudioDevices();
      setMics(devices.inputs);
      setSpeakers(devices.outputs);
      setDeviceNotice(null);
    } catch (err) {
      setDeviceNotice(err instanceof Error ? err.message : "Could not list audio devices.");
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      setTestActive(false);
      setTriedMic(false);
      setOutputNotice(null);
      return;
    }

    let cancelled = false;
    let status: PermissionStatus | null = null;
    void watchMicrophonePermission((state) => {
      if (cancelled) return;
      setPermission(state);
    }).then((next) => {
      status = next;
    });
    void queryMicrophonePermission().then((state) => {
      if (!cancelled) setPermission(state);
    });
    void loadDevices();
    const timer = window.setTimeout(loadDevices, 700);
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (status) status.onchange = null;
      navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
    };
  }, [loadDevices, open]);

  React.useEffect(() => {
    if (!running) return;
    setPermission("granted");
    setTriedMic(true);
    void loadDevices();
  }, [loadDevices, running]);

  React.useEffect(() => {
    if (!errorName) return;
    const denied = errorName === "NotAllowedError" || errorName === "PermissionDeniedError" || errorName === "SecurityError";
    if (denied) void queryMicrophonePermission().then(setPermission);
  }, [errorName]);

  React.useEffect(() => {
    if (!open || !prefs.micDeviceId || mics.length === 0) return;
    if (!mics.some((mic) => mic.deviceId === prefs.micDeviceId)) {
      update({ micDeviceId: "" });
      setDeviceNotice("Your saved microphone was not found, so input was reset to System default.");
    }
  }, [mics, open, prefs.micDeviceId, update]);

  React.useEffect(() => {
    if (!open || !prefs.spkDeviceId || speakers.length === 0) return;
    if (!speakers.some((speaker) => speaker.deviceId === prefs.spkDeviceId)) {
      update({ spkDeviceId: "" });
      setOutputNotice("Your saved speaker was not found, so output was reset to System default.");
    }
  }, [open, prefs.spkDeviceId, speakers, update]);

  const enableMic = React.useCallback(() => {
    setTriedMic(true);
    setDeviceNotice(null);
    setTestActive(true);
    setMicAttempt((attempt) => attempt + 1);
  }, []);

  const chooseOutput = React.useCallback(async () => {
    setOutputNotice(null);
    try {
      const device = await selectAudioOutputDevice(prefs.spkDeviceId || undefined);
      update({ spkDeviceId: device.deviceId });
      setOutputNotice(device.label ? `Output set to ${device.label}.` : "Output permission granted.");
      void loadDevices();
    } catch (err) {
      setOutputNotice(err instanceof Error ? err.message : "Could not open the speaker picker.");
    }
  }, [loadDevices, prefs.spkDeviceId, update]);

  const playOutputTest = React.useCallback(async () => {
    setTestingOutput(true);
    setOutputNotice(null);
    let ctx: AudioContext | null = null;
    let audio: HTMLAudioElement | null = null;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
      await ctx.resume().catch(() => undefined);
      const dest = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      osc.frequency.value = 660;
      osc.connect(gain);
      gain.connect(dest);

      audio = new Audio();
      audio.srcObject = dest.stream;
      audio.volume = prefs.outputVolume;
      if (prefs.spkDeviceId && "setSinkId" in audio) {
        await audio.setSinkId(prefs.spkDeviceId);
      }
      await audio.play();
      osc.start();
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      osc.stop();
      setOutputNotice("Speaker test played.");
    } catch (err) {
      setOutputNotice(err instanceof Error ? err.message : "Could not play the speaker test.");
    } finally {
      audio?.pause();
      if (audio) audio.srcObject = null;
      await ctx?.close().catch(() => undefined);
      setTestingOutput(false);
    }
  }, [prefs.outputVolume, prefs.spkDeviceId]);

  const permissionError = isPermissionLikeError(errorName);
  const micDenied = permission === "denied";
  const micSystemBlocked = permission !== "denied" && permissionError;
  const selectedInputMissing = errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError";
  const granted = permission === "granted" || running;
  const status = getMicStatus({
    running,
    triedMic,
    permission,
    errorName,
    level,
    sensitivity: prefs.sensitivity,
  });

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Voice settings"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-black/10 bg-background/95 shadow-2xl shadow-black/30 backdrop-blur-xl dark:border-white/10"
          >
            <div className="flex items-center justify-between gap-4 border-b border-black/5 bg-background/85 px-5 py-4 backdrop-blur-xl dark:border-white/8 sm:px-6">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/12 text-emerald-500">
                    <FiSliders className="h-4 w-4" />
                  </span>
                  Voice settings
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose devices, verify your mic, and tune voice activity before joining.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge running={running} denied={micDenied} systemBlocked={micSystemBlocked} requesting={requesting} />
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-5">
                <section className="rounded-3xl border border-black/8 bg-black/3 p-4 dark:border-white/10 dark:bg-white/3 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <FiMic className="h-3.5 w-3.5" /> Microphone
                      </h3>
                      <p className={cn("mt-1 text-xs font-medium", status.className)}>{status.label}</p>
                    </div>
                    <StatusBadge running={running} denied={micDenied} systemBlocked={micSystemBlocked} requesting={requesting} />
                  </div>

                  <div className="relative overflow-hidden rounded-xl border border-black/5 bg-background/70 dark:border-white/8">
                    <MicWaveform bars={bars} height={96} />
                    <div
                      aria-hidden
                      className="absolute inset-y-2 w-px rounded-full bg-amber-400/80"
                      style={{ left: `${Math.min(prefs.sensitivity / 0.3, 1) * 100}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={enableMic}
                      disabled={requesting}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
                    >
                      <FiMic className="h-4 w-4" />
                      {requesting ? "Opening microphone..." : running ? "Re-test mic" : granted ? "Start mic test" : "Allow microphone"}
                    </button>
                    {running && (
                      <button
                        onClick={() => {
                          setTestActive(false);
                          stop();
                        }}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:border-white/12 dark:hover:bg-white/8"
                        aria-label="Stop mic test"
                        title="Stop mic test"
                      >
                        <FiMicOff className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => void loadDevices()}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:border-white/12 dark:hover:bg-white/8"
                      aria-label="Refresh devices"
                      title="Refresh devices"
                    >
                      <FiRefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                  {(error || deviceNotice) && (
                    <Notice
                      tone={micDenied ? "red" : "amber"}
                      icon={<FiAlertTriangle className="h-3.5 w-3.5" />}
                      message={error ?? deviceNotice ?? ""}
                    >
                      {debugInfo && (
                        <div className="basis-full rounded-lg bg-black/5 px-2.5 py-1.5 font-mono text-[10px] text-current/75 dark:bg-white/8">
                          {debugInfo}
                        </div>
                      )}
                      {selectedInputMissing && (
                        <button
                          onClick={() => update({ micDeviceId: "" })}
                          className="rounded-md bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
                        >
                          Use system default
                        </button>
                      )}
                      {micDenied && (
                        <button
                          onClick={enableMic}
                          className="rounded-md bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/25 dark:text-red-300"
                        >
                          Ask again
                        </button>
                      )}
                      {micSystemBlocked && (
                        <button
                          onClick={enableMic}
                          className="rounded-md bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
                        >
                          Retry after OS fix
                        </button>
                      )}
                    </Notice>
                  )}
                </section>

              <Section icon={<FiMic className="h-3.5 w-3.5" />} title="Input">
                <ThemedSelect
                  ariaLabel="Microphone"
                  options={toOptions(mics, "System default mic", "Microphone")}
                  value={prefs.micDeviceId}
                  onChange={(value) => {
                    update({ micDeviceId: value });
                    if (testActive) setTriedMic(true);
                  }}
                />
                {!granted && mics.every((mic) => !mic.label) && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Device names appear after microphone permission is granted.</p>
                )}
                <SliderRow
                  label="Input volume"
                  value={prefs.micGain}
                  min={0.25}
                  max={2}
                  step={0.05}
                  onChange={(value) => update({ micGain: value })}
                  format={(value) => `${Math.round(value * 100)}%`}
                />
              </Section>
              </div>

              <div className="space-y-5">
                <Section icon={<FiHeadphones className="h-3.5 w-3.5" />} title="Output">
                <ThemedSelect
                  ariaLabel="Speaker"
                  options={toOptions(speakers, "System default speaker", "Speaker")}
                  value={prefs.spkDeviceId}
                  onChange={(value) => update({ spkDeviceId: value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={chooseOutput}
                    disabled={!supportsAudioOutputPicker()}
                    className="rounded-xl border border-black/10 bg-black/3 px-3 py-2 text-sm transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/12 dark:bg-white/4 dark:hover:bg-white/8"
                  >
                    Choose speaker
                  </button>
                  <button
                    onClick={playOutputTest}
                    disabled={testingOutput}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/3 px-3 py-2 text-sm transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/12 dark:bg-white/4 dark:hover:bg-white/8"
                  >
                    <FiVolume2 className="h-4 w-4" /> {testingOutput ? "Playing" : "Test"}
                  </button>
                </div>
                {outputNotice && (
                  <Notice
                    tone={outputNotice.toLowerCase().includes("could not") || outputNotice.toLowerCase().includes("does not") ? "amber" : "green"}
                    icon={<FiHeadphones className="h-3.5 w-3.5" />}
                    message={outputNotice}
                  />
                )}
                <SliderRow
                  label="Output volume"
                  value={prefs.outputVolume}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) => update({ outputVolume: value })}
                  format={(value) => `${Math.round(value * 100)}%`}
                />
                </Section>

                <Section icon={<FiZap className="h-3.5 w-3.5" />} title="Input sensitivity">
                <SliderRow
                  label="Threshold"
                  value={prefs.sensitivity}
                  min={0}
                  max={0.3}
                  step={0.005}
                  onChange={(value) => update({ sensitivity: value })}
                  format={(value) => (value <= 0.001 ? "off" : `${Math.round((value / 0.3) * 100)}%`)}
                  accent="amber"
                />
                </Section>

                <Section icon={<FiSliders className="h-3.5 w-3.5" />} title="Noise & processing">
                <ToggleRow
                  label="Noise suppression"
                  desc="Filter background sound"
                  checked={prefs.noiseSuppression}
                  onChange={(value) => update({ noiseSuppression: value })}
                />
                <ToggleRow
                  label="Echo cancellation"
                  desc="Reduce speaker echo"
                  checked={prefs.echoCancellation}
                  onChange={(value) => update({ echoCancellation: value })}
                />
                <ToggleRow
                  label="Auto gain control"
                  desc="Auto-level your voice"
                  checked={prefs.autoGainControl}
                  onChange={(value) => update({ autoGainControl: value })}
                />
                </Section>

                <Section icon={<FiMic className="h-3.5 w-3.5" />} title="Voice mode">
                <div className="grid grid-cols-2 gap-2">
                  <ModeButton active={prefs.mode === "voice"} onClick={() => update({ mode: "voice" })} title="Voice activity" desc="Speak to transmit" />
                  <ModeButton active={prefs.mode === "ptt"} onClick={() => update({ mode: "ptt" })} title="Push to talk" desc="Hold a key" />
                </div>
                {prefs.mode === "ptt" && (
                  <PttKeyCapture value={prefs.pttKey} onChange={(key) => update({ pttKey: key })} />
                )}
                </Section>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function getMicStatus({
  running,
  triedMic,
  permission,
  errorName,
  level,
  sensitivity,
}: {
  running: boolean;
  triedMic: boolean;
  permission: MicPermissionState;
  errorName: string | null;
  level: number;
  sensitivity: number;
}) {
  const mediaError = errorName;
  if (running && level > sensitivity) return { label: "Hearing you", className: "text-emerald-600 dark:text-emerald-400" };
  if (running) return { label: "Listening", className: "text-sky-600 dark:text-sky-400" };
  if (mediaError === "OverconstrainedError" || mediaError === "ConstraintNotSatisfiedError") {
    return { label: "Selected input unavailable", className: "text-amber-600 dark:text-amber-400" };
  }
  if (mediaError === "NotFoundError" || mediaError === "DevicesNotFoundError") {
    return { label: "No microphone found", className: "text-amber-600 dark:text-amber-400" };
  }
  if (permission === "granted" && isPermissionLikeError(mediaError)) {
    return { label: "Blocked by system or browser policy", className: "text-amber-600 dark:text-amber-400" };
  }
  if (permission === "denied") return { label: "Permission denied", className: "text-red-600 dark:text-red-400" };
  if (permission === "prompt" || !triedMic) return { label: "Ready to ask permission", className: "text-muted-foreground" };
  return { label: "Mic test stopped", className: "text-muted-foreground" };
}

function StatusBadge({
  running,
  denied,
  systemBlocked,
  requesting,
}: {
  running: boolean;
  denied: boolean;
  systemBlocked?: boolean;
  requesting?: boolean;
}) {
  if (requesting) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-1 text-[10px] font-medium text-sky-600 dark:text-sky-400">
        <span className="h-2 w-2 rounded-full bg-current animate-pulse" /> Asking
      </span>
    );
  }
  if (running) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <FiCheckCircle className="h-3 w-3" /> Active
      </span>
    );
  }
  if (denied) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400">
        <FiAlertTriangle className="h-3 w-3" /> Check
      </span>
    );
  }
  if (systemBlocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
        <FiAlertTriangle className="h-3 w-3" /> System
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[10px] font-medium text-muted-foreground dark:bg-white/8">
      <FiMic className="h-3 w-3" /> Idle
    </span>
  );
}

function isPermissionLikeError(errorName: string | null) {
  return errorName === "NotAllowedError" || errorName === "PermissionDeniedError" || errorName === "SecurityError";
}

function Notice({
  tone,
  icon,
  message,
  children,
}: {
  tone: "amber" | "green" | "red";
  icon: React.ReactNode;
  message: string;
  children?: React.ReactNode;
}) {
  const cls =
    tone === "red"
      ? "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-400"
      : tone === "green"
        ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
        : "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300";

  return (
    <div className={cn("mt-3 rounded-xl border p-3", cls)}>
      <p className="flex items-start gap-1.5 text-[11px] font-medium">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span>{message}</span>
      </p>
      {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  accent = "emerald",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  accent?: "emerald" | "amber";
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const track = accent === "amber" ? "#f59e0b" : "#10b981";
  return (
    <div className="pt-0.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        style={{ background: `linear-gradient(to right, ${track} ${pct}%, rgba(120,120,120,0.25) ${pct}%)` }}
      />
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-black/3 px-3 py-2.5 transition-colors hover:bg-black/5 dark:bg-white/4 dark:hover:bg-white/6">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-black/15 dark:bg-white/15")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[1.125rem]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

function ModeButton({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-emerald-500/40 bg-emerald-500/12 text-foreground"
          : "border-transparent bg-black/3 text-muted-foreground hover:bg-black/5 dark:bg-white/4 dark:hover:bg-white/6",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-[11px] text-muted-foreground">{desc}</span>
    </button>
  );
}

function PttKeyCapture({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [listening, setListening] = React.useState(false);

  React.useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      onChange(event.code);
      setListening(false);
    };
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, onChange]);

  const label = value.replace(/^Key/, "").replace(/^Digit/, "");
  return (
    <button
      onClick={() => setListening(true)}
      className={cn(
        "mt-2 w-full rounded-xl border px-3 py-2 text-sm transition-colors",
        listening
          ? "animate-pulse border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-black/10 bg-black/3 hover:bg-black/5 dark:border-white/12 dark:bg-white/4 dark:hover:bg-white/6",
      )}
    >
      {listening ? "Press any key" : <>Hold key: <span className="font-semibold">{label}</span></>}
    </button>
  );
}

function toOptions(devices: MediaDeviceInfo[], fallback: string, deviceKind: "Microphone" | "Speaker"): SelectOption[] {
  const seen = new Set<string>(["", "default"]);
  const filtered = devices.filter((device) => {
    if (!device.deviceId || seen.has(device.deviceId)) return false;
    seen.add(device.deviceId);
    return true;
  });

  return [
    { value: "", label: fallback },
    ...filtered.map((device, index) => ({
      value: device.deviceId,
      label: device.label || `${deviceKind} ${index + 1}`,
    })),
  ];
}
