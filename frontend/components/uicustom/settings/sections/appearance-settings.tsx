"use client";

/**
 * @fileOverview  Settings › Appearance: theme, accent, style preset, effects,
 *                animation intensity, chat layout and the advanced switches.
 *                Every choice is a card in a trailing-box grid or a segmented
 *                toggle; the accent swatches show both halves of the hue.
 * @stability     evolving
 */

import { useTheme } from "next-themes";
import { FiCircle, FiMonitor, FiMoon, FiSliders, FiSun } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ACCENT_PRESETS, useUiPreferences, type AiChatLayout, type AnimationIntensity, type StylePreset } from "@/components/providers/ui-preferences";
import { swapThemeWithReveal } from "@/components/uicustom/chrome/theme-toggle";
import { HoverChaser } from "@/components/uicustom/chrome/hover-chaser";
import { Web3ModeControl } from "@/components/uicustom/settings/web3-mode-control";
import { useClientReady } from "@/hooks/use-client-ready";
import { ChoiceGrid, RowList, SectionHeader, Segmented, SettingsCard, SettingsGroup, SettingsRow } from "../settings-primitives";
import { cn } from "@/lib/utils";

type ThemeId = "light" | "dark" | "system";
const THEMES: { id: ThemeId; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "light", label: "Light", description: "Bright and clean", icon: <FiSun /> },
  { id: "dark", label: "Dark", description: "Easy on the eyes", icon: <FiMoon /> },
  { id: "system", label: "System", description: "Match the device", icon: <FiMonitor /> },
];
const PRESETS: { id: StylePreset; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "minimal", label: "Minimal", description: "Clean and simple", icon: <FiCircle className="opacity-60" /> },
  { id: "modern", label: "Modern", description: "Balanced look", icon: <span className="inline-block size-5 rounded-full bg-linear-to-r from-current to-transparent" /> },
  { id: "vibrant", label: "Vibrant", description: "Full effects", icon: <span className="inline-block size-5 rounded-full bg-current" /> },
];

export function AppearanceSettings() {
  const { prefs, setPrefs, resetPrefs } = useUiPreferences();
  const { theme, setTheme } = useTheme();
  // next-themes only knows the stored theme on the client; pick nothing until hydrated so the markup matches.
  const ready = useClientReady();
  const themeId: ThemeId | null = !ready ? null : theme === "light" || theme === "dark" ? theme : "system";

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiSliders} title="Appearance" description="Customize the look and feel of your experience." />

      <SettingsGroup title="Theme">
        <ChoiceGrid ariaLabel="Theme" columns={3} value={themeId} options={THEMES} onChange={(id, event) => swapThemeWithReveal(() => setTheme(id), { x: event.clientX, y: event.clientY })} />
      </SettingsGroup>

      <SettingsGroup title="Accent colour" description="Buttons, links, the rail and the Veggat™ mark follow this in both themes.">
        <HoverChaser role="radiogroup" aria-label="Accent colour" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" boxClassName="rounded-xl">
          {ACCENT_PRESETS.map((preset) => {
            const selected = prefs.accent === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                title={preset.hint}
                onClick={() => setPrefs({ accent: preset.id })}
                data-chase
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition-[border-color,background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-brand-accent/60 bg-brand-accent/10 text-foreground" : "border-border/60 bg-card/60 text-muted-foreground",
                )}
              >
                <span aria-hidden="true" className="relative size-7 rounded-full shadow-e1 ring-2 ring-background" style={{ background: `linear-gradient(135deg, ${preset.swatch.light} 50%, ${preset.swatch.dark} 50%)` }}>
                  {selected && <span className="absolute inset-0 rounded-full ring-2 ring-brand-accent ring-offset-2 ring-offset-background" />}
                </span>
                <span>{preset.label}</span>
              </button>
            );
          })}
        </HoverChaser>
      </SettingsGroup>

      <SettingsGroup title="Style preset" description="A starting point; the switches below fine-tune it.">
        <ChoiceGrid
          ariaLabel="Style preset"
          columns={3}
          value={prefs.stylePreset}
          options={PRESETS}
          onChange={(id) => setPrefs({
            stylePreset: id,
            ...(id === "vibrant" ? { enableGradientBackgrounds: true, enableGradientSpheres: true, pageAnimations: "full" as const, hoverEffects: "colorful" as const } : {}),
            ...(id === "minimal" ? { enableGradientBackgrounds: false, enableGradientSpheres: false, pageAnimations: "subtle" as const, hoverEffects: "simple" as const } : {}),
          })}
        />
      </SettingsGroup>

      <SettingsGroup title="Visual effects">
        <RowList aria-label="Visual effects">
          <SettingsRow title="Gradient backgrounds" description="Soft colour washes on pages and cards" htmlFor="pref-gradients">
            <Switch id="pref-gradients" checked={prefs.enableGradientBackgrounds} onCheckedChange={(checked) => setPrefs({ enableGradientBackgrounds: checked })} />
          </SettingsRow>
          <SettingsRow title="Floating spheres" description="Animated gradient orbs in the background" htmlFor="pref-spheres">
            <Switch id="pref-spheres" checked={prefs.enableGradientSpheres} onCheckedChange={(checked) => setPrefs({ enableGradientSpheres: checked })} />
          </SettingsRow>
          <SettingsRow title="Colourful hover effects" description="Tinted hover transitions instead of plain highlights" htmlFor="pref-hover">
            <Switch id="pref-hover" checked={prefs.hoverEffects === "colorful"} onCheckedChange={(checked) => setPrefs({ hoverEffects: checked ? "colorful" : "simple" })} />
          </SettingsRow>
        </RowList>
      </SettingsGroup>

      <SettingsGroup title="Motion">
        <SettingsCard className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Page transitions</p>
            <p className="text-xs text-muted-foreground">How much pages move as you navigate. Your system’s reduced-motion setting always wins.</p>
          </div>
          <Segmented<AnimationIntensity> ariaLabel="Page transitions" value={prefs.pageAnimations} onChange={(id) => setPrefs({ pageAnimations: id })} options={[{ id: "none", label: "None" }, { id: "subtle", label: "Subtle" }, { id: "full", label: "Full" }]} />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Chat">
        <SettingsCard className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">AI chat layout</p>
            <p className="text-xs text-muted-foreground">How the conversation list sits next to the chat on the AI page.</p>
          </div>
          <Segmented<AiChatLayout> ariaLabel="AI chat layout" value={prefs.aiChatLayout} onChange={(id) => setPrefs({ aiChatLayout: id })} options={[{ id: "persistent", label: "Sidebar", description: "List always docked left" }, { id: "overlay", label: "Overlay", description: "Chat full-width, list slides in" }]} />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Advanced">
        <RowList aria-label="Advanced">
          <SettingsRow title="Web3 mode" description="Wallet controls and crypto features across the app">
            <Web3ModeControl />
          </SettingsRow>
          <SettingsRow title="Experimental effects" description="Bleeding-edge visual features; may be unstable" htmlFor="pref-experimental">
            <Switch id="pref-experimental" checked={prefs.enableExperimentalEffects} onCheckedChange={(checked) => setPrefs({ enableExperimentalEffects: checked })} />
          </SettingsRow>
        </RowList>
      </SettingsGroup>

      <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
        <Button type="button" variant="vegaNormalBtn" onClick={resetPrefs} className="min-h-11">Reset to defaults</Button>
        <p className="text-xs text-muted-foreground">Back to the minimal, clean defaults. The theme itself is kept.</p>
      </div>
    </div>
  );
}
