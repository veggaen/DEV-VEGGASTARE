"use client";

/**
 * @fileOverview AiEmptyState — the right-pane content of /ai when no conversation
 *   is selected. The conversation list now lives in the shell rail (AiChatShell),
 *   so this is just a welcoming "pick or start" panel with one-click starters.
 *   Keeps the landing aesthetic (starfield is provided by the page background).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

const STARTERS = [
  { icon: "✎", label: "Draft & rewrite", prompt: "Help me draft a clear, friendly product announcement." },
  { icon: "{ }", label: "Explain code", prompt: "Explain this code and suggest how to make it cleaner." },
  { icon: "◎", label: "Plan something", prompt: "Help me break a big goal into a concrete step-by-step plan." },
  { icon: "✦", label: "Brainstorm", prompt: "Brainstorm 10 creative ideas with me, then help me pick." },
];

export function AiEmptyState({ userName }: { userName: string | null }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = React.useState(false);
  const firstName = userName?.split(" ")[0] ?? null;

  const startPrompt = async (prompt?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/ai-chat/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: prompt ? prompt.slice(0, 60) : "New Chat" }),
      });
      if (res.ok) {
        const data = await res.json();
        window.dispatchEvent(new Event("ai-chat:sessions-changed"));
        router.push(prompt ? `/ai/${data.id}?seed=${encodeURIComponent(prompt)}` : `/ai/${data.id}`);
      } else { setBusy(false); }
    } catch { setBusy(false); }
  };

  return (
    <div className="h-full overflow-y-auto grid place-items-center px-6 py-10">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md text-center"
      >
        <div className="mx-auto grid place-items-center h-14 w-14 rounded-2xl bg-emerald-500/10 text-2xl text-emerald-500 dark:text-emerald-400 mb-5">
          ✦
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-500 dark:text-emerald-400">
          AI workspace
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-[-0.03em]">
          {firstName ? `Hey ${firstName} — what's on your mind?` : "What's on your mind?"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a conversation from the left, or start a new one below.
        </p>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => startPrompt(s.prompt)}
              disabled={busy}
              className="group flex items-start gap-3 px-4 py-3.5 rounded-2xl border border-black/6 dark:border-white/8 bg-white/60 dark:bg-white/[0.03] hover:bg-white/90 dark:hover:bg-white/[0.06] disabled:opacity-50 transition-all"
            >
              <span className="shrink-0 grid place-items-center h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-sm group-hover:scale-110 transition-transform">
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.prompt}</span>
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => startPrompt()}
          disabled={busy}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
        >
          {busy ? "Starting…" : "Start a blank chat"}
        </button>
      </motion.div>
    </div>
  );
}
