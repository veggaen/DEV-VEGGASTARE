"use client";

/**
 * @fileOverview  "Watch it work" — a self-playing tour of Veggat. A scripted
 *                cursor works through four scenes inside a browser frame, each
 *                a faithful miniature of the real screen and its real steps:
 *                the Pulse composer (write → poll menu → Quick Poll → Pulse),
 *                the Create-listing step rail (Type & photos → Details →
 *                Price → Delivery → Review → Create Listing), the paper
 *                terminal (Lines menu → Trend line → two clicks → order ticket
 *                → fill) and an AI room (Ask anything → send → streamed reply).
 *
 *                The cursor never uses guessed coordinates: every step names a
 *                `data-demo` anchor and the frame measures that element when it
 *                moves (and again while the spring settles), so clicks land on
 *                the real button or field at any viewport. Scene lengths are
 *                derived from the scripts. Loops while in view; hover pauses
 *                and resumes in place; hidden tabs pause; with reduced motion
 *                it shows finished scenes you can switch by hand. Every element
 *                is HTML/CSS with tokens.
 * @stability     evolving
 */

import * as React from "react";
import { AnimatePresence, animate, motion, useMotionValue, type AnimationPlaybackControls, type MotionValue } from "framer-motion";
import {
  FiArrowLeft, FiArrowUp, FiArrowUpRight, FiBarChart2, FiCheck, FiCheckCircle, FiChevronDown, FiCpu, FiDownload, FiGlobe, FiHash,
  FiLayers, FiMic, FiMinus, FiMousePointer, FiPackage, FiPause, FiPlay, FiPlus, FiShoppingBag, FiSquare, FiTrendingUp, FiUsers, FiZap,
} from "react-icons/fi";
import { PulseHeart, PulsePositive } from "@/components/uicustom/icons/PulseIcons";
import { useHydratedReducedMotion as useReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

// ── Script engine ─────────────────────────────────────────────────────────────

type Step = { at: number; run: () => void };
type Setter<V> = (v: V) => void;
type CursorApi = { move: (id: string) => void; click: (id: string) => void };
type ScriptResult = { steps: Step[]; duration: number };

const MOVE_MS = 480;
const CLICK_MS = 240;

/** Appends timed steps while advancing a clock. Building only schedules closures; nothing runs until the timeline plays. */
class Script {
  private t = 0;
  private readonly steps: Step[] = [];
  constructor(private readonly cursor: CursorApi) {}
  /** Idle for `ms`. */
  wait(ms: number) { this.t += ms; return this; }
  /** Run `fn` at the current time, then idle for `then`. */
  do(fn: () => void, then = 0) { this.steps.push({ at: this.t, run: fn }); this.t += then; return this; }
  /** Glide to an anchor and let the spring settle. */
  move(id: string, settle = MOVE_MS) { return this.do(() => this.cursor.move(id), settle); }
  /** Click an anchor (ripple + press) and apply its effect. */
  click(id: string, effect?: () => void) { return this.do(() => { this.cursor.click(id); effect?.(); }, CLICK_MS); }
  /** Type `text` into `set` one character at a time. */
  type(set: Setter<string>, text: string, perChar = 36) {
    const chars = Array.from(text);
    chars.forEach((_, i) => this.steps.push({ at: this.t + i * perChar, run: () => set(chars.slice(0, i + 1).join("")) }));
    this.t += chars.length * perChar + 140;
    return this;
  }
  /** Finish: hold the end state for `hold` before the next scene. */
  end(hold = 1600): ScriptResult { return { steps: this.steps, duration: this.t + hold }; }
}

const NOOP_CURSOR: CursorApi = { move: () => undefined, click: () => undefined };
/** A script's length without running it: builders only schedule closures, so no-op setters are safe. */
function measure<S extends object>(build: (cursor: CursorApi, set: S) => ScriptResult): number {
  const noop = new Proxy({}, { get: () => () => undefined }) as unknown as S;
  return build(NOOP_CURSOR, noop).duration;
}

/**
 * Plays `steps` while `running`; pausing keeps its place and resuming schedules
 * only what is left. `key` restarts from zero.
 */
function useTimeline(steps: Step[], running: boolean, key: string) {
  const elapsed = React.useRef(0);
  React.useEffect(() => { elapsed.current = 0; }, [key]);
  React.useEffect(() => {
    if (!running) return;
    const offset = elapsed.current;
    const startedAt = performance.now() - offset;
    const timers = steps.filter((s) => s.at >= offset).map((s) => setTimeout(s.run, s.at - offset));
    return () => {
      timers.forEach(clearTimeout);
      elapsed.current = performance.now() - startedAt;
    };
  }, [running, key, steps]);
}

// ── Stage + cursor ────────────────────────────────────────────────────────────

type Stage = { ref: React.RefObject<HTMLDivElement | null>; x: MotionValue<number>; y: MotionValue<number> };
const StageContext = React.createContext<Stage | null>(null);

const SPRING = { type: "spring", stiffness: 170, damping: 24, mass: 0.7 } as const;

/** Cursor position in stage pixels, always aimed at a `data-demo` anchor measured from the DOM. */
function useStageCursor(stageRef: React.RefObject<HTMLDivElement | null>) {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const [target, setTarget] = React.useState<string | null>(null);
  const [click, setClick] = React.useState(0);
  const targetRef = React.useRef<string | null>(null);

  const glide = React.useCallback((id: string, instant = false) => {
    const stage = stageRef.current;
    const el = stage?.querySelector<HTMLElement>(`[data-demo="${id}"]`);
    if (!stage || !el) return;
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const tx = r.left - s.left + r.width / 2;
    const ty = r.top - s.top + r.height / 2;
    if (instant) { x.set(tx); y.set(ty); return; }
    animate(x, tx, SPRING);
    animate(y, ty, SPRING);
  }, [stageRef, x, y]);

  const api = React.useMemo<CursorApi>(() => ({
    move: (id) => {
      targetRef.current = id;
      setTarget(id);
      glide(id);
      // Targets can still be entering (menus scale in, panels expand): re-aim while the spring settles.
      [160, 340].forEach((ms) => setTimeout(() => { if (targetRef.current === id) glide(id); }, ms));
    },
    click: (id) => {
      // Snap the last pixel or two of spring settle so the ripple and press are exactly on the target.
      glide(id, true);
      setClick((c) => c + 1);
      const el = stageRef.current?.querySelector<HTMLElement>(`[data-demo="${id}"]`);
      if (!el) return;
      el.dataset.pressed = "true";
      setTimeout(() => { delete el.dataset.pressed; }, 170);
    },
  }), [glide, stageRef]);

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => { if (targetRef.current) glide(targetRef.current, true); });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [glide, stageRef]);

  return { x, y, click, target, api };
}

