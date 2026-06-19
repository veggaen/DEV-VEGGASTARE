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
import { FiX, FiMic, FiVolume2, FiAlertTriangle } from "react-icons/fi";
import { useMicLevel } from "@/lib/voice/useMicLevel";
import { MicWaveform } from "./MicWaveform";
import { ThemedSelect, type SelectOption } from "./ThemedSelect";

const LS_MIC = "voice:micDeviceId";
const LS_SPK = "voice:spkDeviceId";

type MicPermission = "unknown" | "prompt" | "granted" | "denied";

export function VoiceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const [mics, setMics] = React.useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = React.useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = React.useState<string>("");
  const [spkId, setSpkId] = React.useState<string>("");
  const [permission, setPermission] = React.useState<MicPermission>("unknown");
  // We do NOT auto-request the mic on open. The live test only runs once the user
  // opts in (clicks "Allow microphone"), OR if permission is already granted — so
  // we never aggressively trigger (and risk latching) a permission prompt/denial.
  const [testActive, setTestActive] = React.useState(false);

  const { bars, level, error, running, start } = useMicLevel({
    deviceId: micId || undefined,
    active: open && testActive,
  });

  // Track the live mic permission state so we can show the right affordance
  // (Allow button when promptable, unblock instructions when hard-denied).
  React.useEffect(() => {
    if (!open) { setTestActive(false); return; }
    let status: PermissionStatus | null = null;
    const sync = (s: PermissionState) => {
      setPermission(s as MicPermission);
      // If already granted, show the live test straight away (no extra click).
      if (s === "granted") setTestActive(true);
    };
    (async () => {
      try {
        // `microphone` isn't in older TS lib doms; cast the name.
        status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        sync(status.state);
        status.onchange = () => status && sync(status.state);
      } catch {
        setPermission("unknown"); // Permissions API unsupported (e.g. some Safari)
      }
    })();
    return () => { if (status) status.onchange = null; };
  }, [open]);

  // The Permissions API is the source of truth for blocked-vs-askable. A live-test
  // error must NOT downgrade an askable (prompt) state to "denied" — otherwise the
  // modal shows the scary "blocked" UI and never offers the Allow button, so the
  // browser prompt is never triggered. Only a running test promotes to "granted".
  React.useEffect(() => {
    if (running) setPermission("granted");
  }, [running]);

  // User explicitly opts into the mic. start() performs the getUserMedia request;
  // making testActive true keeps it live afterward.
  const requestMic = React.useCallback(() => {
    setTestActive(true);
    void start();
  }, [start]);

  // Enumerate devices while open. Labels (and sometimes the full device list) only
  // appear after a permission grant, so we re-enumerate when `running` flips, and
  // we listen for `devicechange` so a headset plugged in AFTER load shows up.
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
    const t = setTimeout(load, 800); // re-load once labels become available
    navigator.mediaDevices.addEventListener?.("devicechange", load);
    return () => {
      clearTimeout(t);
      navigator.mediaDevices.removeEventListener?.("devicechange", load);
    };
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
                <span className={`text-[10px] ${level > 0.04 ? "text-emerald-500 dark:text-emerald-400" : permission === "denied" ? "text-red-500" : "text-muted-foreground"}`}>
                  {permission === "denied" ? "blocked" : level > 0.04 ? "hearing you" : running ? "say something…" : "not started"}
                </span>
              </div>
              <MicWaveform bars={bars} />

              {/* Permission-aware affordance.
                  NOTE: a hard-denied mic permission CANNOT be re-granted from JS —
                  the browser only lets the user change it in site settings. So we
                  give precise steps + a Reload (which re-reads the permission after
                  they change it). "Check again" covers the case where they changed
                  it via the address-bar control without a full reload. */}
              {permission === "denied" ? (
                <div className="mt-3 rounded-xl bg-red-500/8 border border-red-500/20 p-3 space-y-2.5">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Microphone blocked for this site
                  </p>
                  <ol className="text-[11px] text-red-600/90 dark:text-red-400/90 space-y-1 list-decimal pl-4 marker:text-red-500/60">
                    <li>Click the <span className="font-medium">mic</span> or <span className="font-medium">🔒 lock</span> icon at the left of the address bar.</li>
                    <li>Set <span className="font-medium">Microphone → Allow</span>.</li>
                    <li>Hit <span className="font-medium">Reload</span> below.</li>
                  </ol>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={() => window.location.reload()}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 transition-colors"
                    >
                      Reload page
                    </button>
                    <button
                      onClick={requestMic}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-red-500/15 text-red-600/80 dark:text-red-400/80 transition-colors"
                    >
                      Check again
                    </button>
                  </div>
                </div>
              ) : !running ? (
                <button
                  onClick={requestMic}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/12 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 px-4 py-2 text-sm font-medium transition-colors"
                >
                  <FiMic className="h-4 w-4" /> Allow microphone
                </button>
              ) : null}
              {/* Transient errors (e.g. dismissed prompt) — shown WITHOUT the scary
                  blocked panel, since the permission is still askable. */}
              {error && permission !== "denied" && (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 text-center">{error} — click “Allow microphone” to try again.</p>
              )}
            </div>

            {/* Input device */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FiMic className="h-3.5 w-3.5" /> Microphone
              </label>
              <ThemedSelect
                ariaLabel="Microphone"
                options={toOptions(mics, "System default mic")}
                value={micId}
                onChange={pickMic}
              />
            </div>

            {/* Output device */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FiVolume2 className="h-3.5 w-3.5" /> Speaker
              </label>
              <ThemedSelect
                ariaLabel="Speaker"
                options={toOptions(speakers, "System default speaker")}
                value={spkId}
                onChange={pickSpk}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
