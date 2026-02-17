"use client";

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MyLoginButton } from "@/components/uicustom/auth/buttons/login-button";
import { FaLock, FaUnlockAlt } from "react-icons/fa";
import AnimatedTitle from "@/components/uicustom/animated-title";
import { useUiPreferences } from "@/components/providers/ui-preferences";

type IgniteState = {
  untilMs: number;
  intensity: number; // 0..1
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ============================================================================
// KINETIC TYPOGRAPHY - Round-robin character expansion with colorful glow
// ============================================================================

interface KineticStage {
  revealed: number[];
  activeWordIdx: number;
  activeCharIdx: number;
}

function buildFixedPositionStages(words: string[]): KineticStage[] {
  if (words.length === 0) return [{ revealed: [], activeWordIdx: -1, activeCharIdx: -1 }];

  const stages: KineticStage[] = [];

  // Phase 1: Build acronym - reveal first letter of each word one by one
  for (let i = 0; i < words.length; i++) {
    const revealed = words.map((_, idx) => (idx <= i ? 1 : 0));
    stages.push({ revealed, activeWordIdx: i, activeCharIdx: 0 });
  }

  // Phase 2: Cycling expansion - add one char to each word in rotation
  const revealed = words.map(() => 1);
  let safetyCounter = 0;
  const maxIterations = words.length * Math.max(...words.map((w) => w.length)) + 10;

  while (safetyCounter++ < maxIterations) {
    let anyIncomplete = false;
    for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
      const word = words[wordIdx];
      if (revealed[wordIdx] < word.length) {
        anyIncomplete = true;
        revealed[wordIdx]++;
        stages.push({ revealed: [...revealed], activeWordIdx: wordIdx, activeCharIdx: revealed[wordIdx] - 1 });
      }
    }
    if (!anyIncomplete) break;
  }

  // Final stage - all revealed, no active char
  stages.push({ revealed: words.map((w) => w.length), activeWordIdx: -1, activeCharIdx: -1 });
  return stages;
}

