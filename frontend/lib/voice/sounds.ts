"use client";

type VoiceCueKind = "join" | "leave";

const CUES: Record<VoiceCueKind, Array<{ hz: number; at: number; dur: number }>> = {
  join: [
    { hz: 523.25, at: 0, dur: 0.08 },
    { hz: 783.99, at: 0.09, dur: 0.11 },
  ],
  leave: [
    { hz: 659.25, at: 0, dur: 0.08 },
    { hz: 392, at: 0.09, dur: 0.12 },
  ],
};

type SinkAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function getAudioContextCtor() {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

export async function playVoiceCue(kind: VoiceCueKind, sinkId?: string, volume = 0.45) {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) return;

  const ctx = new AudioContextCtor();
  const destination = ctx.createMediaStreamDestination();
  const output = new Audio() as SinkAudioElement;
  output.srcObject = destination.stream;
  output.volume = Math.max(0, Math.min(1, volume));

  try {
    if (sinkId && output.setSinkId) await output.setSinkId(sinkId);
    await output.play();
  } catch {
    // Browser autoplay or sink routing may be unavailable; the cue is optional.
  }

  const now = ctx.currentTime;
  for (const note of CUES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.hz, now + note.at);
    gain.gain.setValueAtTime(0.0001, now + note.at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.12), now + note.at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(now + note.at);
    osc.stop(now + note.at + note.dur + 0.02);
  }

  window.setTimeout(() => {
    output.pause();
    output.srcObject = null;
    void ctx.close();
  }, 420);
}
