"use client";

/**
 * @fileOverview VoiceSettingsModal — pick mic (input) + speaker (output) devices
 *   and TEST the mic with a live frequency waveform (flat when silent, bounces
 *   when you speak). Device selections are persisted to localStorage so the voice
 *   provider can honour them. Output selection uses setSinkId where supported.
 *
 *   Built in the app's glassy landing language; responsive (full-screen sheet on
 *   phones, centered card on desktop); both themes.
 * @stability experimental
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FiX, FiMic, FiVolume2 } from "react-icons/fi";
import { useMicLevel } from "@/lib/voice/useMicLevel";
import { MicWaveform } from "./MicWaveform";

const LS_MIC = "voice:micDeviceId";
const LS_SPK = "voice:spkDeviceId";

export function VoiceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const [mics, setMics] = React.useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = React.useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = React.useState<string>("");
  const [spkId, setSpkId] = React.useState<string>("");

  const { bars, level, error, running } = useMicLevel({ deviceId: micId || undefined, active: open });

  // Enumerate devices once open (labels require a prior permission grant, which
  // useMicLevel triggers, so we re-enumerate after it starts).
  React.useEffect(() => {
    if (!open) return;
    setMicId(localStorage.getItem(LS_MIC) ?? "");
    setSpkId(localStorage.getItem(LS_SPK) ?? "");
    const load = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setMics(list.filter((d) => d.kind === "audioinput"));
        setSpeakers(list.filter((d) => d.kind === "audiooutput"));
      } catch { /* ignore */ }
    };
    void load();
    const t = setTimeout(load, 800); // re-load once labels are available
    return () => clearTimeout(t);
  }, [open, running]);

  const pickMic = (id: string) => { setMicId(id); localStorage.setItem(LS_MIC, id); };
  const pickSpk = (id: string) => { setSpkId(id); localStorage.setItem(LS_SPK, id); };

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
            className="relative z-10 w-full sm:max-w-md glass-panel rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Voice settings</h2>
              <button onClick={onClose} aria-label="Close" className="grid place-items-center h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground transition-colors">
                <FiX className="h-4 w-4" />
              </button>
            </div>

            {/* Live mic test */}
            <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/3 dark:bg-white/3 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FiMic className="h-3.5 w-3.5" /> Test your mic
                </span>
                <span className={`text-[10px] ${level > 0.04 ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {error ? "blocked" : level > 0.04 ? "hearing you" : "say something…"}
                </span>
              </div>
              <MicWaveform bars={bars} />
              {error && <p className="text-[11px] text-red-500 mt-2 text-center">{error}</p>}
            </div>

            {/* Input device */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FiMic className="h-3.5 w-3.5" /> Microphone
              </label>
              <DeviceSelect devices={mics} value={micId} onChange={pickMic} fallback="System default mic" />
            </div>

            {/* Output device */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FiVolume2 className="h-3.5 w-3.5" /> Speaker
              </label>
              <DeviceSelect devices={speakers} value={spkId} onChange={pickSpk} fallback="System default speaker" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DeviceSelect({
  devices, value, onChange, fallback,
}: { devices: MediaDeviceInfo[]; value: string; onChange: (id: string) => void; fallback: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl bg-black/4 dark:bg-white/5 border border-black/8 dark:border-white/10 px-3 py-2 text-sm text-foreground outline-none focus:border-emerald-500/50 transition-colors"
    >
      <option value="">{fallback}</option>
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label || `Device ${d.deviceId.slice(0, 6)}`}
        </option>
      ))}
    </select>
  );
}