function KineticTitle({
  text,
  className,
  startDelay = 0,
  baseSpeed = 120,
  onHoverChange,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  baseSpeed?: number;
  onHoverChange?: (isHovering: boolean, char: string | null, intensity: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();
  const showFancyHover = prefs.hoverEffects === "colorful";
  const words = React.useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  
  const [stageIndex, setStageIndex] = React.useState(0);
  const [introDone, setIntroDone] = React.useState(false);
  const [hoveredChar, setHoveredChar] = React.useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = React.useState<{ wordIdx: number; charIdx: number } | null>(null);

  // Use ref to avoid re-running effect when callback changes
  const onHoverChangeRef = React.useRef(onHoverChange);
  React.useEffect(() => {
    onHoverChangeRef.current = onHoverChange;
  }, [onHoverChange]);

  const stages = React.useMemo(() => buildFixedPositionStages(words), [words]);

  React.useEffect(() => {
    if (reduceMotion) {
      setStageIndex(stages.length - 1);
      setIntroDone(true);
      return;
    }

    setStageIndex(0);
    setIntroDone(false);

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, startDelay * 1000));
      if (cancelled) return;

      const totalStages = stages.length;
      for (let i = 1; i < totalStages; i++) {
        if (cancelled) return;
        setStageIndex(i);
        const progress = i / totalStages;
        const easeOut = 1 - Math.pow(1 - progress, 2);
        const delay = Math.round(baseSpeed * (0.4 + easeOut * 0.6));
        await new Promise((r) => setTimeout(r, delay));
      }

      await new Promise((r) => setTimeout(r, 150));
      if (!cancelled) setIntroDone(true);
    };
    run();

    return () => { cancelled = true; };
  }, [reduceMotion, stages, startDelay, baseSpeed]);

  const getHoverEffect = React.useCallback((wordIdx: number, charIdx: number, char: string, isRevealed: boolean) => {
    // Allow hover as soon as character is revealed, don't wait for introDone
    if (!isRevealed || !hoveredChar) return { scale: 1, glow: false, intensity: 0 };

    const lowerChar = char.toLowerCase();
    const isMatchingChar = lowerChar === hoveredChar.toLowerCase();

    let currentFlatIdx = 0;
    for (let wi = 0; wi < wordIdx; wi++) currentFlatIdx += words[wi].length;
    currentFlatIdx += charIdx;

    let hoveredFlatIdx = 0;
    if (hoveredPosition) {
      for (let wi = 0; wi < hoveredPosition.wordIdx; wi++) hoveredFlatIdx += words[wi].length;
      hoveredFlatIdx += hoveredPosition.charIdx;
    }

    const distance = hoveredPosition ? Math.abs(currentFlatIdx - hoveredFlatIdx) : Infinity;

    if (distance === 0) return { scale: 1.35, glow: true, intensity: 1 };
    if (distance === 1) return { scale: 1.15, glow: true, intensity: 0.5 };
    if (isMatchingChar) return { scale: 1.25, glow: true, intensity: 0.8 };

    return { scale: 1, glow: false, intensity: 0 };
  }, [hoveredChar, hoveredPosition, words]);

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  const currentStage = stages[stageIndex] || { revealed: words.map((w) => w.length), activeWordIdx: -1, activeCharIdx: -1 };
  const { revealed, activeWordIdx, activeCharIdx } = currentStage;

  return (
    <span
      className={`${className} cursor-pointer`}
      onPointerLeave={() => {
        setHoveredChar(null);
        setHoveredPosition(null);
        onHoverChangeRef.current?.(false, null, 0);
      }}
    >
      <span className="inline-flex flex-wrap gap-[0.35em]">
        {words.map((word, wordIdx) => {
          const revealedCount = revealed[wordIdx] || 0;
          return (
            <span key={`word-${wordIdx}`} className="relative inline-block">
              <span className="invisible pointer-events-none" aria-hidden="true">
                {word[0].toUpperCase() + word.slice(1).toLowerCase()}
              </span>
              <span className="absolute inset-0 inline-flex">
                {Array.from(word).map((char, charIdx) => {
                  const isRevealed = charIdx < revealedCount;
                  const isNew = wordIdx === activeWordIdx && charIdx === activeCharIdx && !introDone;
                  const isFirstChar = charIdx === 0;
                  const displayChar = isFirstChar ? char.toUpperCase() : char.toLowerCase();
                  const hoverEffect = getHoverEffect(wordIdx, charIdx, char, isRevealed);

                  const charPosition = wordIdx * 10 + charIdx;
                  const hue = (charPosition * 40) % 360;
                  const glowColor = `hsl(${hue}, 80%, 65%)`;
                  
                  // Simple mode colors - emerald that's visible in both light/dark
                  // Intensity 1 = full color, 0.5 = weaker partner color
                  const simpleHoverColor = hoverEffect.intensity >= 0.8 
                    ? "rgb(16, 185, 129)" // emerald-500 for primary
                    : hoverEffect.intensity >= 0.4 
                      ? "rgb(52, 211, 153)" // emerald-400 for neighbors
                      : undefined;

                  // Always apply scale/position effects when hovering
                  const scale = isNew ? 1.35 : hoverEffect.scale;
                  const yOffset = isNew ? -3 : (hoverEffect.intensity > 0 ? -2 * hoverEffect.intensity : 0);
                  
                  // Glow effects only when fancy enabled
                  const showGlow = showFancyHover && (isNew || hoverEffect.glow);
                  const glowIntensity = isNew ? 1 : hoverEffect.intensity;
                  
                  // Color: fancy mode uses rainbow glow colors, simple mode uses solid emerald
                  const hoverColor = showFancyHover 
                    ? (showGlow ? glowColor : undefined)
                    : simpleHoverColor;

                  return (
                    <span
                      key={`char-${wordIdx}-${charIdx}`}
                      className="inline-block origin-bottom cursor-pointer"
                      style={{
                        opacity: isRevealed ? 1 : 0,
                        transform: `scale(${scale}) translateY(${yOffset}px)`,
                        color: hoverColor,
                        textShadow: showGlow
                          ? `0 0 ${14 * glowIntensity}px ${glowColor}, 0 0 ${28 * glowIntensity}px ${glowColor}, 0 0 ${42 * glowIntensity}px ${glowColor}`
                          : "none",
                        transition: "opacity 0.2s ease-out, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease-out, text-shadow 0.2s ease-out",
                      }}
                      onPointerEnter={() => {
                        // Always allow hover effects when character is revealed
                        if (isRevealed) {
                          setHoveredChar(char);
                          setHoveredPosition({ wordIdx, charIdx });
                          onHoverChangeRef.current?.(true, char, 1);
                        }
                      }}
                    >
                      {displayChar}
                    </span>
                  );
                })}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

function KineticDescription({
  text,
  className,
  startDelay = 0,
  startSpeed = 65,
  endSpeed = 12,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  startSpeed?: number;
  endSpeed?: number;
}) {
  const reduceMotion = useReducedMotion();

  // Split into words to prevent mid-word line breaks
  const words = React.useMemo(() => String(text ?? "").split(/\s+/).filter(Boolean), [text]);
  const totalChars = React.useMemo(
    () => words.reduce((sum, w) => sum + w.length, 0),
    [words]
  );
  const [revealCount, setRevealCount] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const innerTimeoutRef = React.useRef<number | null>(null);

  // Build reveal order from center outward (by character index across all words)
  const revealOrder = React.useMemo(() => {
    if (totalChars <= 0) return [] as number[];
    const center = Math.floor((totalChars - 1) / 2);
    const indices = Array.from({ length: totalChars }, (_, i) => i);
    indices.sort((a, b) => {
      const da = Math.abs(a - center);
      const db = Math.abs(b - center);
      if (da !== db) return da - db;
      return a - b;
    });
    return indices;
  }, [totalChars]);

  const revealed = React.useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < Math.min(revealCount, revealOrder.length); i += 1) {
      set.add(revealOrder[i]);
    }
    return set;
  }, [revealCount, revealOrder]);

  React.useEffect(() => {
    setRevealCount(0);
    setStarted(false);
    if (reduceMotion) return;
    if (totalChars <= 0) return;

    const startTimer = window.setTimeout(() => {
      setStarted(true);
      let i = 0;

      const tick = () => {
        i += 1;
        setRevealCount(i);
        if (i >= totalChars) return;
        const t = totalChars <= 1 ? 1 : i / (totalChars - 1);
        const delayMs = Math.round(startSpeed * (1 - t) + endSpeed * t);
        innerTimeoutRef.current = window.setTimeout(tick, Math.max(8, delayMs));
      };

      // Reveal first char quickly.
      innerTimeoutRef.current = window.setTimeout(tick, Math.max(8, startSpeed));
    }, Math.max(0, Math.round(startDelay * 1000)));

    return () => {
      window.clearTimeout(startTimer);
      if (innerTimeoutRef.current) window.clearTimeout(innerTimeoutRef.current);
    };
  }, [reduceMotion, totalChars, startDelay, startSpeed, endSpeed]);

  const wordStartIndices = React.useMemo(() => {
    return words.reduce<number[]>((acc, word) => {
      const prevStart = acc.length === 0 ? 0 : acc[acc.length - 1] + words[acc.length - 1].length;
      return [...acc, prevStart];
    }, []);
  }, [words]);

  if (reduceMotion) {
    return <p className={className}>{text}</p>;
  }

  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: startDelay }}
      // Use will-change to hint GPU compositing and prevent layout thrashing
      style={{ willChange: 'opacity, transform' }}
    >
      {/* Use standard inline text flow instead of flex to prevent word-by-word wrapping issues */}
      <span className="inline leading-relaxed">
        {words.map((word, wIdx) => {
          const startIdx = wordStartIndices[wIdx] ?? 0;
          return (
            <React.Fragment key={wIdx}>
              {/* Each word as inline-block prevents mid-word breaks */}
              <span className="inline-block whitespace-nowrap" style={{ willChange: 'contents' }}>
                {Array.from(word).map((ch, cIdx) => {
                  const charGlobalIdx = startIdx + cIdx;
                  return (
                    <motion.span
                      key={cIdx}
                      className="inline-block"
                      initial={false}
                      animate={
                        started && revealed.has(charGlobalIdx)
                          ? { opacity: 1, y: 0 }
                          : { opacity: 0, y: 2 }
                      }
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      style={{ willChange: 'opacity, transform' }}
                    >
                      {ch}
                    </motion.span>
                  );
                })}
              </span>
              {/* Add space after each word except the last */}
              {wIdx < words.length - 1 && <span className="inline-block w-[0.3em]">&nbsp;</span>}
            </React.Fragment>
          );
        })}
      </span>
    </motion.p>
  );
}

