"use client";

/**
 * @fileOverview Browser media-device helpers shared by voice settings, the room
 * UI, and providers. The goal is to keep permission prompts, stale device IDs,
 * and browser-specific errors consistent across the voice surface.
 * @stability experimental
 */

import { audioConstraintsFromPrefs, readVoicePrefs, type VoicePrefs } from "./voice-prefs";

export type MicPermissionState = "unknown" | "prompt" | "granted" | "denied";

export interface AudioDeviceLists {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
}

export interface MediaErrorContext {
  permission?: MicPermissionState;
  devices?: AudioDeviceLists | null;
}

type MediaDevicesWithOutputPicker = MediaDevices & {
  selectAudioOutput?: (options?: { deviceId?: string }) => Promise<MediaDeviceInfo>;
};

export function hasMediaDevices() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export async function queryMicrophonePermission(): Promise<MicPermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state as MicPermissionState;
  } catch {
    return "unknown";
  }
}

export async function watchMicrophonePermission(
  onChange: (state: MicPermissionState) => void,
): Promise<PermissionStatus | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    onChange(status.state as MicPermissionState);
    status.onchange = () => onChange(status.state as MicPermissionState);
    return status;
  } catch {
    return null;
  }
}

export async function enumerateAudioDevices(): Promise<AudioDeviceLists> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    throw new Error("This browser cannot list audio devices.");
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    inputs: devices.filter((device) => device.kind === "audioinput"),
    outputs: devices.filter((device) => device.kind === "audiooutput"),
  };
}

export async function openMicrophoneStream(prefs: VoicePrefs = readVoicePrefs()): Promise<MediaStream> {
  if (!hasMediaDevices()) {
    throw new Error("Microphone access is unavailable in this browser or context.");
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Microphone access requires HTTPS or localhost.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraintsFromPrefs(prefs),
    });
  } catch (error) {
    // A saved `deviceId: exact(...)` can become stale after unplugging a headset,
    // switching browser profiles, or changing OS audio devices. That should not
    // make the whole voice feature look blocked; retry the system default while
    // preserving the user's processing preferences.
    if (prefs.micDeviceId && isSelectedDeviceError(error)) {
      return navigator.mediaDevices.getUserMedia({
        audio: audioConstraintsFromPrefs({ ...prefs, micDeviceId: "" }),
      });
    }
    throw error;
  }
}

export function getMediaErrorName(error: unknown): string {
  if (error instanceof DOMException) return error.name;
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : "Error";
  }
  return "Error";
}

export async function describeCurrentMediaError(error: unknown): Promise<string> {
  const [permission, devices] = await Promise.all([
    queryMicrophonePermission(),
    enumerateAudioDevices().catch(() => null),
  ]);
  return describeMediaError(error, { permission, devices });
}

export function describeMediaError(error: unknown, context?: MediaErrorContext): string {
  const name = getMediaErrorName(error);
  const permission = context?.permission;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      if (permission === "granted") {
        return `Chrome is allowed for this site, but the microphone is still blocked before VeggaStare can open it.${getOsMicrophoneGuidance()} Also close other apps that may be holding the mic, then restart Chrome and try again.`;
      }
      if (permission === "prompt") {
        return "Chrome is ready to ask for microphone access. Click Allow microphone and choose Allow in the browser prompt. If no prompt appears, check the address-bar lock icon.";
      }
      return "Microphone permission was denied. Allow microphone access for this site, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return `No microphone was found by the browser.${getOsMicrophoneGuidance()} Connect or enable an input device, then refresh devices.`;
    case "NotReadableError":
    case "TrackStartError":
      return `The microphone exists, but Chrome could not start it. Close other apps that may be using the mic, check the Windows input device, then restart Chrome if it stays stuck.`;
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "The selected microphone is unavailable. Choose System default or another input.";
    case "SecurityError":
      if (permission === "granted") {
        return `The page is allowed to use the microphone, but Chrome blocked capture in this browser context.${getOsMicrophoneGuidance()}`;
      }
      return "Microphone access is blocked by the browser context. Use HTTPS or localhost.";
    default:
      return error instanceof Error ? error.message : "Could not open the microphone.";
  }
}

export function isPermissionDeniedError(error: unknown) {
  const name = getMediaErrorName(error);
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError";
}

export function isSelectedDeviceError(error: unknown) {
  const name = getMediaErrorName(error);
  return name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError";
}

export function getOsMicrophoneGuidance() {
  const platform = getClientPlatform();
  if (/win/i.test(platform)) {
    return " On Windows, open Settings > Privacy > Microphone and enable microphone access plus desktop app access for Chrome. On Windows 10 N / Pro N, install or enable the Microsoft Media Feature Pack, then restart Chrome.";
  }
  if (/mac/i.test(platform)) {
    return " On macOS, open System Settings > Privacy & Security > Microphone and allow Chrome.";
  }
  return " Check your operating-system microphone privacy settings and make sure Chrome is allowed to record.";
}

function getClientPlatform() {
  if (typeof navigator === "undefined") return "";
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.platform || "";
}

export function supportsAudioOutputPicker() {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator.mediaDevices as MediaDevicesWithOutputPicker | undefined)?.selectAudioOutput === "function";
}

export async function selectAudioOutputDevice(currentDeviceId?: string): Promise<MediaDeviceInfo> {
  const devices = navigator.mediaDevices as MediaDevicesWithOutputPicker | undefined;
  if (!devices?.selectAudioOutput) {
    throw new Error("This browser does not expose a speaker permission picker. Use the system output or a listed speaker.");
  }
  return devices.selectAudioOutput(currentDeviceId ? { deviceId: currentDeviceId } : undefined);
}
