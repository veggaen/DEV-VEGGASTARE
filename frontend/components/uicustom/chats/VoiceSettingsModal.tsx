"use client";

/**
 * @fileOverview VoiceSettingsModal — a modern, Discord/X-style voice control panel.
 *   Sections: live mic test (with permission handling), Input device + volume,
 *   Output device + volume, Noise & processing (suppression/echo/AGC), Input
 *   sensitivity (VAD gate), and Push-to-talk. All settings persist via
 *   lib/voice/voice-prefs and are read by useMicLevel + the voice providers, so what
 *   you tune here is what actually transmits.
 *
 *   Built in the app's glassy language; responsive (full-screen sheet on phones,
 *   centered card on desktop); both themes.
 * @stability experimental
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FiX, FiMic, FiVolume2, FiAlertTriangle, FiSliders, FiZap } from "react-icons/fi";
import { useMicLevel } from "@/lib/voice/useMicLevel";
import { MicWaveform } from "./MicWaveform";
import { ThemedSelect, type SelectOption } from "./ThemedSelect";
import { useVoicePrefs, audioConstraintsFromPrefs } from "@/lib/voice/voice-prefs";
import { cn } from "@/lib/utils";

type MicPermission = "unknown" | "prompt" | "granted" | "denied";

export function VoiceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const { prefs, update } = useVoicePrefs();
  const [mics, setMics] = React.useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = React.useState<MediaDeviceInfo[]>([]);
  const [permission, setPermission] = React.useState<MicPermission>("unknown");
  const [testActive, setTestActive] = React.useState(false);

  const { bars, level, error, running, start } = useMicLevel({
    active: open && testActive,
    constraints: audioConstraintsFromPrefs(prefs),
    gain: prefs.micGain,
  });

  // Permission state from the Permissions API (source of truth for askable vs blocked).
  React.useEffect(() => {
    if (!open) { setTestActive(false); return; }
    let status: PermissionStatus | null = null;
    const sync = (s: PermissionState) => {
      setPermission(s as MicPermission);
      if (s === "granted") setTestActive(true);
    };
    (async () => {
      try {
        status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        sync(status.state);
        status.onchange = () => status && sync(status.state);
      } catch {
        setPermission("unknown");
      }
    })();
    return () => { if (status) status.onchange = null; };
  }, [open]);

  // A running test means granted. A test error never downgrades an askable state.
  React.useEffect(() => { if (running) setPermission("granted"); }, [running]);

  // Explicit user opt-in → always attempts getUserMedia (fires the prompt when askable).
  const enableMic = React.useCallback(() => {
    setTestActive(true);
    void start();
  }, [start]);

  // Enumerate devices; labels appear only after a grant, so re-run on `running`
  // and on device hot-plug.
  React.useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setMics(list.filter((d) => d.kind === "audioinput"));
        setSpeakers(list.filter((d) => d.kind === "audiooutput"));
      } catch { /* ignore */ }
    };
    void load();
    const t = setTimeout(load, 800);
    navigator.mediaDevices.addEventListener?.("devicechange", load);
    return () => {
      clearTimeout(t);
      navigator.mediaDevices.removeEventListener?.("devicechange", load);
    };
  }, [open, running]);

  const granted = permission === "granted" || running;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Voice settings"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative z-10 w-full sm:max-w-md max-h-[88dvh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl"
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/8 bg-background/80 backdrop-blur-xl rounded-t-3xl">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FiSliders className="h-4 w-4 text-emerald-500" /> Voice settings
              </h2>
              <button onClick={onClose} aria-label="Close" className="grid place-items-center h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground transition-colors">
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* ── Live mic test ── */}
              <section className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/3 dark:bg-white/3 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FiMic className="h-3.5 w-3.5" /> Test your mic
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium",
                    level > prefs.sensitivity ? "text-emerald-500 dark:text-emerald-400"
                      : permission === "denied" ? "text-red-500" : "text-muted-foreground",
                  )}>
                    {permission === "denied" ? "blocked"
                      : level > prefs.sensitivity ? "hearing you"
                      : running ? "say something…" : "not started"}
                  </span>
                </div>
                {/* Waveform with the sensitivity gate drawn as a threshold line */}
                <div className="relative">
                  <MicWaveform bars={bars} />
                  <div
                    aria-hidden
                    className="absolute inset-y-0 w-px bg-amber-400/70"
                    style={{ left: `${Math.min(prefs.sensitivity / 0.3, 1) * 100}%` }}
                    title="Input sensitivity gate"
                  />
                </div>

                {permission === "denied" ? (
                  <div className="mt-3 rounded-xl bg-red-500/8 border border-red-500/20 p-3 space-y-2.5">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" /> Microphone blocked for this site
                    </p>
                    <ol className="text-[11px] text-red-600/90 dark:text-red-400/90 space-y-1 list-decimal pl-4 marker:text-red-500/60">
                      <li>Click the <span className="font-medium">mic</span> / <span className="font-medium">🔒 lock</span> icon in the address bar.</li>
                      <li>Set <span className="font-medium">Microphone → Allow</span>.</li>
                      <li>Hit <span className="font-medium">Reload</span>.</li>
                    </ol>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button onClick={() => window.location.reload()} className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 transition-colors">Reload page</button>
                      <button onClick={enableMic} className="text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-red-500/15 text-red-600/80 dark:text-red-400/80 transition-colors">Check again</button>
                    </div>
                  </div>
                ) : !running ? (
                  <button onClick={enableMic} className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-black px-4 py-2.5 text-sm font-semibold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
                    <FiMic className="h-4 w-4" /> Enable microphone
                  </button>
                ) : null}
                {error && permission !== "denied" && (
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 text-center">{error} — click “Enable microphone” to try again.</p>
                )}
              </section>

              {/* ── Input device + volume ── */}
              <Section icon={<FiMic className="h-3.5 w-3.5" />} title="Input">
                <ThemedSelect
                  ariaLabel="Microphone"
                  options={toOptions(mics, "System default mic")}
                  value={prefs.micDeviceId}
                  onChange={(v) => update({ micDeviceId: v })}
                />
                {!granted && mics.every((m) => !m.label) && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">Enable your microphone above to see device names.</p>
                )}
                <SliderRow
                  label="Input volume"
                  value={prefs.micGain}
                  min={0.25} max={2} step={0.05}
                  onChange={(v) => update({ micGain: v })}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </Section>

              {/* ── Output device + volume ── */}
              <Section icon={<FiVolume2 className="h-3.5 w-3.5" />} title="Output">
                <ThemedSelect
                  ariaLabel="Speaker"
                  options={toOptions(speakers, "System default speaker")}
                  value={prefs.spkDeviceId}
                  onChange={(v) => update({ spkDeviceId: v })}
                />
                <SliderRow
                  label="Output volume"
                  value={prefs.outputVolume}
                  min={0} max={1} step={0.01}
                  onChange={(v) => update({ outputVolume: v })}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </Section>

              {/* ── Input sensitivity (VAD gate) ── */}
              <Section icon={<FiZap className="h-3.5 w-3.5" />} title="Input sensitivity">
                <p className="text-[11px] text-muted-foreground -mt-1 mb-1">
                  Quiet sounds below the line are treated as silence (ignored), so background noise doesn’t transmit.
                </p>
                <SliderRow
                  label="Threshold"
                  value={prefs.sensitivity}
                  min={0} max={0.3} step={0.005}
                  onChange={(v) => update({ sensitivity: v })}
                  format={(v) => (v <= 0.001 ? "off" : `${Math.round((v / 0.3) * 100)}%`)}
                  accent="amber"
                />
              </Section>

              {/* ── Noise & processing ── */}
              <Section icon={<FiSliders className="h-3.5 w-3.5" />} title="Noise & processing">
                <ToggleRow
                  label="Noise suppression"
                  desc="Filter out background noise (Krisp-like, browser-native)"
                  checked={prefs.noiseSuppression}
                  onChange={(v) => update({ noiseSuppression: v })}
                />
                <ToggleRow
                  label="Echo cancellation"
                  desc="Stop your speakers echoing back into the mic"
                  checked={prefs.echoCancellation}
                  onChange={(v) => update({ echoCancellation: v })}
                />
                <ToggleRow
                  label="Auto gain control"
                  desc="Auto-level your volume as you speak"
                  checked={prefs.autoGainControl}
                  onChange={(v) => update({ autoGainControl: v })}
                />
              </Section>

              {/* ── Push-to-talk ── */}
              <Section icon={<FiMic className="h-3.5 w-3.5" />} title="Voice mode">
                <div className="grid grid-cols-2 gap-2">
                  <ModeButton active={prefs.mode === "voice"} onClick={() => update({ mode: "voice" })} title="Voice activity" desc="Transmit when you speak" />
                  <ModeButton active={prefs.mode === "ptt"} onClick={() => update({ mode: "ptt" })} title="Push to talk" desc="Hold a key to talk" />
                </div>
                {prefs.mode === "ptt" && (
                  <PttKeyCapture value={prefs.pttKey} onChange={(k) => update({ pttKey: k })} />
                )}
              </Section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, format, accent = "emerald",
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string; accent?: "emerald" | "amber";
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const track = accent === "amber" ? "#f59e0b" : "#10b981";
  return (
    <div className="pt-0.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10
          [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
        style={{ background: `linear-gradient(to right, ${track} ${pct}%, rgba(120,120,120,0.25) ${pct}%)` }}
      />
    </div>
  );
}