// Kinetic Headline - round-robin character expansion with dramatic pop and color effects
function KineticHeadline({
  text,
  className,
  startDelay = 0,
  baseSpeed = 150,
  onAnimationComplete,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  baseSpeed?: number;
  onAnimationComplete?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();
  const showFancyHover = prefs.hoverEffects === "colorful";
  const words = React.useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  const [stageIndex, setStageIndex] = React.useState(0);
  const [introDone, setIntroDone] = React.useState(false);
  const [hoveredChar, setHoveredChar] = React.useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = React.useState<{ wordIdx: number; charIdx: number } | null>(null);
  
  // Track last hover for fade-out effect
  const [lastHoverPosition, setLastHoverPosition] = React.useState<{ wordIdx: number; charIdx: number } | null>(null);
  const [fadeOutProgress, setFadeOutProgress] = React.useState(0);
  const fadeOutTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Use ref to avoid re-running effect when callback changes
  const onCompleteRef = React.useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  const stages = React.useMemo(() => buildFixedPositionStages(words), [words]);

  React.useEffect(() => {
    if (reduceMotion) {
      setStageIndex(stages.length - 1);
      setIntroDone(true);
      onCompleteRef.current?.();
      return;
    }

    setStageIndex(0);
    setIntroDone(false);

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, startDelay * 1000));
      if (cancelled) return;

      const totalStages = stages.length;
      for (let i = 1; i < totalStages; i++) {
        if (cancelled) return;
        setStageIndex(i);
        const progress = i / totalStages;
        const easeOut = 1 - Math.pow(1 - progress, 2);
        const delay = Math.round(baseSpeed * (0.5 + easeOut * 0.5));
        await new Promise((r) => setTimeout(r, delay));
      }

      await new Promise((r) => setTimeout(r, 200));
      if (!cancelled) {
        setIntroDone(true);
        onCompleteRef.current?.();
      }
    };
    run();

    return () => { cancelled = true; };
  }, [reduceMotion, stages, startDelay, baseSpeed]);

  // Handle hover end with fade-out
  const handlePointerLeave = React.useCallback(() => {
    if (hoveredPosition) {
      setLastHoverPosition(hoveredPosition);
      setFadeOutProgress(1);
      
      // Clear any existing timer
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
      
      // Animate fade-out over 500ms
      const steps = 10;
      const stepTime = 500 / steps;
      let step = 0;
      
      const animate = () => {
        step++;
        setFadeOutProgress(1 - (step / steps));
        if (step < steps) {
          fadeOutTimerRef.current = setTimeout(animate, stepTime);
        } else {
          setLastHoverPosition(null);
          setFadeOutProgress(0);
        }
      };
      fadeOutTimerRef.current = setTimeout(animate, stepTime);
    }
    setHoveredChar(null);
    setHoveredPosition(null);
  }, [hoveredPosition]);

  const getHoverEffect = React.useCallback((wordIdx: number, charIdx: number, char: string, isRevealed: boolean) => {
    // Check active hover
    const activePos = hoveredPosition || (fadeOutProgress > 0 ? lastHoverPosition : null);
    const effectMultiplier = hoveredPosition ? 1 : fadeOutProgress;
    
    // Allow hover as soon as character is revealed, don't wait for introDone
    if (!isRevealed || !activePos) return { scale: 1, glow: false, intensity: 0, wordGlow: false };

    const isInSameWord = wordIdx === activePos.wordIdx;
    const isHoveredChar = isInSameWord && charIdx === activePos.charIdx;
    const isNeighbor = isInSameWord && Math.abs(charIdx - activePos.charIdx) === 1;

    // Hovered character gets strongest effect
    if (isHoveredChar) {
      return { 
        scale: 1 + 0.35 * effectMultiplier, 
        glow: true, 
        intensity: 1 * effectMultiplier,
        wordGlow: false 
      };
    }
    
    // Immediate neighbors get medium effect
    if (isNeighbor) {
      return { 
        scale: 1 + 0.15 * effectMultiplier, 
        glow: true, 
        intensity: 0.6 * effectMultiplier,
        wordGlow: false 
      };
    }
    
    // Rest of the word gets subtle glow
    if (isInSameWord) {
      return { 
        scale: 1 + 0.05 * effectMultiplier, 
        glow: true, 
        intensity: 0.3 * effectMultiplier,
        wordGlow: true 
      };
    }

    return { scale: 1, glow: false, intensity: 0, wordGlow: false };
  }, [hoveredPosition, lastHoverPosition, fadeOutProgress]);

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  const currentStage = stages[stageIndex] || { revealed: words.map((w) => w.length), activeWordIdx: -1, activeCharIdx: -1 };
  const { revealed, activeWordIdx, activeCharIdx } = currentStage;

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: startDelay }}
      onPointerLeave={handlePointerLeave}
    >
      {/* Horizontal inline layout with proper word spacing */}
      <span className="inline-flex flex-wrap items-center justify-center gap-x-[0.5em]">
        {words.map((word, wordIdx) => {
          const revealedCount = revealed[wordIdx] || 0;
          return (
            <span key={`word-${wordIdx}`} className="relative inline-block">
              {/* Invisible placeholder for fixed width */}
              <span className="invisible pointer-events-none" aria-hidden="true">{word.toUpperCase()}</span>
              {/* Actual characters positioned absolutely */}
              <span className="absolute inset-0 inline-flex justify-center">
                {Array.from(word).map((char, charIdx) => {
                  const isRevealed = charIdx < revealedCount;
                  const isNew = wordIdx === activeWordIdx && charIdx === activeCharIdx && !introDone;
                  const hoverEffect = getHoverEffect(wordIdx, charIdx, char, isRevealed);

                  // Emerald/cyan gradient based on position
                  const charPosition = wordIdx * 10 + charIdx;
                  const hueBase = 140 + (charPosition * 15) % 80;
                  const glowColor = `hsl(${hueBase}, 75%, 65%)`;
                  // Solid hover color when fancy is disabled (emerald for consistency)
                  const solidHoverColor = "rgb(52, 211, 153)"; // emerald-400
                  
                  // Idle animation: subtle color pulse based on character position (no movement)
                  const idlePhase = (charPosition * 0.3) % (2 * Math.PI);

                  const scale = isNew ? 1.35 : hoverEffect.scale;
                  const yOffset = isNew ? -3 : (hoverEffect.intensity > 0 ? -2 * hoverEffect.intensity : 0);
                  const showGlow = isNew || hoverEffect.glow;
                  const glowIntensity = isNew ? 1 : hoverEffect.intensity;
                  
                  // Glow size based on intensity - stronger for direct hover, softer for word glow
                  const glowSize1 = hoverEffect.wordGlow ? 6 : 10;
                  const glowSize2 = hoverEffect.wordGlow ? 12 : 20;

                  // Determine color: fancy mode gets gradient glow colors, simple mode gets solid color
                  const hoverColor = showFancyHover ? glowColor : (showGlow ? solidHoverColor : undefined);

                  return (
                    <motion.span
                      key={`char-${wordIdx}-${charIdx}`}
                      className="inline-block origin-bottom cursor-pointer"
                      style={{
                        opacity: isRevealed ? 1 : 0,
                        color: hoverColor,
                        textShadow: showFancyHover && showGlow 
                          ? `0 0 ${glowSize1 * glowIntensity}px ${glowColor}, 0 0 ${glowSize2 * glowIntensity}px ${glowColor}` 
                          : "none",
                        transform: `scale(${scale}) translateY(${yOffset}px)`,
                        transition: "transform 0.15s ease-out, color 0.15s ease-out, text-shadow 0.15s ease-out",
                      }}
                      animate={
                        showFancyHover && introDone && !showGlow
                          ? {
                              textShadow: [
                                `0 0 0px ${glowColor}`,
                                `0 0 4px ${glowColor}`,
                                `0 0 0px ${glowColor}`,
                              ],
                            }
                          : undefined
                      }
                      transition={
                        showFancyHover && introDone && !showGlow
                          ? {
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: idlePhase * 0.15,
                            }
                          : undefined
                      }
                      onPointerEnter={() => {
                        // Allow hover as soon as character is revealed
                        if (isRevealed) {
                          // Clear any fade-out timer when new hover starts
                          if (fadeOutTimerRef.current) {
                            clearTimeout(fadeOutTimerRef.current);
                            fadeOutTimerRef.current = null;
                          }
                          setFadeOutProgress(0);
                          setLastHoverPosition(null);
                          setHoveredChar(char);
                          setHoveredPosition({ wordIdx, charIdx });
                        }
                      }}
                    >
                      {char.toUpperCase()}
                    </motion.span>
                  );
                })}
              </span>
            </span>
          );
        })}
      </span>
    </motion.span>
  );
}

