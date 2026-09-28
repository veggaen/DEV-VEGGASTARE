"use client";

/**
 * @fileOverview  "Watch it work" — a self-playing tour of Veggat. A scripted
 *                cursor works through four scenes inside a browser frame:
 *                post a pulse with a poll, list a physical product, draw a
 *                trend line and fill a paper order, ask the AI in a room.
 *                Loops while in view, pauses on hover and when the tab is
 *                hidden; with reduced motion it shows finished scenes you can
 *                switch by hand. Every element is HTML/CSS with tokens.
 * @stability     evolving
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiBarChart2, FiCheck, FiCpu, FiPackage, FiPause, FiPlay, FiSend, FiTrendingUp, FiUsers } from "react-icons/fi";
import { PulseHeart, PulsePositive } from "@/components/uicustom/icons/PulseIcons";
import { useHydratedReducedMotion as useReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { cn } from "@/lib/utils";

type SceneId = "pulse" | "market" | "terminal" | "ai";
const SCENES: { id: SceneId; label: string; caption: string; url: string; icon: React.ReactNode; duration: number }[] = [
  { id: "pulse", label: "Post a pulse", caption: "Write, add a poll, publish. Reach starts counting.", url: "veggat.com/pulse", icon: <PulseHeart />, duration: 7200 },
  { id: "market", label: "List a product", caption: "Photos, price, shipping. Physical or digital, live in one screen.", url: "veggat.com/products/create", icon: <FiPackage />, duration: 7600 },
  { id: "terminal", label: "Trade on the chart", caption: "Draw a trend line, place a paper order, watch it fill.", url: "veggat.com/dashboard/trading", icon: <FiTrendingUp />, duration: 7200 },
  { id: "ai", label: "Ask the room", caption: "People and the model in one thread, cost shown before you send.", url: "veggat.com/ai", icon: <FiCpu />, duration: 7800 },
];

type Cursor = { x: number; y: number; click: number };
type Step = { at: number; run: () => void };
const EASE = [0.22, 1, 0.36, 1] as const;

/** Runs `steps` (a memoised array) at their offsets whenever `running` flips on or `key` changes; cleared on pause. */
function useTimeline(steps: Step[], running: boolean, key: string) {
  React.useEffect(() => {
    if (!running) return;
    const timers = steps.map((s) => setTimeout(s.run, s.at));
    return () => timers.forEach(clearTimeout);
  }, [running, key, steps]);
}

/** Type `text` into `set` one character at a time from `start`. */
function typing(set: (v: string) => void, text: string, start: number, perChar = 42): Step[] {
  return Array.from(text).map((_, i) => ({ at: start + i * perChar, run: () => set(text.slice(0, i + 1)) }));
}

const stageText = "text-[11px] leading-snug";
const field = "rounded-lg border border-border/70 bg-background/70 px-2.5 py-1.5 text-left text-[11px] text-foreground dark:bg-foreground/[0.05]";
const primaryBtn = "inline-flex items-center gap-1 rounded-full bg-brand-accent px-3 py-1.5 text-[11px] font-semibold text-brand-accent-foreground shadow-e1";

// ── Scene 1: Pulse ────────────────────────────────────────────────────────────