function ToggleRow({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer rounded-xl px-3 py-2.5 bg-black/3 dark:bg-white/4 hover:bg-black/5 dark:hover:bg-white/6 transition-colors">
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
        className={cn(
          "relative shrink-0 h-6 w-10 rounded-full transition-colors",
          checked ? "bg-emerald-500" : "bg-black/15 dark:bg-white/15",
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
        )} />
      </button>
    </label>
  );
}

function ModeButton({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors border",
        active
          ? "bg-emerald-500/12 border-emerald-500/40 text-foreground"
          : "bg-black/3 dark:bg-white/4 border-transparent hover:bg-black/5 dark:hover:bg-white/6 text-muted-foreground",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-[11px] text-muted-foreground">{desc}</span>
    </button>
  );
}

/** Captures a key press to set the push-to-talk key. */
function PttKeyCapture({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [listening, setListening] = React.useState(false);
  React.useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      onChange(e.code);
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
        "mt-2 w-full rounded-xl px-3 py-2 text-sm transition-colors border",
        listening
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 animate-pulse"
          : "border-black/10 dark:border-white/12 bg-black/3 dark:bg-white/4 hover:bg-black/5 dark:hover:bg-white/6",
      )}
    >
      {listening ? "Press any key…" : <>Hold key: <span className="font-semibold">{label}</span> · click to change</>}
    </button>
  );
}

/** Build ThemedSelect options from a device list, with a system-default entry. */
function toOptions(devices: MediaDeviceInfo[], fallback: string): SelectOption[] {
  return [
    { value: "", label: fallback },
    ...devices.map((d) => ({
      value: d.deviceId,
      label: d.label || `Device ${d.deviceId.slice(0, 6)}`,
    })),
  ];
}