// ============================================================================

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
  const { prefs } = useUiPreferences();
  const showFancyHover = prefs.hoverEffects === "colorful";
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
                (showFancyHover && i === glowWordIndex && glowActive
                  ? " text-emerald-100"
                  : "")
              }
              style={
                showFancyHover && i === glowWordIndex && glowActive
                  ? {
                      textShadow: "0 0 14px rgba(34,197,94,0.35)",
                      filter: "drop-shadow(0 0 8px rgba(34,197,94,0.18))",
                    }
                  : undefined
              }
              onPointerEnter={(e) => {
                if (!showFancyHover || i !== glowWordIndex) return;
                hoverStartsRef.current[`word-${i}`] = performance.now();
                // immediate small re-ignite for responsiveness
                onGlowHover?.(200);
              }}
              onPointerLeave={() => {
                if (!showFancyHover || i !== glowWordIndex) return;
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
                const isIgnited = showFancyHover && state ? state.untilMs > now : false;
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
                      if (!showFancyHover) return;
                      hoverStartsRef.current[key] = performance.now();
                      igniteKey(key, 0);
                    }}
                    onPointerLeave={() => {
                      if (!showFancyHover) return;
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
  const { prefs } = useUiPreferences();
  
  // Fancy effects only show when logged in AND user has enabled them in preferences
  const showFancyEffects = isLoggedIn && prefs.enableGradientSpheres;
  // Gradient/glow hover effects only when colorful hover is enabled
  const showFancyHover = prefs.hoverEffects === "colorful";
  const showAnimations = !reduceMotion && prefs.pageAnimations !== "none";
  
  const headline = "Where choices know no limits";
  const mountAtRef = React.useRef<number | null>(null);
  const [whereGlowUntilMs, setWhereGlowUntilMs] = React.useState(0);
  const [titleGlowUntilMs, setTitleGlowUntilMs] = React.useState(0);
  const [titlePulseToken, setTitlePulseToken] = React.useState(0);
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  // NEW SEQUENCE: Title → Description + Headline together → Buttons
  const titleTextMain = "Freedom Store";
  const titleStart = reduceMotion ? 0.08 : 0.1;
  
  // Description and Headline start at the SAME TIME (1.5s after title)
  const descriptionStart = reduceMotion ? 0.35 : titleStart + 1.5;
  const headlineStart = descriptionStart; // Same time as description
  const descriptionText =
    "A clean, animated marketplace experience filled with tasteful motion, shipping intelligence, warehouse logistics, and a UI that stays out of your way.";
  
  // Buttons come in early during the sequence - don't make users wait
  const buttonsStart = reduceMotion ? 0.26 : titleStart + 1.0;
  const welcomeStart = reduceMotion ? 0.2 : buttonsStart + 0.3;
  
  // State for title hover effect (to animate TM)
  const [titleHoverActive, setTitleHoverActive] = React.useState(false);
  const [titleAreaHovering, setTitleAreaHovering] = React.useState(false);
  const [tmLetterHover, setTmLetterHover] = React.useState<"T" | "M" | null>(null);

  const whereGlowActive = !reduceMotion && nowMs < whereGlowUntilMs;
  const titleGlowActive = !reduceMotion && nowMs < titleGlowUntilMs;
  // TM should reset immediately when hover ends; do not tie to the lingering title glow timer.
  const tmActive = !reduceMotion && (titleAreaHovering || titleHoverActive);

  React.useEffect(() => {
    if (mountAtRef.current == null) mountAtRef.current = performance.now();
  }, []);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
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
  const settlePulseDelay = headlineStart + 3.0;

  return (
    <div className="relative flex h-[calc(100vh-102px)] max-h-full w-full items-center justify-center overflow-hidden">
      {/* Conditional animated background - only shows for logged in users with fancy mode enabled */}
      {showFancyEffects && (
        <div className="pointer-events-none absolute inset-0 noise-overlay">
          <div className="absolute inset-0" />
          {/* Orb 1 - uses more color stops for smoother gradients on different monitors */}
          <motion.div
            className="absolute right-8 top-8 h-[520px] w-[520px] rounded-full"
            animate={showAnimations ? { x: [0, -18, 0], y: [0, 12, 0], opacity: [0.16, 0.26, 0.16], scale: [1, 1.05, 1] } : { opacity: 0.2 }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                "radial-gradient(closest-side, rgba(34,197,94,0.24) 0%, rgba(34,197,94,0.18) 25%, rgba(16,185,129,0.12) 50%, rgba(34,197,94,0.04) 75%, rgba(34,197,94,0) 100%)",
              mixBlendMode: "screen",
              filter: "blur(60px)",
            }}
          />
          {/* Orb 2 */}
          <motion.div
            className="absolute bottom-10 left-10 h-[580px] w-[580px] rounded-full"
            animate={showAnimations ? { x: [0, 24, 0], y: [0, -14, 0], opacity: [0.12, 0.22, 0.12], scale: [1, 1.04, 1] } : { opacity: 0.15 }}
            transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                "radial-gradient(closest-side, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0.12) 30%, rgba(167,139,250,0.08) 55%, rgba(56,189,248,0.02) 80%, rgba(56,189,248,0) 100%)",
              mixBlendMode: "screen",
              filter: "blur(60px)",
            }}
          />
        </div>
      )}

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 text-center xl:max-w-6xl"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="space-y-3">
          <motion.div
            className="relative inline-block rounded-2xl px-6 py-4 -mx-6 -my-4"
            // one-time pulse after the whole sequence settles (only if fancy enabled)
            style={showFancyEffects ? { textShadow: "0 0 0px rgba(34,197,94,0)" } : undefined}
            animate={showFancyEffects ? {
              textShadow: [
                "0 0 0px rgba(34,197,94,0)",
                "0 0 18px rgba(34,197,94,0.35)",
                "0 0 0px rgba(34,197,94,0)",
              ],
            } : undefined}
            transition={showFancyEffects ? { delay: settlePulseDelay, duration: 1.05, ease: "easeInOut" } : undefined}
            onPointerEnter={() => {
              if (reduceMotion || !showFancyEffects) return;
              setWhereGlowUntilMs((cur) => Math.max(cur, Date.now() + 8000));
            }}
            onPointerLeave={() => {
              if (reduceMotion || !showFancyEffects) return;
              setWhereGlowUntilMs((cur) => Math.max(cur, Date.now() + 4000));
            }}
          >
            {/* Idle glow field - only shows for logged in users with fancy effects */}
            {showFancyEffects && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -inset-8 rounded-[28px]"
                animate={
                  whereGlowActive
                    ? { opacity: [0.2, 0.35, 0.2], scale: [1, 1.05, 1] }
                    : { opacity: [0.05, 0.12, 0.05], scale: [1, 1.02, 1] }
                }
                transition={{ duration: whereGlowActive ? 2.2 : 4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(34,197,94,0.25), rgba(34,197,94,0) 72%)",
                  mixBlendMode: "screen",
                }}
              />
            )}

            <KineticHeadline
              text={headline}
              className="relative text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-200/80 cursor-pointer"
              startDelay={headlineStart}
              baseSpeed={100}
              onAnimationComplete={() => {
                // Trigger glow after headline animation finishes
                setWhereGlowUntilMs(Date.now() + 10000);
              }}
            />
          </motion.div>

          <motion.div
            className="relative mt-1 text-balance text-4xl font-semibold tracking-[0.02em] text-gray-900 dark:text-white drop-shadow-sm sm:text-6xl lg:text-7xl 2xl:text-8xl"
            onPointerEnter={() => {
              if (reduceMotion) return;
              setTitleAreaHovering(true);
              const extraMs = 9000;
              setTitleGlowUntilMs((cur) => Math.max(cur, Date.now() + extraMs));
            }}
            onPointerLeave={() => {
              if (reduceMotion) return;
              setTitleAreaHovering(false);
              // Let it linger a bit after hover so it feels "alive".
              const extraMs = 6500;
              setTitleGlowUntilMs((cur) => Math.max(cur, Date.now() + extraMs));
            }}
          >
            <span className="relative inline-flex items-baseline">
              <KineticTitle
                text={titleTextMain}
                startDelay={titleStart}
                baseSpeed={140}
                onHoverChange={(isHovering) => setTitleHoverActive(isHovering)}
              />

              {/* TM: bouncy entrance (T then M), smaller at rest; on hover it jumps higher + grows + gets a rainbow tint */}
              <motion.span
                aria-label="Trademark"
                className="relative z-20 ml-1 inline-flex whitespace-nowrap leading-none tracking-tight"
                style={{ top: "-0.62em", left: "0.10em", position: "relative", fontSize: "0.44em" }}
                initial={false}
                animate={tmActive ? { y: -11, scale: 1.38, rotate: -6 } : { y: 0, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 18, mass: 0.6 }}
              >
                {/* Soft glow layer - only shown when fancy hover enabled */}
                {showFancyHover && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute -inset-4 -z-10 rounded-full blur-lg"
                    initial={false}
                    animate={tmActive ? { opacity: 0.42, scale: 1 } : { opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{
                      background:
                        "radial-gradient(closest-side, rgba(96,165,250,0.42), rgba(167,139,250,0.26), rgba(96,165,250,0) 72%)",
                      mixBlendMode: "screen",
                    }}
                  />
                )}

                <motion.span
                  className="relative z-10 inline-flex text-gray-900 dark:text-white"
                  style={{
                    filter: showFancyHover && tmActive ? "drop-shadow(0 0 10px rgba(167,139,250,0.28))" : "none",
                    textShadow: showFancyHover && tmActive
                      ? "0 0 10px rgba(96,165,250,0.25), 0 0 18px rgba(167,139,250,0.18)"
                      : "none",
                  }}
                  animate={undefined}
                  transition={undefined}
                >
                  <motion.span
                    className="inline-block cursor-pointer text-gray-900 dark:text-white"
                    initial={{ opacity: 0, y: -18, scale: 0.7 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0, 
                      scale: tmLetterHover === "T" ? (tmActive ? 1.34 : 1.24) : tmActive ? 1.12 : 1,
                      rotate: tmLetterHover === "T" ? -10 : 0,
                    }}
                    transition={{ delay: browseDelay, type: "spring", stiffness: 760, damping: 16, mass: 0.6 }}
                    onPointerEnter={() => setTmLetterHover("T")}
                    onPointerLeave={() => setTmLetterHover(null)}
                    style={
                      tmLetterHover === "T" && showFancyHover
                        ? {
                            color: "#e5fff7",
                            textShadow:
                              "0 0 8px rgba(34,197,94,0.55), 0 0 14px rgba(56,189,248,0.45), 0 0 18px rgba(167,139,250,0.35), 0 0 26px rgba(236,72,153,0.25)",
                            filter: "drop-shadow(0 0 12px rgba(34,197,94,0.25))",
                          }
                        : undefined
                    }
                  >
                    T
                  </motion.span>
                  <motion.span
                    className="inline-block cursor-pointer text-gray-900 dark:text-white"
                    initial={{ opacity: 0, y: -18, scale: 0.7 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0, 
                      scale: tmLetterHover === "M" ? (tmActive ? 1.34 : 1.24) : tmActive ? 1.12 : 1,
                      rotate: tmLetterHover === "M" ? 10 : 0,
                    }}
                    transition={{ delay: browseDelay + 0.3, type: "spring", stiffness: 760, damping: 16, mass: 0.6 }}
                    onPointerEnter={() => setTmLetterHover("M")}
                    onPointerLeave={() => setTmLetterHover(null)}
                    style={
                      tmLetterHover === "M" && showFancyHover
                        ? {
                            color: "#fff7ff",
                            textShadow:
                              "0 0 8px rgba(236,72,153,0.55), 0 0 14px rgba(167,139,250,0.45), 0 0 18px rgba(56,189,248,0.35), 0 0 26px rgba(250,204,21,0.22)",
                            filter: "drop-shadow(0 0 12px rgba(236,72,153,0.22))",
                          }
                        : undefined
                    }
                  >
                    M
                  </motion.span>
                </motion.span>
              </motion.span>
            </span>
          </motion.div>
        </div>

        {/* Description comes after title with slow-to-fast animation */}
        <div className="w-full min-h-[3.25rem] sm:min-h-[3rem] mt-10 sm:mt-12">
          <KineticDescription
            text={descriptionText}
            className={`mx-auto max-w-3xl text-pretty text-sm text-gray-600 dark:text-white/75 sm:text-base transition-[color,text-shadow] duration-700 ease-out hover:text-gray-800 dark:hover:text-white/85 ${showFancyHover ? "hover:[text-shadow:0_0_18px_rgba(56,189,248,0.16)]" : ""}`}
            startDelay={descriptionStart}
            startSpeed={45}
            endSpeed={12}
          />
        </div>

        {/* CTAs */}
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-3 md:mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: buttonsStart, duration: 0.22, ease: "easeOut" }}
        >
          {/* Browse products: shown for ALL users */}
          <motion.div
            initial={{ opacity: 0, x: -44, y: 34 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{
              delay: browseDelay,
              duration: 0.65,
              ease: "easeOut",
            }}
            className="relative group"
          >
            {/* Animated gradient border with idle pulse */}
            <motion.div
              className="absolute -inset-[1px] rounded-xl bg-linear-to-r from-emerald-500 via-cyan-400 to-emerald-500 blur-[2px] group-hover:blur-[3px]"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                opacity: [0.5, 0.8, 0.5],
              }}
              whileHover={{ opacity: 1 }}
              transition={{
                backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" },
                opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              }}
              style={{ backgroundSize: "200% 200%" }}
            />
            {/* Glow on hover */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-2xl"
              animate={{ opacity: [0, 0.08, 0] }}
              whileHover={{ opacity: 0.25 }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background: "radial-gradient(closest-side, rgba(34,197,94,0.25), transparent 70%)",
              }}
            />
            <Link
              href="/products"
              className="relative flex items-center gap-2 rounded-xl bg-emerald-600 dark:bg-black/80 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 group-hover:bg-emerald-700 dark:group-hover:bg-black/90 group-hover:text-emerald-100 dark:group-hover:text-emerald-300"
            >
              <motion.span
                className="inline-block"
                whileHover={{ x: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                Browse products
              </motion.span>
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </motion.svg>
            </Link>
          </motion.div>

          {/* Open Pulse: shown for ALL users */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: openFeedDelay,
              type: "spring",
              stiffness: 400,
              damping: 20,
            }}
            className="relative group"
          >
            {/* Subtle idle border pulse */}
            <motion.div
              className="absolute -inset-[1px] rounded-xl bg-linear-to-r from-gray-400/20 via-gray-400/40 to-gray-400/20 dark:from-white/5 dark:via-white/15 dark:to-white/5 blur-[1px]"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              whileHover={{ opacity: 0.7 }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ backgroundSize: "200% 200%" }}
            />
            <Link
              href="/pulse"
              className="relative flex items-center gap-2 rounded-xl border border-gray-300 dark:border-white/20 bg-gray-100/80 dark:bg-white/5 px-5 py-3 text-sm font-medium text-gray-700 dark:text-white/80 backdrop-blur-sm transition-all duration-300 hover:border-gray-400 dark:hover:border-white/40 hover:bg-gray-200/80 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white group-hover:shadow-[0_0_20px_rgba(0,0,0,0.08)] dark:group-hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]"
            >
              <span className="relative h-4 w-4">
                <span className="absolute inset-0 opacity-60 transition-all duration-300 group-hover:opacity-0 group-hover:-rotate-12">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 11a9 9 0 0 1 9 9" />
                    <path d="M4 4a16 16 0 0 1 16 16" />
                    <circle cx="5" cy="19" r="1" />
                  </svg>
                </span>
                <span className="absolute inset-0 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:rotate-12">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13 2 3 14h7l-1 8 12-14h-7l1-6z" />
                  </svg>
                </span>
              </span>
              <span>Open Pulse</span>
            </Link>
          </motion.div>

          {/* Authenticate: only for non-logged-in users - stealth style */}
          {!isLoggedIn && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: buttonsStart + 0.05, duration: 0.35, ease: "easeOut" }}
              className="relative group"
            >
              <MyLoginButton mode="modal" asChild>
                <button className="relative flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-gray-500 dark:text-white/60 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white/90">
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-0 transition-all duration-300 group-hover:opacity-0 group-hover:-rotate-12">
                      <FaLock size={16} className="opacity-50 group-hover:opacity-100" />
                    </span>
                    <span className="absolute inset-0 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:rotate-12">
                      <FaUnlockAlt size={16} className="opacity-50 group-hover:opacity-100" />
                    </span>
                  </span>
                  <span>Authenticate</span>
                </button>
              </MyLoginButton>
            </motion.div>
          )}

          {/* Nexus settings: only for logged-in users */}
          {isLoggedIn && (
            <motion.div
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: nexusDelay, duration: 0.5, ease: "easeOut" }}
              className="relative group"
            >
              <Link
                href="/nexus"
                className="relative flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-gray-500 dark:text-white/60 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white/90"
              >
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-50 group-hover:opacity-100 transition-opacity"
                  animate={{ rotate: 0 }}
                  whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </motion.svg>
                <span>Nexus settings</span>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