function PulseScene({ running, instant, setCursor, cycle }: { running: boolean; instant: boolean; setCursor: (c: Partial<Cursor>) => void; cycle: string }) {
  const [text, setText] = React.useState(instant ? "New batch of prints is live. Black or oak frame?" : "");
  const [poll, setPoll] = React.useState(instant);
  const [posted, setPosted] = React.useState(instant);
  const [hearts, setHearts] = React.useState(instant ? 128 : 0);
  React.useEffect(() => { if (!instant) { setText(""); setPoll(false); setPosted(false); setHearts(0); } }, [cycle, instant]);
  const steps = React.useMemo<Step[]>(() => [
    { at: 0, run: () => setCursor({ x: 34, y: 20 }) },
    { at: 600, run: () => setCursor({ click: 1 }) },
    ...typing(setText, "New batch of prints is live. Black or oak frame?", 800),
    { at: 3000, run: () => setCursor({ x: 12, y: 41 }) },
    { at: 3500, run: () => { setCursor({ click: 2 }); setPoll(true); } },
    { at: 4400, run: () => setCursor({ x: 88, y: 41 }) },
    { at: 4900, run: () => { setCursor({ click: 3 }); setPosted(true); } },
    ...Array.from({ length: 16 }, (_, i) => ({ at: 5300 + i * 70, run: () => setHearts(Math.round(((i + 1) / 16) * 128)) })),
  ], [setCursor]);
  useTimeline(steps, running, cycle);
  return (
    <div className="absolute inset-0 p-[5%]">
      <div className={cn("rounded-xl border border-border/60 bg-surface-1/80 p-3 shadow-e1", stageText)}>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">New pulse</p>
        <div className="flex gap-2">
          <span className="size-6 shrink-0 rounded-full bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.6),hsl(var(--muted)))]" />
          <p className="min-h-[2.4em] flex-1 text-foreground">{text || <span className="text-muted-foreground">What’s happening on your side of Veggat?</span>}{running && !posted && text.length < 49 && <span className="ml-px inline-block h-3 w-px animate-pulse bg-brand-accent align-middle" />}</p>
        </div>
        <AnimatePresence>
          {poll && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2 ml-8 flex gap-1.5">{["Black", "Oak"].map((o) => <span key={o} className={cn(field, "flex-1")}>{o}</span>)}</div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("grid size-6 place-items-center rounded-full", poll ? "bg-brand-accent/15 text-brand-accent" : "")}><FiBarChart2 className="size-3" /></span>
            <span className="grid size-6 place-items-center rounded-full">#</span>
          </div>
          <span className={cn(primaryBtn, posted && "opacity-60")}><PulsePositive className="size-3" />Pulse</span>
        </div>
      </div>
      <AnimatePresence>
        {posted && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className={cn("mt-3 rounded-xl border border-border/60 bg-surface-1/80 p-3 shadow-e1", stageText)}>
            <div className="flex items-center gap-2"><span className="size-5 rounded-full bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.6),hsl(var(--muted)))]" /><span className="font-semibold text-foreground">You</span><span className="text-muted-foreground">· just now</span><span className="ml-auto rounded-full border border-brand-accent/40 bg-brand-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">Reach ×1.2</span></div>
            <p className="mt-1.5 text-foreground">New batch of prints is live. Black or oak frame?</p>
            <div className="mt-2 space-y-1">{[["Black", 62], ["Oak", 38]].map(([o, pct]) => <div key={o} className="relative overflow-hidden rounded-md border border-border/50 px-2 py-1"><motion.span className="absolute inset-y-0 left-0 bg-brand-accent/15" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3, duration: 0.8, ease: EASE }} /><span className="relative flex justify-between"><span>{o}</span><span className="tabular-nums text-muted-foreground">{pct}%</span></span></div>)}</div>
            <div className="mt-2 flex items-center gap-3 text-muted-foreground"><span className="inline-flex items-center gap-1 text-brand-accent"><PulseHeart className="size-3" /><span className="tabular-nums">{hearts}</span></span><span className="inline-flex items-center gap-1"><FiUsers className="size-3" />1.9k reach</span></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Scene 2: Marketplace ──────────────────────────────────────────────────────

function MarketScene({ running, instant, setCursor, cycle }: { running: boolean; instant: boolean; setCursor: (c: Partial<Cursor>) => void; cycle: string }) {
  const [photo, setPhoto] = React.useState(instant);
  const [title, setTitle] = React.useState(instant ? "Oak desk organiser" : "");
  const [price, setPrice] = React.useState(instant ? "890" : "");
  const [ships, setShips] = React.useState(instant);
  const [live, setLive] = React.useState(instant);
  React.useEffect(() => { if (!instant) { setPhoto(false); setTitle(""); setPrice(""); setShips(false); setLive(false); } }, [cycle, instant]);
  const steps = React.useMemo<Step[]>(() => [
    { at: 0, run: () => setCursor({ x: 22, y: 34 }) },
    { at: 600, run: () => { setCursor({ click: 1 }); setPhoto(true); } },
    { at: 1200, run: () => setCursor({ x: 66, y: 22 }) },
    { at: 1600, run: () => setCursor({ click: 2 }) },
    ...typing(setTitle, "Oak desk organiser", 1700, 55),
    { at: 3000, run: () => setCursor({ x: 66, y: 40 }) },
    { at: 3400, run: () => setCursor({ click: 3 }) },
    ...typing(setPrice, "890", 3500, 120),
    { at: 4200, run: () => setCursor({ x: 66, y: 58 }) },
    { at: 4600, run: () => { setCursor({ click: 4 }); setShips(true); } },
    { at: 5400, run: () => setCursor({ x: 84, y: 84 }) },
    { at: 5900, run: () => { setCursor({ click: 5 }); setLive(true); } },
  ], [setCursor]);
  useTimeline(steps, running, cycle);
  return (
    <div className={cn("absolute inset-0 grid grid-cols-[42%_1fr] gap-[4%] p-[5%]", stageText)}>
      <div className="relative">
        <div className={cn("flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors duration-300", photo ? "border-transparent" : "border-border/70 bg-background/40")}>
          <AnimatePresence>{photo ? (
            <motion.div key="photo" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="h-full w-full bg-[linear-gradient(160deg,hsl(var(--brand-accent)/0.45),hsl(var(--muted))_60%,hsl(var(--brand-accent)/0.2))]" />
          ) : (
            <span key="empty" className="px-3 text-center text-muted-foreground">Drop photos or click</span>
          )}</AnimatePresence>
        </div>
        <AnimatePresence>
          {live && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-brand-accent px-2 py-1 text-[10px] font-semibold text-brand-accent-foreground shadow-e2"><FiCheck className="size-3" />Live</motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-2">
        <label className="space-y-1"><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Title</span><span className={cn(field, "block min-h-[1.9em]")}>{title || <span className="text-muted-foreground">e.g. Handcrafted leather wallet</span>}</span></label>
        <label className="space-y-1"><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Price</span><span className={cn(field, "flex min-h-[1.9em] items-center gap-1")}><span className="text-muted-foreground">kr</span>{price || <span className="text-muted-foreground">0</span>}</span></label>
        <div className="space-y-1"><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Type</span>
          <div className="grid grid-cols-2 gap-1.5">
            <span className={cn(field, "transition-colors duration-300", ships && "border-brand-accent/60 bg-brand-accent/10 text-foreground")}>Physical · ships from Oslo</span>
            <span className={field}>Digital · file delivery</span>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-muted-foreground">{live ? "Published to the marketplace" : "Step 3 of 5"}</span>
          <span className={cn(primaryBtn, live && "opacity-60")}>{live ? "Listed" : "Create listing"}</span>
        </div>
      </div>
    </div>
  );
}

// ── Scene 3: Terminal ─────────────────────────────────────────────────────────

const CANDLES = [
  [14, 96, 82, 74, 104], [38, 82, 90, 78, 98], [62, 90, 70, 62, 94], [86, 70, 76, 60, 84], [110, 76, 58, 50, 80], [134, 58, 64, 52, 72],
  [158, 64, 48, 40, 70], [182, 48, 56, 42, 62], [206, 56, 38, 30, 60], [230, 38, 44, 32, 52], [254, 44, 26, 20, 50], [278, 26, 32, 18, 40],
];

function TerminalScene({ running, instant, setCursor, cycle }: { running: boolean; instant: boolean; setCursor: (c: Partial<Cursor>) => void; cycle: string }) {
  const [line, setLine] = React.useState(instant);
  const [order, setOrder] = React.useState<"idle" | "placed" | "filled">(instant ? "filled" : "idle");
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { if (!instant) { setLine(false); setOrder("idle"); } }, [cycle, instant]);
  const steps = React.useMemo<Step[]>(() => [
    { at: 0, run: () => setCursor({ x: 14, y: 66 }) },
    { at: 700, run: () => { setCursor({ click: 1 }); setLine(true); } },
    { at: 800, run: () => setCursor({ x: 58, y: 24 }) },
    { at: 2300, run: () => setCursor({ click: 2 }) },
    { at: 3200, run: () => setCursor({ x: 87, y: 52 }) },
    { at: 3700, run: () => { setCursor({ click: 3 }); setOrder("placed"); } },
    { at: 5200, run: () => setOrder("filled") },
    ...Array.from({ length: 12 }, (_, i) => ({ at: 400 + i * 550, run: () => setTick(i + 1) })),
  ], [setCursor]);
  useTimeline(steps, running, cycle);
  const price = (3112.4 + Math.sin(tick / 2) * 6 + tick * 1.1).toFixed(2);
  return (
    <div className={cn("absolute inset-0 grid grid-cols-[1fr_30%] gap-[3%] p-[4%]", stageText)}>
      <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-surface-1/80 shadow-e1">
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5"><span className="font-semibold text-foreground">ETH / USD <span className="font-normal text-muted-foreground">1H</span></span><span className="tabular-nums text-chart-up">${price}</span></div>
        <svg viewBox="0 0 320 140" className="block h-full w-full flex-1" preserveAspectRatio="none">
          {[30, 60, 90, 120].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="currentColor" className="text-border/50" strokeWidth="1" />)}
          {CANDLES.map(([x, o, c, h, l], i) => {
            const up = c < o; const last = i === CANDLES.length - 1;
            return (
              <g key={x} className={up ? "text-chart-up" : "text-chart-down"}>
                <line x1={x} x2={x} y1={h} y2={l} stroke="currentColor" strokeWidth="1.5" />
                <motion.rect x={x - 5} y={Math.min(o, c)} width="10" height={Math.max(2, Math.abs(o - c))} fill="currentColor" rx="1" animate={last && running ? { scaleY: [1, 1.35, 0.9, 1.2, 1] } : { scaleY: 1 }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }} style={{ transformOrigin: `${x}px ${Math.max(o, c)}px` }} />
              </g>
            );
          })}
          <AnimatePresence>{line && <motion.line key={cycle} x1="14" y1="100" x2="270" y2="30" stroke="hsl(var(--brand-accent))" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0.6 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: instant ? 0 : 1.5, ease: "easeInOut" }} />}</AnimatePresence>
          {running && <motion.line x1="0" x2="0" y1="0" y2="140" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="1" strokeDasharray="3 3" animate={{ x: [0, 320] }} transition={{ repeat: Infinity, duration: 7, ease: "linear" }} />}
        </svg>
        <div className="flex items-center gap-2 border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground"><span className="rounded-full border border-border/60 px-1.5 py-0.5">Trend line</span><span className="rounded-full border border-border/60 px-1.5 py-0.5">RSI</span><span className="rounded-full border border-border/60 px-1.5 py-0.5">VWAP</span></div>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-1/80 p-2.5 shadow-e1">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-foreground/[0.05] p-0.5"><span className="rounded-md bg-brand-accent py-1 text-center text-[10px] font-semibold text-brand-accent-foreground">Buy</span><span className="py-1 text-center text-[10px] text-muted-foreground">Sell</span></div>
        <div className="space-y-1"><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Amount</span><span className={cn(field, "block")}>0.5 ETH</span></div>
        <div className="space-y-1 text-[10px] text-muted-foreground"><div className="flex justify-between"><span>Est. price</span><span className="tabular-nums text-foreground">${price}</span></div><div className="flex justify-between"><span>Account</span><span className="text-foreground">Paper</span></div></div>
        <span className={cn(primaryBtn, "mt-auto justify-center", order !== "idle" && "opacity-60")}>{order === "idle" ? "Buy ETH" : "Working…"}</span>
        <AnimatePresence>
          {order === "filled" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-chart-up/40 bg-chart-up/10 px-2 py-1.5 text-[10px] text-foreground"><span className="font-semibold text-chart-up">Filled</span> · 0.5 ETH @ ${price}</motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Scene 4: AI room ──────────────────────────────────────────────────────────

const AI_REPLY = "The oak frame won the poll (62% black, 38% oak), so lead with black as default and offer oak as the upgrade. Draft: “New prints, two frames, ships this week.”";

function AiScene({ running, instant, setCursor, cycle }: { running: boolean; instant: boolean; setCursor: (c: Partial<Cursor>) => void; cycle: string }) {
  const [draft, setDraft] = React.useState(instant ? "Draft the launch post, mention the poll result" : "");
  const [sent, setSent] = React.useState(instant);
  const [typingOn, setTypingOn] = React.useState(false);
  const [reply, setReply] = React.useState(instant ? AI_REPLY : "");
  React.useEffect(() => { if (!instant) { setDraft(""); setSent(false); setTypingOn(false); setReply(""); } }, [cycle, instant]);
  const steps = React.useMemo<Step[]>(() => {
    const words = AI_REPLY.split(" ");
    return [
      { at: 0, run: () => setCursor({ x: 46, y: 86 }) },
      { at: 500, run: () => setCursor({ click: 1 }) },
      ...typing(setDraft, "Draft the launch post, mention the poll result", 600, 38),
      { at: 2700, run: () => setCursor({ x: 91, y: 86 }) },
      { at: 3100, run: () => { setCursor({ click: 2 }); setSent(true); setDraft(""); } },
      { at: 3500, run: () => setTypingOn(true) },
      { at: 4300, run: () => setTypingOn(false) },
      ...words.map((_, i) => ({ at: 4300 + i * 95, run: () => setReply(words.slice(0, i + 1).join(" ")) })),
    ];
  }, [setCursor]);
  useTimeline(steps, running, cycle);
  const bubble = "max-w-[82%] rounded-xl px-2.5 py-1.5";
  return (
    <div className={cn("absolute inset-0 flex flex-col p-[4%]", stageText)}>
      <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><FiUsers className="size-3 text-brand-accent" />Launch room · Mia, Jonas, you + AI</span><span className="rounded-full border border-border/60 px-1.5 py-0.5">840 credits</span></div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
        <div className={cn(bubble, "bg-foreground/[0.06] text-foreground")}><span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Mia</span>Prints are live. Who writes the launch post?</div>
        <div className={cn(bubble, "bg-foreground/[0.06] text-foreground")}><span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Jonas</span>Use the frame poll result if you can.</div>
        <AnimatePresence>
          {sent && <motion.div key="you" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn(bubble, "ml-auto bg-brand-accent text-brand-accent-foreground")}>Draft the launch post, mention the poll result</motion.div>}
          {typingOn && <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn(bubble, "flex items-center gap-1 border border-brand-accent/30 bg-brand-accent/[0.08]")}>{[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-brand-accent" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />)}</motion.div>}
          {reply && <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn(bubble, "border border-brand-accent/30 bg-brand-accent/[0.08] text-foreground")}><span className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"><span>Veggat AI</span><span className="normal-case tracking-normal">12 credits</span></span>{reply}</motion.div>}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-border/70 bg-background/70 py-1 pl-3 pr-1 dark:bg-foreground/[0.05]"><span className="min-h-[1.4em] flex-1 text-foreground">{draft || <span className="text-muted-foreground">Ask the room…</span>}</span><span className="grid size-6 place-items-center rounded-full bg-brand-accent text-brand-accent-foreground"><FiSend className="size-3" /></span></div>
    </div>
  );
}

// ── The frame ─────────────────────────────────────────────────────────────────

function FakeCursor({ cursor, visible }: { cursor: Cursor; visible: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute z-20"
      animate={{ left: `${cursor.x}%`, top: `${cursor.y}%`, opacity: visible ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 20, mass: 0.8 }}
      style={{ left: "50%", top: "50%" }}
    >
      <AnimatePresence>
        {cursor.click > 0 && (
          <motion.span key={cursor.click} className="absolute -left-3 -top-3 size-6 rounded-full border-2 border-brand-accent" initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 1.6, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} />
        )}
      </AnimatePresence>
      <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"><path d="M2 1.5 15.5 11.8 9.2 12.6 12.6 18.6 10.2 19.8 6.8 13.8 2.2 18.4z" fill="hsl(var(--foreground))" stroke="hsl(var(--background))" strokeWidth="1.2" strokeLinejoin="round" /></svg>
    </motion.div>
  );
}

export function LandingDemoLoop() {
  const reduceMotion = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);
  const [inView, setInView] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const [manualPause, setManualPause] = React.useState(false);
  const [cursor, setCursorState] = React.useState<Cursor>({ x: 50, y: 50, click: 0 });
  const setCursor = React.useCallback((c: Partial<Cursor>) => setCursorState((prev) => ({ ...prev, ...c, click: c.click ?? prev.click })), []);

  React.useEffect(() => {
    const el = rootRef.current; if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const running = !reduceMotion && inView && !hover && !hidden && !manualPause;
  const scene = SCENES[index];
  const key = `${scene.id}-${cycle}`;

  // Advance to the next scene when the current one has played out.
  React.useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => { setIndex((i) => (i + 1) % SCENES.length); setCycle((c) => c + 1); }, scene.duration);
    return () => clearTimeout(t);
  }, [running, key, scene.duration]);

  const go = (i: number) => { setIndex(i); setCycle((c) => c + 1); };
  const sceneProps = { running, instant: reduceMotion, setCursor, cycle: key };

  return (
    <div ref={rootRef} className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      {/* Scene list */}
      <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible" aria-label="Demo scenes">
        {SCENES.map((s, i) => {
          const active = i === index;
          return (
            <li key={s.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative flex w-full min-w-44 items-start gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-w-0",
                  active ? "border-brand-accent/50 bg-brand-accent/[0.08]" : "border-border/60 bg-surface-1/60 hover:border-border",
                )}
              >
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg [&>svg]:size-4", active ? "bg-brand-accent/15 text-brand-accent" : "bg-foreground/[0.05] text-muted-foreground")}>{s.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{s.label}</span>
                  <span className="hidden text-xs leading-snug text-muted-foreground lg:block">{s.caption}</span>
                </span>
                {active && running && (
                  <motion.span key={key} aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: s.duration / 1000, ease: "linear" }} />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Browser frame */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface-1/80 shadow-e2 backdrop-blur-xl"
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
        onPointerLeave={() => setHover(false)}
      >
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true"><span className="size-2.5 rounded-full bg-chart-down/70" /><span className="size-2.5 rounded-full bg-amber-400/80" /><span className="size-2.5 rounded-full bg-chart-up/70" /></span>
          <span className="mx-auto rounded-md bg-foreground/[0.05] px-3 py-0.5 font-mono text-[11px] text-muted-foreground">{scene.url}</span>
          <button
            type="button"
            onClick={() => setManualPause((p) => !p)}
            aria-pressed={manualPause}
            aria-label={manualPause ? "Play the demo" : "Pause the demo"}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {manualPause || (!running && !reduceMotion && inView) ? <FiPlay className="size-3.5" /> : <FiPause className="size-3.5" />}
          </button>
        </div>
        <div className="relative aspect-[16/10] bg-background/60">
          <AnimatePresence mode="wait">
            <motion.div key={scene.id} className="absolute inset-0" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.985 }} transition={{ duration: 0.35, ease: EASE }}>
              {scene.id === "pulse" && <PulseScene {...sceneProps} />}
              {scene.id === "market" && <MarketScene {...sceneProps} />}
              {scene.id === "terminal" && <TerminalScene {...sceneProps} />}
              {scene.id === "ai" && <AiScene {...sceneProps} />}
            </motion.div>
          </AnimatePresence>
          {!reduceMotion && <FakeCursor cursor={cursor} visible={running || hover} />}
          {hover && !manualPause && !reduceMotion && (
            <span className="absolute bottom-3 right-3 rounded-full border border-border/60 bg-surface-1/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Paused while you look</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default LandingDemoLoop;
