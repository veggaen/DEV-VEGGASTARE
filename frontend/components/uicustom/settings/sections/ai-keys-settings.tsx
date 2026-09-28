"use client";

/** @fileOverview Settings › AI Keys: bring-your-own provider keys, encrypted server-side. @stability evolving */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FiKey, FiTrash2 } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState, RowList, RowsSkeleton, SectionHeader, Segmented, SettingsCard, SettingsGroup, SettingsRow, StatusPill, fieldClass } from "../settings-primitives";

type Provider = "OPENAI" | "OPENROUTER" | "ANTHROPIC";
type SavedKey = { provider: Provider; isDefault: boolean; maskedKey: string; keyFingerprint: string; updatedAt: string };

const PROVIDER_LABELS: Record<Provider, string> = { OPENAI: "OpenAI", OPENROUTER: "OpenRouter", ANTHROPIC: "Claude (Anthropic)" };
const PROVIDER_OPTIONS: { id: Provider; label: string }[] = [
  { id: "OPENAI", label: "OpenAI" },
  { id: "OPENROUTER", label: "OpenRouter" },
  { id: "ANTHROPIC", label: "Claude" },
];
const isProvider = (v: unknown): v is Provider => v === "OPENAI" || v === "OPENROUTER" || v === "ANTHROPIC";
const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export function AiKeysSettings() {
  const [provider, setProvider] = useState<Provider>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [keys, setKeys] = useState<SavedKey[]>([]);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users/ai-keys", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to load saved keys");
      const next: SavedKey[] = Array.isArray(data?.keys) ? data.keys.filter((k: SavedKey) => isProvider(k?.provider)) : [];
      setKeys(next);
      const defaultKey = next.find((k) => k.isDefault) ?? next[0];
      if (defaultKey) setProvider(defaultKey.provider);
    } catch (error) {
      toast.error(messageOf(error, "Failed to load AI keys"));
      setKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const request = async (method: "PUT" | "PATCH" | "DELETE", body: Record<string, unknown>, fallback: string) => {
    const res = await fetch("/api/users/ai-keys", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || fallback);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) { toast.error("Please paste an API key first"); return; }
    setIsSaving(true);
    try {
      await request("PUT", { provider, apiKey: apiKey.trim(), setDefault: setAsDefault }, "Failed to save API key");
      toast.success("AI key saved securely");
      setApiKey("");
      await loadKeys();
    } catch (error) {
      toast.error(messageOf(error, "Failed to save API key"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (keyProvider: Provider) => {
    setBusyProvider(keyProvider);
    try {
      await request("DELETE", { provider: keyProvider }, "Failed to delete API key");
      toast.success(`${PROVIDER_LABELS[keyProvider]} key deleted`);
      await loadKeys();
    } catch (error) {
      toast.error(messageOf(error, "Failed to delete API key"));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSetDefault = async (keyProvider: Provider) => {
    setBusyProvider(keyProvider);
    try {
      await request("PATCH", { provider: keyProvider }, "Failed to set default provider");
      toast.success(`${PROVIDER_LABELS[keyProvider]} is now your default provider`);
      await loadKeys();
    } catch (error) {
      toast.error(messageOf(error, "Failed to set default provider"));
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiKey} title="AI Keys" description="Bring your own API key. Keys are encrypted, scoped to your account, and can be removed anytime." />

      <SettingsCard as="form" onSubmit={(e) => { e.preventDefault(); void handleSave(); }} className="space-y-4" aria-label="Add an AI key">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Provider</Label>
            <Segmented options={PROVIDER_OPTIONS} value={provider} onChange={setProvider} ariaLabel="AI provider" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-key-input" className="text-sm font-medium">API key</Label>
            <Input id="ai-key-input" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={`Paste your ${PROVIDER_LABELS[provider]} key`} className={fieldClass} />
          </div>
        </div>
        <SettingsRow title="Set as default provider" description="Used whenever you choose saved-key generation." htmlFor="ai-key-default" className="bg-foreground/[0.03]">
          <Switch id="ai-key-default" checked={setAsDefault} onCheckedChange={setSetAsDefault} />
        </SettingsRow>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="vegaEmeraldBtn" disabled={isSaving || !apiKey.trim()} className="min-h-11">{isSaving ? "Saving…" : "Save API key"}</Button>
          <p className="text-xs text-muted-foreground">Your full key is never shown again after saving.</p>
        </div>
      </SettingsCard>

      <SettingsGroup title="Saved keys" description="One key per provider. The default is used when a chat does not name one.">
        {isLoading ? (
          <RowsSkeleton rows={2} label="Loading saved keys" />
        ) : keys.length === 0 ? (
          <EmptyState icon={<FiKey />} title="No saved AI keys yet" description="Add a key above to generate with your own account." />
        ) : (
          <RowList aria-label="Saved AI keys">
            {keys.map((entry) => (
              <SettingsRow
                key={entry.provider}
                icon={<FiKey />}
                title={<span className="flex items-center gap-2">{PROVIDER_LABELS[entry.provider]}{entry.isDefault && <StatusPill tone="accent">Default</StatusPill>}</span>}
                description={<span className="font-mono text-[11px]">{entry.maskedKey}</span>}
              >
                <span className="hidden text-xs text-muted-foreground sm:inline">Updated {new Date(entry.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                {!entry.isDefault && <Button type="button" variant="vegaNormalBtn" size="sm" disabled={busyProvider !== null} onClick={() => void handleSetDefault(entry.provider)} className="min-h-9">Set default</Button>}
                <Button type="button" variant="vegaNormalBtnRed" size="sm" disabled={busyProvider !== null} aria-label={`Delete ${PROVIDER_LABELS[entry.provider]} key`} onClick={() => void handleDelete(entry.provider)} className="min-h-9 gap-1.5">
                  <FiTrash2 aria-hidden="true" className="size-3.5" />{busyProvider === entry.provider ? "Working…" : "Delete"}
                </Button>
              </SettingsRow>
            ))}
          </RowList>
        )}
      </SettingsGroup>
    </div>
  );
}
