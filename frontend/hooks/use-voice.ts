"use client";

import { useUiPreferences } from "@/components/providers/ui-preferences";
import { getVoice, type VoicePack } from "@/lib/voice/tone";

/**
 * useVoice — the active brand-voice copy pack, driven by the user's
 * `toneOfVoice` preference (defaults to "vibe"). Centralizes product copy so
 * the app speaks consistently and the voice is switchable from settings.
 *
 *   const t = useVoice();
 *   <Button>{t.buyNow}</Button>
 */
export function useVoice(): VoicePack {
  const { prefs } = useUiPreferences();
  return getVoice(prefs.toneOfVoice);
}