function FakeCursor({ x, y, click, target, visible }: { x: MotionValue<number>; y: MotionValue<number>; click: number; target: string | null; visible: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      data-demo-cursor=""
      data-target={target ?? undefined}
      data-clicks={click}
      className="pointer-events-none absolute left-0 top-0 z-30"
      style={{ x, y }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence>
        {click > 0 && (
          <motion.span key={click} className="absolute -left-3 -top-3 size-6 rounded-full border-2 border-brand-accent" initial={{ scale: 0.35, opacity: 0.9 }} animate={{ scale: 1.5, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} />
        )}
      </AnimatePresence>
      {/* The arrow tip sits at (2, 1.5) in its own box; shift so the tip is the hotspot. */}
      <svg width="18" height="20" viewBox="0 0 18 20" className="-translate-x-[2px] -translate-y-[1.5px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
        <path d="M2 1.5 15.5 11.8 9.2 12.6 12.6 18.6 10.2 19.8 6.8 13.8 2.2 18.4z" fill="hsl(var(--foreground))" stroke="hsl(var(--background))" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}

// ── Shared stage atoms ────────────────────────────────────────────────────────

type SceneProps = { running: boolean; instant: boolean; cursor: CursorApi; cycle: string };

const T = "text-[11px] leading-snug";
const label = "text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const fieldBase = "rounded-lg border border-border/70 bg-background/70 px-2 py-1.5 text-left text-[11px] text-foreground transition-[border-color,box-shadow] duration-200 dark:bg-foreground/[0.05]";
const fieldFocus = "border-brand-accent/60 shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)]";
const primaryBtn = "inline-flex items-center justify-center gap-1 rounded-full bg-brand-accent px-3 py-1.5 text-[11px] font-semibold text-brand-accent-foreground shadow-e1";
const darkBtn = "inline-flex items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[11px] font-medium text-background";
const iconBtn = "grid size-6 place-items-center rounded-full text-muted-foreground";
const pressable = "transition-transform duration-150 ease-out data-[pressed=true]:scale-[0.95]";
const surface = "rounded-xl border border-border/60 bg-surface-1/80 shadow-e1";
const avatar = "shrink-0 rounded-full bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.6),hsl(var(--muted)))] ring-1 ring-border/60";

function Caret() {
  return <span aria-hidden="true" className="ml-px inline-block h-[1em] w-px animate-pulse bg-brand-accent align-middle" />;
}

function Spinner() {
  return <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />;
}

function Field({ id, value, placeholder, focused, prefix, className }: { id: string; value: string; placeholder: string; focused: boolean; prefix?: React.ReactNode; className?: string }) {
  return (
    <span data-demo={id} className={cn(fieldBase, "flex min-h-[2em] items-center gap-1", focused && fieldFocus, className)}>
      {prefix}
      {value ? <span>{value}</span> : <span className="text-muted-foreground">{placeholder}</span>}
      {focused && <Caret />}
    </span>
  );
}

type MenuItem = { id?: string; icon: React.ReactNode; label: string; hint: string };

function Menu({ title, items, className }: { title: string; items: MenuItem[]; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.16, ease: EASE }}
      className={cn("absolute left-0 top-full z-20 mt-1 w-44 origin-top-left rounded-xl border border-border/70 bg-popover/95 p-1 text-left shadow-e3 backdrop-blur-xl", className)}
    >
      <p className={cn(label, "px-2 pb-1 pt-1.5 tracking-[0.12em]")}>{title}</p>
      {items.map((it) => (
        <span key={it.label} data-demo={it.id} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", pressable)}>
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-foreground/[0.06] text-muted-foreground [&>svg]:size-3">{it.icon}</span>
          <span className="min-w-0"><span className="block text-[11px] font-medium text-foreground">{it.label}</span><span className="block truncate text-[9px] text-muted-foreground">{it.hint}</span></span>
        </span>
      ))}
    </motion.div>
  );
}

// ── Scene 1: Pulse ────────────────────────────────────────────────────────────

const PULSE_TEXT = "New batch of prints is live. Black or oak frame?";

type PulseSet = {
  text: Setter<string>; menu: Setter<boolean>; poll: Setter<boolean>; question: Setter<string>; opt1: Setter<string>; opt2: Setter<string>;
  focus: Setter<string | null>; posting: Setter<boolean>; posted: Setter<boolean>; hearts: Setter<number>;
};

function buildPulse(cursor: CursorApi, s: PulseSet): ScriptResult {
  const sc = new Script(cursor)
    .move("composer").click("composer", () => s.focus("composer")).type(s.text, PULSE_TEXT)
    .move("poll-btn").click("poll-btn", () => { s.focus(null); s.menu(true); })
    .wait(120).move("quick-poll").click("quick-poll", () => s.menu(false))
    .do(() => s.poll(true), 320).move("question").click("question", () => s.focus("question")).type(s.question, "Which frame?", 44)
    .move("opt1").click("opt1", () => s.focus("opt1")).type(s.opt1, "Black", 60)
    .move("opt2").click("opt2", () => s.focus("opt2")).type(s.opt2, "Oak", 60)
    .move("pulse-btn").click("pulse-btn", () => { s.focus(null); s.posting(true); })
    .wait(620).do(() => { s.posting(false); s.posted(true); s.text(""); s.poll(false); s.question(""); s.opt1(""); s.opt2(""); }, 260);
  for (let i = 1; i <= 16; i++) sc.do(() => s.hearts(Math.round((i / 16) * 128)), 60);
  return sc.end();
}

function PulseScene({ running, instant, cursor, cycle }: SceneProps) {
  const [text, setText] = React.useState("");
  const [menu, setMenu] = React.useState(false);
  const [poll, setPoll] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [opt1, setOpt1] = React.useState("");
  const [opt2, setOpt2] = React.useState("");
  const [focus, setFocus] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);
  const [posted, setPosted] = React.useState(instant);
  const [hearts, setHearts] = React.useState(instant ? 128 : 0);
  React.useEffect(() => {
    if (instant) return;
    setText(""); setMenu(false); setPoll(false); setQuestion(""); setOpt1(""); setOpt2(""); setFocus(null); setPosting(false); setPosted(false); setHearts(0);
  }, [cycle, instant]);
  const set = React.useMemo<PulseSet>(() => ({ text: setText, menu: setMenu, poll: setPoll, question: setQuestion, opt1: setOpt1, opt2: setOpt2, focus: setFocus, posting: setPosting, posted: setPosted, hearts: setHearts }), []);
  const script = React.useMemo(() => buildPulse(cursor, set), [cursor, set]);
  useTimeline(script.steps, running, cycle);

  return (
    <div className={cn("absolute inset-0 overflow-hidden p-[4%]", T)}>
      <div className={cn("rounded-2xl border bg-card/70 p-3 shadow-e1 transition-[border-color,box-shadow] duration-200", focus ? "border-brand-accent/50 shadow-[0_0_0_4px_hsl(var(--brand-accent)/0.10)]" : "border-border/60")}>
        <div className={cn(label, "flex items-center justify-between tracking-[0.18em]")}>
          <span>New pulse</span>
          {text.length > 0 && <span className="normal-case tracking-normal tabular-nums">{text.length} characters</span>}
        </div>
        <div className="mt-2 flex gap-2">
          <span className={cn(avatar, "size-6")} />
          <p data-demo="composer" className="min-h-[2.4em] flex-1 pt-0.5 text-foreground">
            {text || <span className="text-muted-foreground/80">What’s happening on your side of Veggat?</span>}
            {focus === "composer" && <Caret />}
          </p>
        </div>
        <AnimatePresence initial={false}>
          {poll && (
            <motion.div key="poll" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
              <div className="ml-8 mt-2 space-y-1.5 rounded-lg border border-border/60 bg-foreground/[0.04] p-2">
                <Field id="question" value={question} placeholder="Ask a question..." focused={focus === "question"} className="font-medium" />
                <Field id="opt1" value={opt1} placeholder="Option 1" focused={focus === "opt1"} />
                <Field id="opt2" value={opt2} placeholder="Option 2" focused={focus === "opt2"} />
                <span className="inline-flex items-center gap-1 px-1 text-[10px] text-muted-foreground"><FiPlus className="size-3" />Add option</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
          <div className="flex items-center gap-1">
            <span className="relative">
              <span data-demo="poll-btn" className={cn(iconBtn, "w-auto gap-0.5 px-1.5", pressable, (poll || menu) && "bg-brand-accent/10 text-brand-accent-hover dark:text-brand-accent-light")}>
                <FiBarChart2 className="size-3" /><FiChevronDown className="size-2.5" />
              </span>
              <AnimatePresence>
                {menu && (
                  <Menu
                    title="Add a poll"
                    items={[
                      { id: "quick-poll", icon: <FiBarChart2 />, label: "Quick Poll", hint: "Yes/no or multiple choice" },
                      { icon: <FiZap />, label: "Advanced Builder", hint: "Surveys, quizzes, assessments" },
                    ]}
                  />
                )}
              </AnimatePresence>
            </span>
            <span className={iconBtn}><FiHash className="size-3" /></span>
            <span className={cn(iconBtn, "w-auto gap-0.5 px-1.5")}><FiGlobe className="size-3" /><FiChevronDown className="size-2.5" /></span>
            <span className={iconBtn}><FiMic className="size-3" /></span>
          </div>
          <span data-demo="pulse-btn" className={cn(primaryBtn, pressable, posting && "opacity-70")}>
            {posting ? <Spinner /> : <PulsePositive className="size-3" />}Pulse
          </span>
        </div>
      </div>
      <AnimatePresence>
        {posted && (
          <motion.div key="post" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className="mt-3 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-e1">
            <div className="flex items-center gap-2">
              <span className={cn(avatar, "size-5")} />
              <span className="font-semibold text-foreground">You</span>
              <span className="text-muted-foreground">· just now</span>
              <span className="ml-auto rounded-full border border-brand-accent/40 bg-brand-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">Reach ×1.2</span>
            </div>
            <p className="mt-1.5 text-foreground">{PULSE_TEXT}</p>
            <p className="mt-2 font-medium text-foreground">Which frame?</p>
            <div className="mt-1 space-y-1">
              {([["Black", 62], ["Oak", 38]] as const).map(([o, pct]) => (
                <div key={o} className="relative overflow-hidden rounded-md border border-border/50 px-2 py-1">
                  <motion.span className="absolute inset-y-0 left-0 bg-brand-accent/15" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3, duration: 0.8, ease: EASE }} />
                  <span className="relative flex justify-between"><span>{o}</span><span className="tabular-nums text-muted-foreground">{pct}%</span></span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3 text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-brand-accent"><PulseHeart className="size-3" /><span className="tabular-nums">{hearts}</span></span>
              <span className="inline-flex items-center gap-1"><FiUsers className="size-3" />1.9k reach</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Scene 2: Create listing ───────────────────────────────────────────────────

const LISTING_STEPS = ["Type & photos", "Details", "Price & payment", "Delivery & payout", "Review & publish"] as const;

type ListingSet = {
  step: Setter<number>; kind: Setter<boolean>; photo: Setter<boolean>; title: Setter<string>; price: Setter<string>; ships: Setter<string>;
  focus: Setter<string | null>; publishing: Setter<boolean>; live: Setter<boolean>;
};

function buildListing(cursor: CursorApi, s: ListingSet): ScriptResult {
  return new Script(cursor)
    .move("type-physical").click("type-physical", () => s.kind(true))
    .wait(120).move("dropzone").click("dropzone", () => s.photo(true))
    .wait(420).move("continue").click("continue", () => s.step(1))
    .wait(300).move("title").click("title", () => s.focus("title")).type(s.title, "Oak desk organiser", 40)
    .move("continue").click("continue", () => { s.focus(null); s.step(2); })
    .wait(300).move("price").click("price", () => s.focus("price")).type(s.price, "890", 110)
    .move("continue").click("continue", () => { s.focus(null); s.step(3); })
    .wait(300).move("ships").click("ships", () => s.focus("ships")).type(s.ships, "0150 Oslo", 48)
    .move("continue").click("continue", () => { s.focus(null); s.step(4); })
    .wait(500).move("publish").click("publish", () => s.publishing(true))
    .wait(760).do(() => { s.publishing(false); s.live(true); })
    .end(1800);
}

function ListingScene({ running, instant, cursor, cycle }: SceneProps) {
  const [step, setStep] = React.useState(instant ? 4 : 0);
  const [kind, setKind] = React.useState(instant);
  const [photo, setPhoto] = React.useState(instant);
  const [title, setTitle] = React.useState(instant ? "Oak desk organiser" : "");
  const [price, setPrice] = React.useState(instant ? "890" : "");
  const [ships, setShips] = React.useState(instant ? "0150 Oslo" : "");
  const [focus, setFocus] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [live, setLive] = React.useState(instant);
  React.useEffect(() => {
    if (instant) return;
    setStep(0); setKind(false); setPhoto(false); setTitle(""); setPrice(""); setShips(""); setFocus(null); setPublishing(false); setLive(false);
  }, [cycle, instant]);
  const set = React.useMemo<ListingSet>(() => ({ step: setStep, kind: setKind, photo: setPhoto, title: setTitle, price: setPrice, ships: setShips, focus: setFocus, publishing: setPublishing, live: setLive }), []);
  const script = React.useMemo(() => buildListing(cursor, set), [cursor, set]);
  useTimeline(script.steps, running, cycle);

  const done = [photo, title.length > 0, price.length > 0, ships.length > 0, live];
  const chip = "rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground";
  const typeCard = "flex flex-col gap-0.5 rounded-lg border p-2 transition-[border-color,background-color] duration-200";

  return (
    <div className={cn("absolute inset-0 flex flex-col overflow-hidden p-[4%]", T)}>
      <header className="flex items-end justify-between gap-2 border-b border-border/60 pb-2">
        <div>
          <p className={cn(label, "flex items-center gap-1 text-brand-accent-hover dark:text-brand-accent-light")}><FiShoppingBag className="size-2.5" />Create listing</p>
          <p className="text-[13px] font-semibold tracking-tight text-foreground">New listing</p>
        </div>
        <span className={chip}>Browse-only checkout</span>
      </header>

      <div className="mt-2 grid min-h-0 flex-1 gap-3 @md:grid-cols-[32%_1fr]">
        <ol className="hidden flex-col gap-1 @md:flex" aria-hidden="true">
          {LISTING_STEPS.map((name, i) => (
            <li key={name} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground", i === step && "bg-brand-accent/[0.08] text-foreground")}>
              <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border text-[8px] font-semibold", done[i] ? "border-brand-accent bg-brand-accent text-brand-accent-foreground" : i === step ? "border-brand-accent text-brand-accent" : "border-border")}>
                {done[i] ? <FiCheck className="size-2.5" /> : i + 1}
              </span>
              <span className="truncate">{name}</span>
            </li>
          ))}
        </ol>

        <div className="flex min-h-0 flex-col">
          <div className="relative min-h-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22, ease: EASE }} className="absolute inset-0 space-y-2 overflow-hidden">
                {step === 0 && (
                  <>
                    <p className={label}>Product type</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <span data-demo="type-physical" className={cn(typeCard, pressable, kind ? "border-brand-accent/60 bg-brand-accent/[0.08]" : "border-border/70")}>
                        <FiPackage className={cn("size-3", kind ? "text-brand-accent" : "text-muted-foreground")} /><span className="font-medium text-foreground">Physical</span><span className="text-[9px] text-muted-foreground">Requires shipping</span>
                      </span>
                      <span className={cn(typeCard, "border-border/70")}><FiDownload className="size-3 text-muted-foreground" /><span className="font-medium text-foreground">Digital</span><span className="text-[9px] text-muted-foreground">Downloadable file</span></span>
                      <span className={cn(typeCard, "border-border/70")}><FiLayers className="size-3 text-muted-foreground" /><span className="font-medium text-foreground">Hybrid</span><span className="text-[9px] text-muted-foreground">Both</span></span>
                    </div>
                    <p className={label}>Photos</p>
                    <span data-demo="dropzone" className={cn("flex min-h-[4.6em] items-center justify-center rounded-lg border border-dashed p-2 text-center transition-colors duration-300", pressable, photo ? "border-border/60 bg-background/40" : "border-border/70 bg-background/40")}>
                      {photo ? (
                        <span className="flex w-full items-center gap-2">
                          <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative size-10 overflow-hidden rounded-md bg-[linear-gradient(160deg,hsl(var(--brand-accent)/0.45),hsl(var(--muted))_60%,hsl(var(--brand-accent)/0.2))]">
                            <span className="absolute bottom-0.5 left-0.5 rounded bg-background/80 px-1 text-[8px] font-semibold text-foreground">Cover</span>
                          </motion.span>
                          <span className="text-muted-foreground">1 of 8 · <span className="text-foreground">Add more</span></span>
                        </span>
                      ) : (
                        <span><span className="block text-foreground">Drop images here or click to browse</span><span className="block text-[9px] text-muted-foreground">Up to 8 images • PNG, JPG, WEBP</span></span>
                      )}
                    </span>
                  </>
                )}
                {step === 1 && (
                  <>
                    <label className="block space-y-1"><span className={label}>Title</span><Field id="title" value={title} placeholder="e.g. Handcrafted leather wallet" focused={focus === "title"} /></label>
                    <label className="block space-y-1"><span className={label}>Category</span><span className={cn(fieldBase, "flex items-center justify-between")}>Home &amp; office<FiChevronDown className="size-3 text-muted-foreground" /></span></label>
                    <label className="block space-y-1"><span className={label}>Description</span><span className={cn(fieldBase, "block min-h-[3.2em] text-muted-foreground")}>What makes it special?</span></label>
                  </>
                )}
                {step === 2 && (
                  <>
                    <label className="block space-y-1"><span className={label}>Price</span><Field id="price" value={price} placeholder="0" focused={focus === "price"} prefix={<span className="text-muted-foreground">kr</span>} className="tabular-nums" /></label>
                    <div className="space-y-1"><span className={label}>Currency</span><div className="flex gap-1">{(["NOK", "USD", "EUR"] as const).map((c) => <span key={c} className={cn(chip, c === "NOK" && "border-brand-accent/50 bg-brand-accent/10 text-foreground")}>{c}</span>)}</div></div>
                    <div className="space-y-1"><span className={label}>Accepted methods</span><div className="flex gap-1"><span className={cn(chip, "inline-flex items-center gap-1 border-brand-accent/50 text-foreground")}><FiCheck className="size-2.5 text-brand-accent" />PayPal</span><span className={cn(chip, "inline-flex items-center gap-1 border-brand-accent/50 text-foreground")}><FiCheck className="size-2.5 text-brand-accent" />Wallet</span></div></div>
                  </>
                )}
                {step === 3 && (
                  <>
                    <label className="block space-y-1"><span className={label}>Ships from</span><Field id="ships" value={ships} placeholder="Postal code" focused={focus === "ships"} /></label>
                    <div className="space-y-1"><span className={label}>Shipping</span><div className="flex gap-1"><span className={cn(chip, "border-brand-accent/50 text-foreground")}>Posten · kr 89</span><span className={chip}>Pickup</span></div></div>
                    <div className="space-y-1"><span className={label}>Payout</span><span className={cn(fieldBase, "flex items-center justify-between")}>PayPal · saved<FiCheck className="size-3 text-brand-accent" /></span></div>
                  </>
                )}
                {step === 4 && (
                  live ? (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="flex h-full flex-col items-center justify-center gap-1.5 rounded-lg border border-brand-accent/40 bg-brand-accent/[0.08] p-3 text-center">
                      <FiCheckCircle className="size-5 text-brand-accent" />
                      <span className="text-[12px] font-semibold text-foreground">Live on the marketplace</span>
                      <span className="text-muted-foreground">Oak desk organiser · kr 890 · ships from Oslo</span>
                      <span className="mt-1 inline-flex items-center gap-1 font-medium text-brand-accent-hover dark:text-brand-accent-light">View listing <span aria-hidden="true">→</span></span>
                    </motion.div>
                  ) : (
                    <>
                      <p className={label}>Review &amp; publish</p>
                      <div className="divide-y divide-border/50 rounded-lg border border-border/60">
                        {([["Title", "Oak desk organiser"], ["Price", "kr 890"], ["Type", "Physical"], ["Ships from", "0150 Oslo"], ["Photos", "1"]] as const).map(([k, v]) => (
                          <div key={k} className="flex justify-between px-2 py-1"><span className="text-muted-foreground">{k}</span><span className="text-foreground">{v}</span></div>
                        ))}
                      </div>
                    </>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="mt-2 flex shrink-0 items-center justify-between border-t border-border/60 pt-2">
            <span className={cn("text-muted-foreground", step === 0 && "opacity-0")}><span aria-hidden="true">←</span> Back</span>
            <span className="text-[10px] text-muted-foreground">Step {step + 1} of {LISTING_STEPS.length}</span>
            {step < 4 ? (
              <span data-demo="continue" className={cn(darkBtn, pressable)}>Continue <span aria-hidden="true">→</span></span>
            ) : (
              <span data-demo="publish" className={cn(primaryBtn, "rounded-md", pressable, (publishing || live) && "opacity-70")}>
                {publishing ? <><Spinner />Creating…</> : live ? "Listed" : "Create Listing"}
              </span>
            )}
          </footer>
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
const VB = { w: 320, h: 140 };
/** Trend-line anchors as fractions of the chart box; both the click targets and the SVG line derive from these. */
const PT_A = { x: 0.13, y: 0.72 };
const PT_B = { x: 0.8, y: 0.24 };
const PAPER_CASH = 10000;

type Tool = "cursor" | "trend";
type Order = "idle" | "placing" | "filled";
type TerminalSet = {
  menu: Setter<boolean>; tool: Setter<Tool>; a: Setter<boolean>; b: Setter<boolean>; amount: Setter<string>; focus: Setter<string | null>;
  order: Setter<Order>;
};

function buildTerminal(cursor: CursorApi, s: TerminalSet): ScriptResult {
  return new Script(cursor)
    .move("lines").click("lines", () => s.menu(true))
    .wait(120).move("tool-trend").click("tool-trend", () => { s.menu(false); s.tool("trend"); })
    .wait(150).move("pt-a").click("pt-a", () => s.a(true))
    .wait(80).move("pt-b", 760).click("pt-b", () => { s.b(true); s.tool("cursor"); })
    .wait(320).move("amount").click("amount", () => s.focus("amount")).type(s.amount, "500", 110)
    .move("buy").click("buy", () => { s.focus(null); s.order("placing"); })
    .wait(900).do(() => s.order("filled"))
    .end(1800);
}

const fmtUsd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TerminalScene({ running, instant, cursor, cycle }: SceneProps) {
  const stage = React.useContext(StageContext);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const previewRef = React.useRef<SVGLineElement>(null);
  const [menu, setMenu] = React.useState(false);
  const [tool, setTool] = React.useState<Tool>("cursor");
  const [a, setA] = React.useState(instant);
  const [b, setB] = React.useState(instant);
  const [amount, setAmount] = React.useState(instant ? "500" : "");
  const [focus, setFocus] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<Order>(instant ? "filled" : "idle");
  const [tick, setTick] = React.useState(0);
  const [filledAt, setFilledAt] = React.useState<number | null>(instant ? 3118.2 : null);
  const price = 3112.4 + Math.sin(tick / 2) * 6 + tick * 1.1;
  React.useEffect(() => {
    if (instant) return;
    setMenu(false); setTool("cursor"); setA(false); setB(false); setAmount(""); setFocus(null); setOrder("idle"); setTick(0); setFilledAt(null);
  }, [cycle, instant]);
  // The fill locks the price of the moment; later ticks keep moving the quote, not the fill.
  React.useEffect(() => { if (order === "filled" && filledAt === null) setFilledAt(price); }, [order, filledAt, price]);
  const set = React.useMemo<TerminalSet>(() => ({ menu: setMenu, tool: setTool, a: setA, b: setB, amount: setAmount, focus: setFocus, order: setOrder }), []);
  const script = React.useMemo(() => buildTerminal(cursor, set), [cursor, set]);
  useTimeline(script.steps, running, cycle);
  React.useEffect(() => {
    if (!running) return;
    const timers = Array.from({ length: 14 }, (_, i) => setTimeout(() => setTick(i + 1), 400 + i * 520));
    return () => timers.forEach(clearTimeout);
  }, [running, cycle]);

  // Rubber-band preview: after the first click the line follows the live cursor until the second click.
  React.useEffect(() => {
    if (!stage || !a || b) return;
    const update = () => {
      const svg = svgRef.current; const st = stage.ref.current; const line = previewRef.current;
      if (!svg || !st || !line) return;
      const r = svg.getBoundingClientRect(); const s = st.getBoundingClientRect();
      line.setAttribute("x2", String(((stage.x.get() - (r.left - s.left)) / r.width) * VB.w));
      line.setAttribute("y2", String(((stage.y.get() - (r.top - s.top)) / r.height) * VB.h));
    };
    update();
    const offX = stage.x.on("change", update);
    const offY = stage.y.on("change", update);
    return () => { offX(); offY(); };
  }, [stage, a, b]);

  const ax = PT_A.x * VB.w; const ay = PT_A.y * VB.h; const bx = PT_B.x * VB.w; const by = PT_B.y * VB.h;
  const toolBtn = "grid size-5 place-items-center rounded-md text-muted-foreground";
  const toolActive = "bg-brand-accent/15 text-brand-accent-hover dark:text-brand-accent-light";
  const fillPrice = filledAt ?? price;
  const units = amount ? Number(amount) / fillPrice : 0;

  return (
    <div className={cn("absolute inset-0 grid grid-cols-[1fr_38%] gap-[3%] p-[3.5%] @md:grid-cols-[1fr_30%]", T)}>
      <div className={cn(surface, "flex min-w-0 flex-col overflow-hidden")}>
        {/* Narrow stages put the drawing toolbar on its own row so the symbol never truncates. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/50 px-2.5 py-1.5">
          <span className="min-w-0 truncate font-semibold text-foreground">ETH / USD <span className="font-normal text-muted-foreground">1H</span></span>
          <span className="ml-auto tabular-nums text-chart-up @md:order-last @md:ml-0">${fmtUsd(price)}</span>
          <span className="order-last flex basis-full items-center gap-0.5 self-start rounded-lg bg-foreground/[0.04] p-0.5 @md:order-none @md:mx-auto @md:basis-auto" aria-hidden="true">
            <span className={cn(toolBtn, tool === "cursor" && toolActive)}><FiMousePointer className="size-3" /></span>
            <span className="relative">
              <span data-demo="lines" className={cn(toolBtn, "w-7 gap-0 pl-0.5", pressable, (tool === "trend" || menu) && toolActive)}><FiTrendingUp className="size-3" /><FiChevronDown className="size-2" /></span>
              <AnimatePresence>
                {menu && (
                  <Menu
                    title="Lines"
                    className="left-auto right-0 origin-top-right"
                    items={[
                      { id: "tool-trend", icon: <FiTrendingUp />, label: "Trend line", hint: "Two clicks, or press and drag" },
                      { icon: <FiArrowUpRight />, label: "Ray", hint: "Trend line that extends right" },
                      { icon: <FiMinus />, label: "Horizontal line", hint: "One click at a price" },
                    ]}
                  />
                )}
              </AnimatePresence>
            </span>
            <span className={toolBtn}><FiSquare className="size-3" /></span>
          </span>
        </div>
        <div className="relative min-h-0 flex-1">
          <svg ref={svgRef} viewBox={`0 0 ${VB.w} ${VB.h}`} className="block h-full w-full" preserveAspectRatio="none">
            {[30, 60, 90, 120].map((y) => <line key={y} x1="0" x2={VB.w} y1={y} y2={y} stroke="currentColor" className="text-border/50" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            {CANDLES.map(([x, o, c, h, l], i) => {
              const up = c < o; const last = i === CANDLES.length - 1;
              return (
                <g key={x} className={up ? "text-chart-up" : "text-chart-down"}>
                  <line x1={x} x2={x} y1={h} y2={l} stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  <motion.rect x={x - 5} y={Math.min(o, c)} width="10" height={Math.max(2, Math.abs(o - c))} fill="currentColor" rx="1" animate={last && running ? { scaleY: [1, 1.35, 0.9, 1.2, 1] } : { scaleY: 1 }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }} style={{ transformOrigin: `${x}px ${Math.max(o, c)}px` }} />
                </g>
              );
            })}
            {a && !b && <line ref={previewRef} x1={ax} y1={ay} x2={ax} y2={ay} stroke="hsl(var(--brand-accent))" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
            {b && <motion.line x1={ax} y1={ay} x2={bx} y2={by} stroke="hsl(var(--brand-accent))" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} />}
            {running && <motion.line x1="0" x2="0" y1="0" y2={VB.h} stroke="hsl(var(--foreground) / 0.25)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" animate={{ x: [0, VB.w] }} transition={{ repeat: Infinity, duration: 7, ease: "linear" }} />}
          </svg>
          {/* The two trend-line clicks: real targets for the cursor, visible as handles once placed. */}
          <span data-demo="pt-a" className={cn("absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-200", a ? "bg-brand-accent ring-2 ring-background" : "opacity-0")} style={{ left: `${PT_A.x * 100}%`, top: `${PT_A.y * 100}%` }} />
          <span data-demo="pt-b" className={cn("absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-200", b ? "bg-brand-accent ring-2 ring-background" : "opacity-0")} style={{ left: `${PT_B.x * 100}%`, top: `${PT_B.y * 100}%` }} />
          <AnimatePresence>
            {tool === "trend" && (
              <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-2 top-2 rounded-full border border-brand-accent/40 bg-brand-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-brand-accent-hover dark:text-brand-accent-light">
                Trend line · {a ? "click the second point" : "click the first point"}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between border-t border-border/50 px-2.5 py-1 text-[10px] text-muted-foreground">
          <span>Paper account</span><span className="tabular-nums">${fmtUsd(order === "filled" ? PAPER_CASH - 500 : PAPER_CASH)}</span>
        </div>
      </div>

      <div className={cn(surface, "flex min-w-0 flex-col gap-2 p-2")} aria-label="Order ticket">
        <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-border/60 bg-foreground/[0.03] p-0.5 text-center text-[10px] font-semibold">
          <span className="rounded-md bg-chart-up/15 py-1 text-chart-up">Buy</span><span className="py-1 text-muted-foreground">Sell</span>
        </div>
        <div className="grid grid-cols-3 rounded-md bg-foreground/[0.04] p-0.5 text-center text-[9px] capitalize">
          <span className="rounded bg-card py-0.5 text-foreground shadow-e1">market</span><span className="py-0.5 text-muted-foreground">limit</span><span className="py-0.5 text-muted-foreground">stop</span>
        </div>
        <label className="block space-y-1">
          <span className={cn(label, "flex items-center justify-between")}>
            Amount
            <span className="inline-flex gap-0.5 rounded bg-foreground/[0.05] p-0.5 normal-case tracking-normal"><span className="rounded bg-card px-1 text-[8px] font-semibold text-foreground shadow-e1">USD</span><span className="px-1 text-[8px]">ETH</span></span>
          </span>
          <Field id="amount" value={amount} placeholder="0.00" focused={focus === "amount"} className="tabular-nums" />
          <span className="block text-[9px] text-muted-foreground">Available ${fmtUsd(PAPER_CASH)}</span>
        </label>
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          <div className="flex justify-between gap-1"><span>Est. price</span><span className="tabular-nums text-foreground">${fmtUsd(price)}</span></div>
          <div className="flex justify-between gap-1"><span>You get</span><span className="tabular-nums text-foreground">{units.toFixed(4)} ETH</span></div>
        </div>
        <span data-demo="buy" className={cn(primaryBtn, "mt-auto rounded-md", pressable, order !== "idle" && "opacity-70")}>
          {order === "placing" ? <><Spinner />Placing…</> : "Buy ETH"}
        </span>
        <AnimatePresence>
          {order === "filled" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-chart-up/40 bg-chart-up/10 px-2 py-1.5 text-[10px] text-foreground">
              <span className="font-semibold text-chart-up">Filled</span> · {units.toFixed(4)} ETH @ ${fmtUsd(fillPrice)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Scene 4: AI room ──────────────────────────────────────────────────────────

const AI_PROMPT = "Draft the launch post, mention the poll result";
const AI_REPLY = "Black won the frame poll (62% black, 38% oak), so lead with black as the default and offer oak as the upgrade. Draft: “New prints, two frames, ships this week.”";
const AI_WORDS = AI_REPLY.split(" ");

type AiSet = { draft: Setter<string>; focus: Setter<boolean>; sent: Setter<boolean>; typing: Setter<boolean>; reply: Setter<string>; credits: Setter<number> };

function buildAi(cursor: CursorApi, s: AiSet): ScriptResult {
  const sc = new Script(cursor)
    .move("ai-input").click("ai-input", () => s.focus(true)).type(s.draft, AI_PROMPT, 34)
    .move("send").click("send", () => { s.focus(false); s.sent(true); s.draft(""); })
    .wait(360).do(() => s.typing(true), 820)
    .do(() => s.typing(false));
  AI_WORDS.forEach((_, i) => sc.do(() => s.reply(AI_WORDS.slice(0, i + 1).join(" ")), 85));
  sc.wait(200).do(() => s.credits(828));
  return sc.end(1800);
}

function AiScene({ running, instant, cursor, cycle }: SceneProps) {
  const [draft, setDraft] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const [sent, setSent] = React.useState(instant);
  const [typing, setTyping] = React.useState(false);
  const [reply, setReply] = React.useState(instant ? AI_REPLY : "");
  const [credits, setCredits] = React.useState(instant ? 828 : 840);
  React.useEffect(() => {
    if (instant) return;
    setDraft(""); setFocus(false); setSent(false); setTyping(false); setReply(""); setCredits(840);
  }, [cycle, instant]);
  const set = React.useMemo<AiSet>(() => ({ draft: setDraft, focus: setFocus, sent: setSent, typing: setTyping, reply: setReply, credits: setCredits }), []);
  const script = React.useMemo(() => buildAi(cursor, set), [cursor, set]);
  useTimeline(script.steps, running, cycle);

  const bubble = "max-w-[84%] rounded-xl px-2.5 py-1.5";
  const human = cn(bubble, "bg-foreground/[0.06] text-foreground");
  const who = "block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className={cn("absolute inset-0 flex flex-col p-[3.5%]", T)}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={iconBtn}><FiArrowLeft className="size-3" /></span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12px] font-semibold text-foreground">Launch plan</p>
            <p className="text-[9px] text-muted-foreground">2 AI · 3 participants</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex -space-x-1" aria-hidden="true">{[0.6, 0.35, 0.8].map((o) => <span key={o} className={cn(avatar, "size-4 ring-background")} style={{ opacity: o }} />)}</span>
          <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground">{credits} credits</span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden">
        <p className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-muted-foreground"><span className="h-px flex-1 bg-border/60" />Today<span className="h-px flex-1 bg-border/60" /></p>
        <div className={human}><span className={who}>Mia</span>Prints are live. Who writes the launch post?</div>
        <div className={human}><span className={who}>Jonas</span>Use the frame poll result if you can.</div>
        <AnimatePresence>
          {sent && <motion.div key="you" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn(bubble, "ml-auto bg-brand-accent text-brand-accent-foreground")}>{AI_PROMPT}</motion.div>}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn(bubble, "flex items-center gap-1 border border-brand-accent/30 bg-brand-accent/[0.08]")}>
              {[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-brand-accent" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />)}
            </motion.div>
          )}
          {reply && (
            <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn(bubble, "border border-brand-accent/30 bg-brand-accent/[0.08] text-foreground")}>
              <span className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="inline-flex items-center gap-1"><FiCpu className="size-2.5 text-brand-accent" />Claude Sonnet</span><span className="normal-case tracking-normal">12 credits</span></span>
              {reply}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={cn("mt-2 rounded-2xl border bg-card/70 p-1.5 transition-[border-color,box-shadow] duration-200", focus ? "border-brand-accent/50 shadow-[0_0_20px_-6px_hsl(var(--brand-accent)/0.22)]" : "border-border/60")}>
        <p data-demo="ai-input" className="min-h-[2.2em] px-1.5 pt-1 text-foreground">
          {draft || <span className="text-muted-foreground">Ask anything…</span>}
          {focus && <Caret />}
        </p>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <span className={iconBtn}><FiPlus className="size-3" /></span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              <FiCpu className="size-2.5 text-brand-accent" />Claude Sonnet
              <span className="rounded-full bg-brand-accent/15 px-1 text-brand-accent-hover dark:text-brand-accent-light">12 / msg</span>
            </span>
          </div>
          <span data-demo="send" className={cn("grid size-6 place-items-center rounded-full bg-foreground text-background transition-opacity duration-200", pressable, !draft && "opacity-40")}><FiArrowUp className="size-3" /></span>
        </div>
      </div>
    </div>
  );
}

// ── The frame ─────────────────────────────────────────────────────────────────

type SceneId = "pulse" | "market" | "terminal" | "ai";
const SCENES: { id: SceneId; label: string; caption: string; url: string; icon: React.ReactNode; duration: number }[] = [
  { id: "pulse", label: "Post a pulse", caption: "Write, add a quick poll, publish. Reach starts counting.", url: "veggat.com/pulse", icon: <PulseHeart />, duration: measure(buildPulse) },
  { id: "market", label: "List a product", caption: "Type, photos, details, price, delivery. Five steps, one screen.", url: "veggat.com/products/create", icon: <FiPackage />, duration: measure(buildListing) },
  { id: "terminal", label: "Trade on the chart", caption: "Pick the trend-line tool, click two points, fill a paper order.", url: "veggat.com/dashboard/trading", icon: <FiTrendingUp />, duration: measure(buildTerminal) },
  { id: "ai", label: "Ask the room", caption: "People and the model in one thread, cost shown before you send.", url: "veggat.com/ai", icon: <FiCpu />, duration: measure(buildAi) },
];

export function LandingDemoLoop() {
  const reduceMotion = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);
  const [inView, setInView] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const [manualPause, setManualPause] = React.useState(false);
  const cursor = useStageCursor(stageRef);

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

  // Advance when the scene has played out; the timeline pauses and resumes with the scene.
  const advance = React.useMemo<Step[]>(() => [{ at: scene.duration, run: () => { setIndex((i) => (i + 1) % SCENES.length); setCycle((c) => c + 1); } }], [scene.duration]);
  useTimeline(advance, running, key);

  // Progress under the active scene: one linear tween per scene, paused and resumed with the timeline.
  const progress = useMotionValue(0);
  const progressControls = React.useRef<AnimationPlaybackControls | null>(null);
  React.useEffect(() => {
    progress.set(0);
    if (reduceMotion) return;
    const controls = animate(progress, 1, { duration: scene.duration / 1000, ease: "linear" });
    controls.pause();
    progressControls.current = controls;
    return () => { controls.stop(); progressControls.current = null; };
  }, [key, scene.duration, progress, reduceMotion]);
  React.useEffect(() => {
    const controls = progressControls.current;
    if (!controls) return;
    if (running) controls.play(); else controls.pause();
  }, [running, key]);

  const go = (i: number) => { setIndex(i); setCycle((c) => c + 1); };
  const sceneProps: SceneProps = { running, instant: reduceMotion, cursor: cursor.api, cycle: key };
  const stage = React.useMemo<Stage>(() => ({ ref: stageRef, x: cursor.x, y: cursor.y }), [cursor.x, cursor.y]);

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
                {active && !reduceMotion && (
                  <motion.span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand-accent" style={{ scaleX: progress }} />
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
        <StageContext.Provider value={stage}>
          <div ref={stageRef} className="@container relative aspect-[3/4] bg-background/60 sm:aspect-[16/10]">
            <AnimatePresence mode="wait">
              <motion.div key={scene.id} className="absolute inset-0" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.985 }} transition={{ duration: 0.35, ease: EASE }}>
                {scene.id === "pulse" && <PulseScene {...sceneProps} />}
                {scene.id === "market" && <ListingScene {...sceneProps} />}
                {scene.id === "terminal" && <TerminalScene {...sceneProps} />}
                {scene.id === "ai" && <AiScene {...sceneProps} />}
              </motion.div>
            </AnimatePresence>
            {!reduceMotion && <FakeCursor x={cursor.x} y={cursor.y} click={cursor.click} target={cursor.target} visible={running || hover} />}
            {hover && !manualPause && !reduceMotion && (
              <span className="absolute bottom-3 right-3 rounded-full border border-border/60 bg-surface-1/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Paused while you look</span>
            )}
          </div>
        </StageContext.Provider>
      </div>
    </div>
  );
}

export default LandingDemoLoop;
