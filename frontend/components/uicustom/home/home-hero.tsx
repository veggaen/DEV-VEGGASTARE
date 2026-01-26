"use client";

import Link from "next/link";
import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MyLoginButton } from "@/components/uicustom/auth/buttons/login-button";
import { FaUnlockAlt } from "react-icons/fa";
import AnimatedTitle from "@/components/uicustom/animated-title";

type IgniteState = {
  untilMs: number;
  intensity: number; // 0..1
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function DroppingWords({
  text,
  className,
  startDelay = 0,
  wordStagger = 0.12,
  stacked = false,
  glowWordIndex,
  glowActive = false,
  glowPulseToken = 0,
  onWordShown,
  onGlowHover,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  wordStagger?: number;
  stacked?: boolean;
  glowWordIndex?: number;
  glowActive?: boolean;
  glowPulseToken?: number;
  onWordShown?: (wordIndex: number) => void;
  onGlowHover?: (hoverMs: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const words = React.useMemo(() => String(text ?? "").split(/\s+/).filter(Boolean), [text]);
  const [ignite, setIgnite] = React.useState<Record<string, IgniteState>>({});
  const hoverStartsRef = React.useRef<Record<string, number>>({});

  const igniteKey = React.useCallback((key: string, hoverMs: number) => {
    const now = Date.now();
    const intensity = clamp(0.25 + hoverMs / 2000, 0.25, 1);
    const durationMs = clamp(1200 + hoverMs * 2, 1500, 10000);
    const untilMs = now + durationMs;
    setIgnite((prev) => {
      const existing = prev[key];
      if (existing && existing.untilMs >= untilMs && existing.intensity >= intensity) return prev;
      return { ...prev, [key]: { untilMs, intensity } };
    });

    window.setTimeout(() => {
      setIgnite((prev) => {
        const cur = prev[key];
        if (!cur) return prev;
        if (cur.untilMs > Date.now()) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, durationMs + 60);
  }, []);

  if (reduceMotion) {
    return (
      <div className={className}>
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
          {text}
        </motion.span>
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { delayChildren: startDelay, staggerChildren: wordStagger } },
      }}
    >
      <div className={stacked ? "flex flex-col items-center justify-center gap-y-1" : "flex flex-wrap items-center justify-center gap-x-2 gap-y-1"}>
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            className="inline-block"
            variants={{
              hidden: { opacity: 0, y: -22, rotate: -1 },
              show: {
                opacity: 1,
                y: 0,
                rotate: 0,
                transition: { type: "spring", stiffness: 520, damping: 18, mass: 0.7 },
              },
            }}
            onAnimationComplete={() => onWordShown?.(i)}
          >
            <motion.span
              // one-time pulse when glow is first turned on
              key={i === glowWordIndex ? `glow-${glowPulseToken}` : `noglow-${i}`}
              animate={
                i === glowWordIndex && glowActive
                  ? {
                      textShadow: [
                        "0 0 10px rgba(34,197,94,0.22)",
                        "0 0 24px rgba(34,197,94,0.55)",
                        "0 0 14px rgba(34,197,94,0.35)",
                      ],
                    }
                  : undefined
              }
              transition={i === glowWordIndex && glowActive ? { duration: 0.95, ease: "easeInOut" } : undefined}
              className={
                "inline-flex" +
                (i === glowWordIndex && glowActive
                  ? " text-emerald-100"
                  : "")
              }
              style={
                i === glowWordIndex && glowActive
                  ? {
                      textShadow: "0 0 14px rgba(34,197,94,0.35)",
                      filter: "drop-shadow(0 0 8px rgba(34,197,94,0.18))",
                    }
                  : undefined
              }
              onPointerEnter={(e) => {
                if (i !== glowWordIndex) return;
                hoverStartsRef.current[`word-${i}`] = performance.now();
                // immediate small re-ignite for responsiveness
                onGlowHover?.(200);
              }}
              onPointerLeave={() => {
                if (i !== glowWordIndex) return;
                const start = hoverStartsRef.current[`word-${i}`];
                const hoverMs = start ? Math.max(0, performance.now() - start) : 0;
                delete hoverStartsRef.current[`word-${i}`];
                onGlowHover?.(hoverMs);
              }}
            >
              {Array.from(w).map((ch, ci) => {
                const key = `${i}-${ci}`;
                const state = ignite[key];
                const now = Date.now();
                const isIgnited = state ? state.untilMs > now : false;
                const intensity = state ? state.intensity : 0;
                const glowAlpha = 0.12 + 0.55 * intensity;
                const blur = 6 + 18 * intensity;

                return (
                  <span
                    key={key}
                    className="select-text transition-[text-shadow,filter,color] duration-150"
                    style={
                      isIgnited
                        ? {
                            color: "rgba(236, 253, 245, 1)",
                            textShadow: `0 0 ${blur}px rgba(34,197,94,${glowAlpha})`,
                            filter: `drop-shadow(0 0 ${Math.round(4 + 8 * intensity)}px rgba(34,197,94,${0.12 + 0.28 * intensity}))`,
                          }
                        : undefined
                    }
                    onPointerEnter={() => {
                      hoverStartsRef.current[key] = performance.now();
                      igniteKey(key, 0);
                    }}
                    onPointerLeave={() => {
                      const start = hoverStartsRef.current[key];
                      const hoverMs = start ? Math.max(0, performance.now() - start) : 0;
                      delete hoverStartsRef.current[key];
                      igniteKey(key, hoverMs);
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </motion.span>
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

function CenterGrowText({
  text,
  className,
  startDelay = 0,
  msPerChar = 12,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  msPerChar?: number;
}) {
  const reduceMotion = useReducedMotion();
  const full = String(text ?? "");
  const [idx, setIdx] = React.useState(0);
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    if (reduceMotion) return;
    setIdx(0);
    setStarted(false);

    const startTimer = window.setTimeout(() => {
      setStarted(true);
      if (full.length <= 0) return;
      setIdx(1);
      let i = 1;
      const t = window.setInterval(() => {
        i += 1;
        setIdx(Math.min(full.length, i));
        if (i >= full.length) window.clearInterval(t);
      }, Math.max(8, msPerChar));
      (startTimer as any).__interval = t;
    }, Math.max(0, Math.round(startDelay * 1000)));

    return () => {
      window.clearTimeout(startTimer);
      const maybeInterval = (startTimer as any).__interval as number | undefined;
      if (maybeInterval) window.clearInterval(maybeInterval);
    };
  }, [reduceMotion, full, startDelay, msPerChar]);

  if (reduceMotion) {
    return (
      <motion.p className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {full}
      </motion.p>
    );
  }

  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: startDelay }}
    >
      <span className="inline-block text-center">{started ? full.slice(0, idx) : "\u00A0"}</span>
    </motion.p>
  );
}

export default function HomeHero({
  isLoggedIn,
  userName,
}: {
  isLoggedIn: boolean;
  userName?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const headline = "Where choices know no limits";
  const mountAtRef = React.useRef<number | null>(null);
  const [whereGlowUntilMs, setWhereGlowUntilMs] = React.useState(0);
  const [wherePulseToken, setWherePulseToken] = React.useState(0);
  const [titleGlowUntilMs, setTitleGlowUntilMs] = React.useState(0);
  const [titlePulseToken, setTitlePulseToken] = React.useState(0);

  const headlineWords = headline.split(/\s+/).filter(Boolean).length;
  const headlineStart = 0.05;
  const headlineStagger = 0.16;
  const headlineLand = headlineStart + (headlineWords - 1) * headlineStagger;
  const titleStart = reduceMotion ? 0.08 : Math.max(0.1, headlineLand + 0.35);

  // Rough pacing so we can sequence elements without hard-coding everything.
  const titleTextMain = "Freedom Store";
  const titleLetterStagger = 0.11;
  const titleTrademarkExtraDelay = 0.24;
  const titleRevealSeconds = titleTextMain.length * titleLetterStagger;
  const titleFinish = reduceMotion ? 0.18 : titleStart + titleRevealSeconds + titleTrademarkExtraDelay + 0.25;

  // NOTE: Description should arrive LAST.
  const welcomeStart = reduceMotion ? 0.2 : titleFinish + 0.35;
  const buttonsStart = reduceMotion ? 0.26 : welcomeStart + 0.65;
  const descriptionStart = reduceMotion ? 0.35 : buttonsStart + 1.0;

  const descriptionText =
    "A clean, animated marketplace experience filled with tasteful motion, shipping intelligence, warehouse logistics, and a UI that stays out of your way.";
  const descriptionMsPerChar = 60;

  const whereGlowActive = !reduceMotion && Date.now() < whereGlowUntilMs;
  const titleGlowActive = !reduceMotion && Date.now() < titleGlowUntilMs;

  React.useEffect(() => {
    if (mountAtRef.current == null) mountAtRef.current = performance.now();
  }, []);

  React.useEffect(() => {
    if (!whereGlowActive) return;
    const t = window.setTimeout(() => setWhereGlowUntilMs(0), Math.max(0, whereGlowUntilMs - Date.now()) + 20);
    return () => window.clearTimeout(t);
  }, [whereGlowActive, whereGlowUntilMs]);

  React.useEffect(() => {
    if (!titleGlowActive) return;
    const t = window.setTimeout(() => setTitleGlowUntilMs(0), Math.max(0, titleGlowUntilMs - Date.now()) + 20);
    return () => window.clearTimeout(t);
  }, [titleGlowActive, titleGlowUntilMs]);

  // CTA choreography
  const browseDelay = buttonsStart + 0.02;
  const openFeedDelay = buttonsStart + 0.38;
  const nexusDelay = buttonsStart + 0.58;

  // After everything lands, do a single subtle emerald pulse on headline + primary CTA.
  const settlePulseDelay = buttonsStart + 1.05;

  // Chargeable hover glow for the primary CTA.
  const hoverProgress = useMotionValue(0);
  const glowOpacity = useTransform(hoverProgress, [0, 1], [0, 0.38]);
  const glowBlur = useTransform(hoverProgress, [0, 1], [18, 42]);
  const glowScale = useTransform(hoverProgress, [0, 1], [0.98, 1.06]);
  const rafRef = React.useRef<number | null>(null);
  const hoverStartRef = React.useRef<number | null>(null);
  const pulseTimeoutRef = React.useRef<number | null>(null);
  const [buttonPulseActive, setButtonPulseActive] = React.useState(false);

  return (
    <div className="relative flex h-[calc(100vh-102px)] max-h-full w-full items-center justify-center overflow-hidden">
      {/* subtle animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" /> {/* bg-gradient-to-b from-black via-black/70 to-emerald-950/30 dark:from-black dark:via-black/60 dark:to-emerald-950/20 */}
        <motion.div
          className="absolute -top-24 -right-24 h-[360px] w-[360px] rounded-full bg-emerald-500/15 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, 12, 0], opacity: [0.18, 0.25, 0.18] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-28 -left-28 h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-3xl"
          animate={{ x: [0, 22, 0], y: [0, -14, 0], opacity: [0.14, 0.22, 0.14] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="space-y-3">
          <motion.div
            className="relative inline-block rounded-2xl px-6 py-4 -mx-6 -my-4"
            // one-time pulse after the whole sequence settles
            style={{ textShadow: "0 0 0px rgba(34,197,94,0)" }}
            animate={{
              textShadow: [
                "0 0 0px rgba(34,197,94,0)",
                "0 0 18px rgba(34,197,94,0.35)",
                "0 0 0px rgba(34,197,94,0)",
              ],
            }}
            transition={{ delay: settlePulseDelay, duration: 1.05, ease: "easeInOut" }}
          >
            {/* Bigger glow field so the aura feels less "tight" */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-8 rounded-[28px]"
              animate={
                whereGlowActive
                  ? { opacity: [0.15, 0.28, 0.18], scale: [1, 1.03, 1] }
                  : { opacity: 0, scale: 1 }
              }
              transition={whereGlowActive ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
              style={{
                background:
                  "radial-gradient(closest-side, rgba(34,197,94,0.22), rgba(34,197,94,0) 72%)",
                mixBlendMode: "screen",
              }}
            />

            <DroppingWords
              text={headline}
              className="relative text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80 md:-translate-y-4 md:translate-x-6"
              startDelay={headlineStart}
              wordStagger={headlineStagger}
              stacked
              glowWordIndex={0}
              glowActive={whereGlowActive}
              glowPulseToken={wherePulseToken}
              onWordShown={(wordIndex) => {
                if (reduceMotion) return;
                if (wordIndex !== 0) return;
                if (mountAtRef.current == null) mountAtRef.current = performance.now();

                const nowSeconds = (performance.now() - mountAtRef.current) / 1000;
                const descSeconds = Math.max(2.0, (descriptionText.length * descriptionMsPerChar) / 1000);
                const allAnimationsFinishSeconds = descriptionStart + descSeconds + 0.9;

                // Keep glowing through the entire sequence, plus 5 seconds idle.
                const extraSeconds = clamp(allAnimationsFinishSeconds - nowSeconds + 5, 8, 30);
                setWhereGlowUntilMs(Date.now() + extraSeconds * 1000);
                setWherePulseToken((t) => t + 1);
              }}
              onGlowHover={(hoverMs) => {
                if (reduceMotion) return;
                // Re-ignite on hover: 5-10 seconds, longer hover -> stronger/longer.
                const extraMs = clamp(5000 + hoverMs * 2, 5000, 10000);
                setWhereGlowUntilMs((cur) => Math.max(cur, Date.now() + extraMs));
                setWherePulseToken((t) => t + 1);
              }}
            />
          </motion.div>

          <motion.div
            className="relative text-balance text-4xl font-semibold text-white drop-shadow-sm sm:text-6xl md:-translate-x-6"
            onPointerEnter={() => {
              if (reduceMotion) return;
              const extraMs = 9000;
              setTitleGlowUntilMs((cur) => Math.max(cur, Date.now() + extraMs));
            }}
            onPointerLeave={() => {
              if (reduceMotion) return;
              // Let it linger a bit after hover so it feels "alive".
              const extraMs = 6500;
              setTitleGlowUntilMs((cur) => Math.max(cur, Date.now() + extraMs));
            }}
          >
            <span className="relative inline-flex items-baseline">
              <AnimatedTitle
                text={titleTextMain}
                mode="prefix"
                baseDelay={titleStart}
                letterStagger={titleLetterStagger}
                trademarkDrop={false}
              />

              {/* TM: bouncy entrance (T then M), smaller at rest; on hover it jumps higher + grows + gets a rainbow tint */}
              <motion.span
                aria-label="Trademark"
                className="ml-1 inline-flex whitespace-nowrap leading-none tracking-tight"
                style={{ top: "-0.62em", left: "0.10em", position: "relative", fontSize: "0.44em" }}
                animate={
                  titleGlowActive
                    ? {
                        y: -10,
                        scale: 1.32,
                        textShadow: "0 0 16px rgba(34,197,94,0.20)",
                        filter: "drop-shadow(0 0 12px rgba(34,197,94,0.12))",
                      }
                    : { y: 0, scale: 1, textShadow: "0 0 0px rgba(34,197,94,0)", filter: "none" }
                }
                transition={{ type: "spring", stiffness: 520, damping: 18, mass: 0.7 }}
              >
                <motion.span
                  className={titleGlowActive ? "text-transparent" : "text-white"}
                  style={
                    titleGlowActive
                      ? {
                          backgroundImage:
                            "linear-gradient(90deg, rgba(167,243,208,1), rgba(96,165,250,1), rgba(192,132,252,1), rgba(244,114,182,1), rgba(167,243,208,1))",
                          backgroundSize: "300% 100%",
                          backgroundClip: "text",
                          WebkitBackgroundClip: "text",
                        }
                      : undefined
                  }
                  animate={titleGlowActive ? { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] } : undefined}
                  transition={titleGlowActive ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined}
                >
                  <motion.span
                    className="inline-block"
                    initial={{ opacity: 0, y: -18, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: browseDelay, type: "spring", stiffness: 720, damping: 16, mass: 0.65 }}
                  >
                    T
                  </motion.span>
                  <motion.span
                    className="inline-block"
                    initial={{ opacity: 0, y: -18, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: browseDelay + 0.3, type: "spring", stiffness: 720, damping: 16, mass: 0.65 }}
                  >
                    M
                  </motion.span>
                </motion.span>
              </motion.span>
            </span>
          </motion.div>
        </div>

        {/* Description arrives LAST, but space is reserved so it doesn't push anything when it begins */}
        <div className="w-full min-h-[3.25rem] sm:min-h-[3rem]">
          <CenterGrowText
            text={descriptionText}
            className="mx-auto max-w-2xl text-pretty text-sm text-white/75 sm:text-base"
            startDelay={descriptionStart}
            msPerChar={descriptionMsPerChar}
          />
        </div>

        <motion.div
          className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70 backdrop-blur"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 18%, rgba(0,0,0,1) 82%, rgba(0,0,0,0))",
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 18%, rgba(0,0,0,1) 82%, rgba(0,0,0,0))",
          }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: welcomeStart,
            opacity: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
            y: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
          }}
        >
          {isLoggedIn ? (
            <span>
              Welcome back{userName ? `, ${userName}` : ""}. Your homepage stays animated by default.
            </span>
          ) : (
            <span>Log in to unlock protected routes and personalization.</span>
          )}
        </motion.div>

        {/* CTAs should appear LAST */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: buttonsStart, duration: 0.22, ease: "easeOut" }}
        >
          {!isLoggedIn ? (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: buttonsStart + 0.05, duration: 0.35, ease: "easeOut" }}
            >
              <MyLoginButton mode="modal" asChild>
                <Button size="lg" variant="vegaEmeraldBtn" className="group">
                  <FaUnlockAlt size={21} className="mr-2 transition-transform group-hover:scale-110" />
                  Authenticate
                </Button>
              </MyLoginButton>
            </motion.div>
          ) : (
            <>
              {/* Browse products: arrives first from bottom-left, then does a single subtle emerald pulse */}
              <motion.div
                initial={{ opacity: 0, x: -44, y: 34 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  boxShadow: [
                    "0 0 0px rgba(34,197,94,0)",
                    "0 0 0px rgba(34,197,94,0)",
                    "0 0 26px rgba(34,197,94,0.45)",
                    "0 0 0px rgba(34,197,94,0)",
                  ],
                }}
                transition={{
                  delay: browseDelay,
                  duration: 0.65,
                  ease: "easeOut",
                  boxShadow: { delay: settlePulseDelay, duration: 1.05, ease: "easeInOut" },
                }}
                className="relative rounded-xl"
              >
                {/* chargeable glow + post-hover pulse layer */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-5 rounded-[20px] bg-emerald-400/25"
                  style={{
                    opacity: glowOpacity,
                    filter: glowBlur as any,
                    scale: glowScale,
                    mixBlendMode: "screen",
                  }}
                />
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-5 rounded-[20px]"
                  animate={
                    buttonPulseActive
                      ? {
                          opacity: [0.12, 0.34, 0.12],
                          scale: [1, 1.06, 1],
                        }
                      : { opacity: 0, scale: 1 }
                  }
                  transition={
                    buttonPulseActive
                      ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.2 }
                  }
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(34,197,94,0.22), rgba(34,197,94,0) 70%)",
                    mixBlendMode: "screen",
                  }}
                />
                <Button
                  asChild
                  size="lg"
                  variant="vegaBuyBtn"
                  className="shadow-none transition-[filter,transform] duration-300 hover:brightness-110"
                >
                  <Link
                    href="/products"
                    onPointerEnter={() => {
                      if (reduceMotion) return;
                      if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
                      setButtonPulseActive(false);
                      hoverStartRef.current = performance.now();

                      const loop = () => {
                        if (hoverStartRef.current == null) return;
                        const elapsed = performance.now() - hoverStartRef.current;
                        const p = clamp(elapsed / 5000, 0, 1);
                        hoverProgress.set(p);
                        rafRef.current = window.requestAnimationFrame(loop);
                      };

                      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
                      rafRef.current = window.requestAnimationFrame(loop);
                    }}
                    onPointerLeave={() => {
                      if (reduceMotion) return;
                      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
                      rafRef.current = null;

                      const start = hoverStartRef.current;
                      hoverStartRef.current = null;
                      const hoverSeconds = start ? clamp((performance.now() - start) / 1000, 0, 5) : 0;
                      const pulseSeconds = clamp(hoverSeconds * 2, 0, 10);

                      animate(hoverProgress, 0, { duration: 0.25, ease: "easeOut" });

                      if (pulseSeconds >= 0.6) {
                        setButtonPulseActive(true);
                        if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
                        pulseTimeoutRef.current = window.setTimeout(() => setButtonPulseActive(false), Math.round(pulseSeconds * 1000));
                      } else {
                        setButtonPulseActive(false);
                      }
                    }}
                  >
                    Browse products
                  </Link>
                </Button>
              </motion.div>

              {/* Open feed: tiny scale pop + wobble */}
              <motion.div
                initial={{ opacity: 0, scale: 0.05 }}
                whileHover={{ y: -2, scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                animate={{ opacity: 1, scale: 1, rotate: [0, -3, 3, -2, 0] }}
                transition={{
                  delay: openFeedDelay,
                  scale: { type: "spring", stiffness: 520, damping: 18, mass: 0.8 },
                  rotate: { duration: 0.55, ease: "easeInOut" },
                  opacity: { duration: 0.12, ease: "easeOut" },
                }}
                style={{ boxShadow: "0 0 0px rgba(34,197,94,0)" }}
                whileInView={undefined}
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 0px rgba(34,197,94,0)",
                      "0 0 16px rgba(34,197,94,0.18)",
                      "0 0 0px rgba(34,197,94,0)",
                    ],
                  }}
                  transition={{ delay: openFeedDelay + 0.25, duration: 0.75, ease: "easeInOut" }}
                  className="relative rounded-xl"
                >
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -inset-4 rounded-2xl opacity-0"
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{
                      background:
                        "radial-gradient(closest-side, rgba(34,197,94,0.16), rgba(34,197,94,0) 72%)",
                      mixBlendMode: "screen",
                    }}
                  />
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="transition-[box-shadow,transform] hover:shadow-[0_0_26px_rgba(34,197,94,0.18)]"
                  >
                  <Link href="/feed">Open feed</Link>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Nexus settings: comes from right */}
              <motion.div
                initial={{ opacity: 0, x: 22, y: 8 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: nexusDelay, duration: 0.55, ease: "easeOut" }}
                className="rounded-xl"
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 0px rgba(34,197,94,0)",
                      "0 0 16px rgba(34,197,94,0.16)",
                      "0 0 0px rgba(34,197,94,0)",
                    ],
                  }}
                  transition={{ delay: nexusDelay + 0.25, duration: 0.75, ease: "easeInOut" }}
                  className="relative rounded-xl"
                >
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -inset-4 rounded-2xl opacity-0"
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{
                      background:
                        "radial-gradient(closest-side, rgba(34,197,94,0.14), rgba(34,197,94,0) 72%)",
                      mixBlendMode: "screen",
                    }}
                  />
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="transition-[box-shadow,transform] hover:shadow-[0_0_24px_rgba(34,197,94,0.16)]"
                  >
                  <Link href="/nexus">Nexus settings</Link>
                  </Button>
                </motion.div>
              </motion.div>
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
