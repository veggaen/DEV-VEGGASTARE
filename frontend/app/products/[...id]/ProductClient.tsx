"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CiStar } from "react-icons/ci";
import { useSession } from "next-auth/react";
import { CiMapPin } from "react-icons/ci";
import { GoPackage } from "react-icons/go";
import { CiDeliveryTruck } from "react-icons/ci";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import { BringShippingDetails } from "@/components/uicustom/product/bringShipping-details";
import { fetchPostalCodeFromCoords } from "@/components/uicustom/product/postal-code-from-coords";
import { fetchCoordsFromPostalCode } from "@/components/uicustom/product/postal-cords-from-code";
import { getCountryCode, haversineDistance } from "@/lib/utils";
import ProductSkeleton from "@/components/uicustom/skeletons/product-skeleton";
import PriceAmount from "@/components/crypto-related/PriceAmount";
import { usePricing } from "@/components/crypto-related/PricingContext";
import { useTheme } from "next-themes";
import { useUiPreferences } from "@/components/providers/ui-preferences";
import ProductHeroHeading from "@/components/uicustom/product/product-hero-heading";

function getNavigationType() {
  try {
    const entry = performance.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    return entry?.type ?? "navigate";
  } catch {
    return "navigate";
  }
}

function useOncePerTabGate(key: string) {
  const reduceMotion = useReducedMotion();
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setPlay(false);
      return;
    }

    // In dev, components can mount twice (React StrictMode). If we write to
    // sessionStorage immediately, the *second* mount will think it already played
    // and you'll see no intro at all. To avoid that, we delay the write slightly
    // and cancel it on unmount.
    // Also allow forcing intros for testing via ?intro=1
    try {
      const force = new URLSearchParams(window.location.search).get("intro") === "1";
      if (force) {
        setPlay(true);
        return;
      }

      const k = `vega:intro:${key}`;
      const now = Date.now();
      const lastRaw = window.sessionStorage.getItem(k);
      const last = lastRaw ? Number(lastRaw) : 0;

      if (Number.isFinite(last) && last > 0 && now - last < 1200) {
        setPlay(false);
        return;
      }

      setPlay(true);

      let cancelled = false;
      const t = window.setTimeout(() => {
        if (cancelled) return;
        try {
          window.sessionStorage.setItem(k, String(Date.now()));
        } catch {
          // ignore
        }
      }, 50);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    } catch {
      // If storage is blocked, just play once for this mount.
      setPlay(true);
    }
  }, [key, reduceMotion]);

  return play;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sanitizeNumberText(input: string) {
  // Some locales/fonts can render the decimal separator as a middle dot.
  // Also guard against accidental duplicate separators.
  return String(input ?? "")
    .replace(/\u00B7/g, ".")
    .replace(/\u2219/g, ".")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function formatDecimal(value: number, maxFractionDigits: number) {
  try {
    if (!Number.isFinite(value)) return "0";
    const nf = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: 0,
      useGrouping: true,
    });
    return sanitizeNumberText(nf.format(value));
  } catch {
    return sanitizeNumberText(String(value));
  }
}

function formatUSD(value: number) {
  try {
    if (!Number.isFinite(value)) return "$0";
    const nf = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    return sanitizeNumberText(nf.format(value));
  } catch {
    return `$${formatDecimal(value, 2)}`;
  }
}

function useReloadIntroGate(key: string) {
  const reduceMotion = useReducedMotion();
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setPlay(false);
      return;
    }

    const type = getNavigationType();
    // User asked explicitly for Ctrl+R (reload). Don't replay on client-side navigation.
    if (type !== "reload") {
      setPlay(false);
      return;
    }

    setPlay(true);
  }, [key, reduceMotion]);

  return play;
}

function normalizeDisplayText(input: string) {
  return String(input ?? "")
    .replace(/\\u00A0/g, " ")
    .replace(/\u00A0/g, " ")
    // Guard against stray carousel helper text getting mixed into the title.
    .replace(/\b(?:Next|Previous)\s+slide\s+\d+\s*\/\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type RevealToken = {
  raw: string;
  units: string[];
  joiner?: string;
};

function splitRevealToken(raw: string): RevealToken {
  const token = String(raw ?? "").trim();
  if (!token) return { raw: token, units: [] };

  // Treat hyphenated tokens as multiple reveal streams that later merge.
  if (token.includes("-")) {
    const parts = token.split("-").filter(Boolean);
    if (parts.length > 1) {
      return { raw: token, units: parts, joiner: "-" };
    }
  }
  return { raw: token, units: [token] };
}

function clampUnitCount(step: number, unitLen: number) {
  return Math.max(0, Math.min(unitLen, step));
}

function useRsvpTypingIntro(fullText: string, play: boolean, rsvpWpm: number) {
  const reduceMotion = useReducedMotion();
  const cleaned = useMemo(() => normalizeDisplayText(fullText), [fullText]);

  const [phase, setPhase] = useState<"acronym" | "typing" | "done">("done");
  const [idx, setIdx] = useState(0);

  const acronym = useMemo(() => {
    const words = cleaned.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return cleaned;
    return words.map((w) => w.slice(0, 1)).join(" ");
  }, [cleaned]);

  useEffect(() => {
    if (reduceMotion || !play) {
      setPhase("done");
      setIdx(cleaned.length);
      return;
    }

    let cancelled = false;
    let t1: number | undefined;
    let t2: number | undefined;
    let interval: number | undefined;

    setPhase("acronym");
    setIdx(0);

    // WPM -> rough ms/char (assume ~5 chars per word)
    const msPerChar = clamp(Math.round(60000 / Math.max(60, rsvpWpm) / 5), 16, 64);

    // Hold acronym briefly, then type the full title.
    t1 = window.setTimeout(() => {
      if (cancelled) return;
      setPhase("typing");
      setIdx(0);
      interval = window.setInterval(() => {
        setIdx((prev) => {
          const next = Math.min(cleaned.length, prev + 1);
          if (next >= cleaned.length) {
            if (interval) window.clearInterval(interval);
            // tiny settle beat
            t2 = window.setTimeout(() => {
              if (!cancelled) setPhase("done");
            }, 120);
          }
          return next;
        });
      }, msPerChar);
    }, 420);

    return () => {
      cancelled = true;
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      if (interval) window.clearInterval(interval);
    };
  }, [cleaned, play, reduceMotion, rsvpWpm]);

  const displayText = phase === "acronym" ? acronym : cleaned.slice(0, idx);
  return {
    phase,
    displayText: displayText.length ? displayText : "\u00A0",
    cleaned,
  };
}

function AnimatedRating() {
  const reduceMotion = useReducedMotion();
  const intro = useReloadIntroGate("rating");

  const text = "Rating coming soon";
  const letters = useMemo(() => Array.from(text), [text]);

  if (reduceMotion || !intro) {
    return <span className="text-sm">{text}</span>;
  }

  return (
    <motion.span
      className="text-sm inline-flex"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.02, delayChildren: 0.05 } },
      }}
    >
      {letters.map((ch, idx) => (
        <motion.span
          key={`${ch}-${idx}`}
          className={ch === " " ? "w-[0.35em]" : undefined}
          variants={{
            hidden: { opacity: 0, y: 4, filter: "blur(6px)" },
            show: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { type: "tween", duration: 0.25, ease: "easeOut" },
            },
          }}
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

interface Specification { key: string; value: string; }
interface WarehouseLocation { id: string; country: string; postalCode: string; countryCode?: string; }
interface Inventory { id: string; stock: number; warehouseId: string; }

interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number; // stored in USD
  image: string[];
  specifications: Specification[] | null;
  company: { warehouseLocations: WarehouseLocation[] | null } | null;
  inventory: Inventory[];
  shipFromPostalId: string;
  updatedAt: string;
  createdAt: string;
}

const parseWarehouseLocations = (locations: WarehouseLocation[] = []) =>
  locations.map((location) => ({ ...location, countryCode: getCountryCode(location.country) }));

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

// Helper: build sequential single-character expansion stages with UPPERCASE emphasis
// Exact sequence: A -> AN -> A N -> A NS -> A N S -> A N SP -> A N S P -> AD N S P -> ...
// New characters are UPPERCASE, previous chars normalize to proper case
function buildKineticStages(words: string[]): Array<{ text: string; newCharIdx: number }> {
  if (words.length === 0) return [{ text: "", newCharIdx: -1 }];

  const stages: Array<{ text: string; newCharIdx: number }> = [];

  // Phase 1: Build up the acronym character by character
  // A -> AN -> A N -> A NS -> A N S -> A N SP -> A N S P
  const acronymChars = words.map((w) => w[0].toUpperCase());
  let acronymBuild = "";
  for (let i = 0; i < acronymChars.length; i++) {
    // Add the letter (UPPERCASE as it's new)
    acronymBuild += acronymChars[i];
    stages.push({ text: acronymBuild, newCharIdx: acronymBuild.length - 1 });

    // Add space after (except for last)
    if (i < acronymChars.length - 1) {
      // Before space: next letter appears attached
      acronymBuild += acronymChars[i + 1];
      stages.push({ text: acronymBuild, newCharIdx: acronymBuild.length - 1 });
      // Then space appears
      acronymBuild = acronymBuild.slice(0, -1) + " " + acronymChars[i + 1];
      stages.push({ text: acronymBuild, newCharIdx: -1 });
    }
  }

  // Phase 2: Cycling expansion - add one char to each word in rotation
  // Track current length of each word (starts at 1 for acronym)
  const wordLengths = words.map(() => 1);

  // Keep cycling until all words are complete
  let safetyCounter = 0;
  const maxIterations = words.length * Math.max(...words.map((w) => w.length)) + 10;

  while (safetyCounter++ < maxIterations) {
    let anyIncomplete = false;

    for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
      const word = words[wordIdx];
      if (wordLengths[wordIdx] < word.length) {
        anyIncomplete = true;
        wordLengths[wordIdx]++;

        // Build the display text with proper casing:
        // - Previous chars: first letter upper, rest lower
        // - New char: UPPERCASE
        const displayParts: string[] = [];
        let globalNewCharIdx = -1;
        let charCount = 0;

        for (let wi = 0; wi < words.length; wi++) {
          const w = words[wi];
          const len = wordLengths[wi];
          let part = "";

          for (let ci = 0; ci < len; ci++) {
            const isNewChar = wi === wordIdx && ci === len - 1;
            if (isNewChar) {
              globalNewCharIdx = charCount;
              part += w[ci].toUpperCase();
            } else {
              // Proper case: first char upper, rest lower
              part += ci === 0 ? w[ci].toUpperCase() : w[ci].toLowerCase();
            }
            charCount++;
          }

          displayParts.push(part);
          charCount++; // for space
        }

        stages.push({ text: displayParts.join(" "), newCharIdx: globalNewCharIdx });
      }
    }

    if (!anyIncomplete) break;
  }

  // Phase 3: Final stage - fully normalized proper case (no uppercase emphasis)
  const finalText = words
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const lastStage = stages[stages.length - 1];
  if (!lastStage || lastStage.text !== finalText) {
    stages.push({ text: finalText, newCharIdx: -1 });
  }

  return stages;
}

function buildParallelExpansionStages(text: string, acronymIndices: number[]): string[] {
  if (!text) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];

  const result: string[] = [];

  // Stage 0: acronym (single letter per word)
  if (acronymIndices.length > 0) {
    const acronymChars: string[] = [];
    let wordIdx = 0;
    for (const charIdx of acronymIndices) {
      if (wordIdx < words.length) {
        acronymChars.push(words[wordIdx][charIdx] || words[wordIdx][0]);
        wordIdx++;
      }
    }
    result.push(acronymChars.join(" "));
  } else {
    result.push(words.map((w) => w[0]).join(" "));
  }

  // Track how many characters revealed per word
  const revealed = words.map(() => 1); // start at 1 (acronym)
  const maxLengths = words.map((w) => w.length);

  // Keep adding one character to one word at a time, cycling through words
  let allComplete = false;
  while (!allComplete) {
    let addedAny = false;
    for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
      if (revealed[wordIdx] < maxLengths[wordIdx]) {
        revealed[wordIdx]++;
        const stage = words
          .map((w, i) => w.slice(0, revealed[i]))
          .join(" ");
        if (stage !== result[result.length - 1]) result.push(stage);
        addedAny = true;
        break; // add one char then cycle to next iteration
      }
    }
    if (!addedAny) allComplete = true;
  }

  // Final
  if (result[result.length - 1] !== text) result.push(text);
  return result;
}

// Helper: build visibility map for current stage
function buildVisibilityMap(fullText: string, currentStage: string) {
  const positions = new Set<number>();
  let fullTextPos = 0;
  for (let i = 0; i < currentStage.length; i++) {
    const ch = currentStage[i];
    while (fullTextPos < fullText.length && fullText[fullTextPos] !== ch) {
      fullTextPos++;
    }
    if (fullTextPos < fullText.length) {
      positions.add(fullTextPos);
      fullTextPos++;
    }
  }
  return positions;
}

function AnimatedProductTitle({
  text,
  mode,
  rsvpWpm,
}: {
  text: string;
  mode: "letters" | "rsvp" | "off";
  rsvpWpm: number;
}) {
  const reduceMotion = useReducedMotion();
  const cleaned = useMemo(() => normalizeDisplayText(text), [text]);

  const reloadIntro = useReloadIntroGate(`title-kinetic:${cleaned}`);
  const tabIntro = useOncePerTabGate(`title-kinetic:${cleaned}:${mode}:${rsvpWpm}`);
  const intro = reloadIntro || tabIntro;

  const words = useMemo(() => cleaned.split(/\s+/).filter(Boolean), [cleaned]);
  const shouldAnimate = !reduceMotion && intro && mode !== "off" && words.length > 0;

  const [hoverLetter, setHoverLetter] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [introDone, setIntroDone] = useState(!shouldAnimate);

  // Build the kinetic stages sequence with UPPERCASE emphasis for new chars
  const stages = useMemo(() => buildKineticStages(words), [words]);

  useEffect(() => {
    if (!shouldAnimate) {
      setStageIndex(stages.length - 1);
      setIntroDone(true);
      return;
    }

    setStageIndex(0);
    setIntroDone(false);

    let cancelled = false;
    const run = async () => {
      // Initial pause - let user absorb the first letter
      await new Promise((r) => setTimeout(r, 800));
      if (cancelled) return;

      // Advance through stages with smooth, eased pacing
      const totalStages = stages.length;
      for (let i = 1; i < totalStages; i++) {
        if (cancelled) return;
        setStageIndex(i);
        
        // Smooth easing: start slower, speed up slightly in middle, slow at end
        const progress = i / totalStages;
        const isAcronymPhase = i < words.length * 3;
        const isNearEnd = progress > 0.85;
        
        let delay: number;
        if (isAcronymPhase) {
          delay = 140; // Build acronym at steady pace
        } else if (isNearEnd) {
          delay = 160; // Slow down near the end for anticipation
        } else {
          delay = 120; // Main expansion phase
        }
        
        await new Promise((r) => setTimeout(r, delay));
      }

      // Longer settle at the end
      await new Promise((r) => setTimeout(r, 500));
      if (!cancelled) setIntroDone(true);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [shouldAnimate, stages, words.length]);

  if (reduceMotion || mode === "off") {
    return (
      <h1 className="text-balance text-2xl md:text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
        {cleaned}
      </h1>
    );
  }

  const currentStage = stages[stageIndex] || { text: cleaned, newCharIdx: -1 };
  const displayChars = Array.from(currentStage.text);
  const newCharIdx = currentStage.newCharIdx;

  // Pre-compute styles to avoid recalculating in render
  const getCharStyle = useCallback((idx: number, ch: string) => {
    const isNew = idx === newCharIdx;
    const lowerCh = ch.toLowerCase();
    const shouldScale = hoverLetter && lowerCh === hoverLetter.toLowerCase();
    
    if (shouldScale) {
      return { transform: "scale(1.15)", transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)" };
    }
    if (isNew && !introDone) {
      return { 
        transform: "scale(1.08) translateY(-1px)", 
        transition: "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
      };
    }
    return { transform: "scale(1) translateY(0)", transition: "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)" };
  }, [newCharIdx, hoverLetter, introDone]);

  return (
    <motion.h1
      className="group relative text-balance text-2xl md:text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white drop-shadow-sm"
      aria-label={cleaned}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Main text - using CSS transitions for performance */}
      <span className="relative inline-flex flex-wrap will-change-contents">
        {displayChars.map((ch, idx) => {
          const isSpace = ch === " ";
          const style = getCharStyle(idx, ch);

          return (
            <span
              key={`char-${idx}`}
              className={isSpace ? "w-[0.35em]" : "inline-block cursor-default origin-bottom will-change-transform"}
              style={style}
              onPointerEnter={() => !isSpace && setHoverLetter(ch)}
              onPointerLeave={() => setHoverLetter(null)}
            >
              {isSpace ? "\u00A0" : ch}
            </span>
          );
        })}
      </span>

      {/* Hover rainbow accent (only after intro done) */}
      {introDone && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-sky-300 to-fuchsia-300 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
        >
          {cleaned}
        </span>
      )}

      {/* Idle shimmer overlay (pauses on hover) */}
      {introDone && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-white/0 via-white/30 to-white/0"
          style={{ backgroundSize: "240% 100%" }}
          animate={{
            opacity: hoverLetter ? 0 : 0.08,
            backgroundPosition: hoverLetter ? "0% 50%" : ["0% 50%", "100% 50%"],
          }}
          transition={{
            opacity: { duration: 0.15 },
            backgroundPosition: hoverLetter
              ? { duration: 0 }
              : { duration: 6.8, ease: "easeInOut", repeat: Infinity },
          }}
        >
          {cleaned}
        </motion.span>
      )}
    </motion.h1>
  );
}

function AnimatedCategoryKicker({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const intro = useOncePerTabGate(`category:${text}`);
  const cleaned = useMemo(() => normalizeDisplayText(text.toUpperCase()), [text]);

  const words = useMemo(() => cleaned.split(/\s+/).filter(Boolean), [cleaned]);
  const [stageIndex, setStageIndex] = useState(0);
  const [introDone, setIntroDone] = useState(!intro || reduceMotion);

  const stages = useMemo(() => buildKineticStages(words), [words]);

  useEffect(() => {
    if (!intro || reduceMotion) {
      setStageIndex(stages.length - 1);
      setIntroDone(true);
      return;
    }

    setStageIndex(0);
    setIntroDone(false);

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;

      for (let i = 1; i < stages.length; i++) {
        if (cancelled) return;
        setStageIndex(i);
        await new Promise((r) => setTimeout(r, 50));
      }

      if (!cancelled) setIntroDone(true);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [intro, reduceMotion, stages]);

  const currentStage = stages[stageIndex] || { text: cleaned, newCharIdx: -1 };
  const displayChars = Array.from(currentStage.text);
  const newCharIdx = currentStage.newCharIdx;

  return (
    <motion.span 
      className="inline-flex text-[11px] uppercase tracking-[0.18em] rounded-full px-3 py-1 bg-white/60 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {displayChars.map((ch, idx) => {
        const isSpace = ch === " ";
        const isNew = idx === newCharIdx && !introDone;
        return (
          <motion.span
            key={`cat-${idx}`}
            className={isSpace ? "w-[0.35em]" : "inline-block"}
            animate={{ 
              scale: isNew ? 1.12 : 1,
              y: isNew ? -1 : 0,
            }}
            transition={{
              scale: { type: "spring", stiffness: 600, damping: 28 },
              y: { type: "spring", stiffness: 600, damping: 28 },
            }}
          >
            {isSpace ? "\u00A0" : ch}
          </motion.span>
        );
      })}
    </motion.span>
  );
}

function AnimatedPrice({ usd }: { usd: number }) {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const intro = useOncePerTabGate(`price:${usd}`);

  const { nativeSymbol, convertFromUSD } = usePricing();
  const primary = useMemo(() => convertFromUSD(usd, "NATIVE"), [usd, convertFromUSD]);

  const base = resolvedTheme === "dark" ? "#F8FAFC" : "#0F172A";
  const green = "#22C55E";
  const purple = "#A855F7";

  const primaryText = useMemo(() => {
    if (primary == null) return "";
    return `${formatDecimal(primary, 6)} ${nativeSymbol}`;
  }, [nativeSymbol, primary]);

  const secondaryText = useMemo(() => `(~ ${formatUSD(usd)})`, [usd]);

  const shouldAnimate = !reduceMotion && !!intro && primary != null;
  const [primaryStageIndex, setPrimaryStageIndex] = useState(0);
  const [secondaryStageIndex, setSecondaryStageIndex] = useState(0);
  const [introDone, setIntroDone] = useState(!shouldAnimate);

  // Primary: "0.433 ETH" -> starts as "0 E"
  const primaryStages = useMemo(() => {
    if (!primaryText) return [primaryText];
    // Acronym: first char of number part + first char of symbol part
    const parts = primaryText.split(/\s+/);
    if (parts.length < 2) return buildParallelExpansionStages(primaryText, []);
    return buildParallelExpansionStages(primaryText, [0, 0]);
  }, [primaryText]);

  // Secondary: "(~ $1,299.00)" -> starts as "()"
  const secondaryStages = useMemo(() => {
    if (!secondaryText) return [secondaryText];
    // Acronym: opening and closing parens
    const result: string[] = ["()"];
    // Then reveal character by character
    for (let i = 2; i <= secondaryText.length; i++) {
      result.push(secondaryText.slice(0, i));
    }
    return result;
  }, [secondaryText]);

  useEffect(() => {
    if (!shouldAnimate) {
      setPrimaryStageIndex(primaryStages.length - 1);
      setSecondaryStageIndex(secondaryStages.length - 1);
      setIntroDone(true);
      return;
    }

    setPrimaryStageIndex(0);
    setSecondaryStageIndex(0);
    setIntroDone(false);

    let cancelled = false;
    const run = async () => {
      // Hold primary acronym
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;

      // Advance primary stages
      for (let i = 1; i < primaryStages.length; i++) {
        if (cancelled) return;
        setPrimaryStageIndex(i);
        await new Promise((r) => setTimeout(r, 300));
      }

      // Brief pause before secondary
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;

      // Advance secondary stages
      for (let i = 1; i < secondaryStages.length; i++) {
        if (cancelled) return;
        setSecondaryStageIndex(i);
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!cancelled) setIntroDone(true);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [shouldAnimate, primaryStages, secondaryStages]);

  if (reduceMotion || !intro) {
    return (
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        <PriceAmount usd={usd} />
      </div>
    );
  }

  if (primary == null) {
    return (
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">—</div>
    );
  }

  const pulse = introDone
    ? {
        primary: [base, "#FFFFFF", purple, purple],
        secondary: [base, "#FFFFFF", green, green],
        times: [0, 0.35, 0.75, 1],
        duration: 2.9,
      }
    : null;

  const primaryCurrentStage = primaryStages[primaryStageIndex] || primaryText;
  const primaryPrevStage = primaryStageIndex > 0 ? primaryStages[primaryStageIndex - 1] || "" : "";
  const primaryVisiblePositions = buildVisibilityMap(primaryText, primaryCurrentStage);
  const primaryPrevVisiblePositions = buildVisibilityMap(primaryText, primaryPrevStage);

  const secondaryCurrentStage = secondaryStages[secondaryStageIndex] || secondaryText;
  const secondaryPrevStage = secondaryStageIndex > 0 ? secondaryStages[secondaryStageIndex - 1] || "" : "";
  const secondaryVisiblePositions = buildVisibilityMap(secondaryText, secondaryCurrentStage);
  const secondaryPrevVisiblePositions = buildVisibilityMap(secondaryText, secondaryPrevStage);

  return (
    <motion.div 
      className="text-2xl font-bold whitespace-nowrap"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <span className="inline-flex items-baseline">
        <motion.span
          className="text-slate-900 dark:text-slate-100 inline-flex"
          initial={false}
          animate={pulse ? { color: pulse.primary } : { color: base }}
          transition={
            pulse
              ? {
                  delay: 0.1,
                  duration: pulse.duration,
                  ease: "easeInOut",
                  times: pulse.times,
                }
              : { type: "tween", duration: 0.2 }
          }
        >
          {Array.from(primaryText).map((ch, idx) => {
            const isSpace = ch === " ";
            const isVisible = primaryVisiblePositions.has(idx);
            const isNew = isVisible && !primaryPrevVisiblePositions.has(idx) && !introDone;
            return (
              <motion.span
                key={`pri-${idx}`}
                className={isSpace ? "w-[0.35em]" : "inline-block"}
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: isVisible ? 1 : 0, scale: isNew ? [0.88, 1.1, 1] : 1 }}
                transition={{
                  opacity: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                  scale: isNew
                    ? { duration: 0.35, times: [0, 0.55, 1], ease: [0.34, 1.56, 0.64, 1] }
                    : { duration: 0.2, ease: "easeOut" },
                }}
              >
                {isSpace ? "\u00A0" : ch}
              </motion.span>
            );
          })}
        </motion.span>

        <motion.span
          className="ml-2 text-xs opacity-75 align-middle inline-flex"
          initial={false}
          animate={pulse ? { color: pulse.secondary } : { color: base }}
          transition={
            pulse
              ? {
                  delay: 0.1,
                  duration: pulse.duration,
                  ease: "easeInOut",
                  times: pulse.times,
                }
              : { type: "tween", duration: 0.2 }
          }
        >
          {Array.from(secondaryText).map((ch, idx) => {
            const isSpace = ch === " ";
            const isVisible = secondaryVisiblePositions.has(idx);
            const isNew = isVisible && !secondaryPrevVisiblePositions.has(idx) && !introDone;
            return (
              <motion.span
                key={`sec-${idx}`}
                className={isSpace ? "w-[0.35em]" : "inline-block"}
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: isVisible ? 1 : 0, scale: isNew ? [0.88, 1.1, 1] : 1 }}
                transition={{
                  opacity: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                  scale: isNew
                    ? { duration: 0.35, times: [0, 0.55, 1], ease: [0.34, 1.56, 0.64, 1] }
                    : { duration: 0.2, ease: "easeOut" },
                }}
              >
                {isSpace ? "\u00A0" : ch}
              </motion.span>
            );
          })}
        </motion.span>
      </span>
    </motion.div>
  );
}

function ProductDetails({ product }: { product: Product }) {
  const { data: session } = useSession();
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();

  const [userPostalCode, setUserPostalCode] = useState<string | null>(null);
  const [closestWarehouse, setClosestWarehouse] = useState<WarehouseLocation | null>(null);
  const [hasFetchedLocation, setHasFetchedLocation] = useState(false);
  const [showShippingDetails, setShowShippingDetails] = useState(false);
  const [isLocLoading, setIsLocLoading] = useState(false);
  const [manualPostal, setManualPostal] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);

  // Where can we ship from?
  const warehouseLocations = useMemo(() => {
    if (product.company?.warehouseLocations?.length) {
      return parseWarehouseLocations(product.company.warehouseLocations);
    }
    if (product.shipFromPostalId) {
      // Fallback: treat shipFromPostalId as a single NO warehouse
      return [
        {
          id: product.shipFromPostalId,
          country: "Norway",
          postalCode: product.shipFromPostalId,
          countryCode: "NO",
        },
      ] as WarehouseLocation[];
    }
    return [] as WarehouseLocation[];
  }, [product.company?.warehouseLocations, product.shipFromPostalId]);

  // Specs normalization
  const specs = useMemo(() => {
    const base = { length: 0, width: 0, height: 0, grossWeight: 0 };
    (product.specifications || []).forEach((s) => {
      const v = parseFloat(s.value);
      if (s.key === "Length") base.length = v;
      if (s.key === "Width") base.width = v;
      if (s.key === "Height") base.height = v;
      if (s.key === "Weight") base.grossWeight = v;
    });
    return base;
  }, [product.specifications]);

  // Inventory helpers
  const totalStock = useMemo(
    () => product.inventory.reduce((sum, it) => sum + it.stock, 0),
    [product.inventory]
  );

  const stockAtClosest = useMemo(() => {
    if (!closestWarehouse) return 0;
    const match = product.inventory.find((it) => it.warehouseId === closestWarehouse.id);
    if (match) return match.stock;
    // fallback: max warehouse stock
    return product.inventory.reduce((m, it) => (it.stock > m ? it.stock : m), 0);
  }, [closestWarehouse, product.inventory]);

  // Find closest warehouse from user geolocation
  const resolveClosestWarehouse = useCallback(
    async (userLat: number, userLon: number) => {
      if (!warehouseLocations.length) return null;
      let closest = warehouseLocations[0];
      let min = Number.MAX_VALUE;
      for (const wh of warehouseLocations) {
        try {
          const coords = await fetchCoordsFromPostalCode(wh.postalCode, wh.countryCode || "NO");
          if (coords) {
            const d = haversineDistance(userLat, userLon, coords.latitude, coords.longitude);
            if (d < min) {
              min = d;
              closest = wh;
            }
          }
        } catch {
          // ignore failed lookups
        }
      }
      return closest;
    },
    [warehouseLocations]
  );

  const handleLocate = useCallback(async () => {
		if (!warehouseLocations.length) return false;
		setShowShippingDetails(true);
    setLocationError(null);
    setIsLocLoading(true);
    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
      const postal = await fetchPostalCodeFromCoords(latitude, longitude);
			if (!postal) {
				throw new Error("Could not determine your postal code. Please enter it manually.");
			}
			setUserPostalCode(postal);
      const closest = await resolveClosestWarehouse(latitude, longitude);
      if (closest) setClosestWarehouse(closest);
      setHasFetchedLocation(true);
      return true;
    } catch (e: any) {
			setHasFetchedLocation(false);
			setLocationError(e?.message || "Unable to retrieve your location.");
      return false;
    } finally {
      setIsLocLoading(false);
    }
	}, [warehouseLocations.length, resolveClosestWarehouse]);

  const handleManualPostal = useCallback(async () => {
    if (!manualPostal || !warehouseLocations.length) return;
		setShowShippingDetails(true);
    setLocationError(null);
    setIsLocLoading(true);
    try {
      // assume same country as first warehouse if we don’t know user’s country
      const country = warehouseLocations[0]?.countryCode || "NO";
      const user = await fetchCoordsFromPostalCode(manualPostal, country);
      if (!user) throw new Error("Could not locate that postal code.");
      setUserPostalCode(manualPostal);
      const closest = await resolveClosestWarehouse(user.latitude, user.longitude);
      if (closest) setClosestWarehouse(closest);
      setHasFetchedLocation(true);
    } catch (e: any) {
			setHasFetchedLocation(false);
      setLocationError(e?.message || "Could not use that postal code.");
    } finally {
      setIsLocLoading(false);
    }
  }, [manualPostal, warehouseLocations, resolveClosestWarehouse]);

  // Cart actions
  const handleAddToCart = useCallback(async () => {
    if (!session) {
      alert("You need to be logged in to add items to the cart");
      return;
    }
    const userId = (session as any)?.user?.id;
    try {
      const res = await fetch(`/api/cart/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Failed to add item to cart");
      alert("Item added to cart!");
    } catch {
      alert("Failed to add item to cart");
    }
  }, [session, product.id]);

  return (
    <div className="w-full">
      {/* Top section */}
      <motion.section
        className="grid lg:grid-cols-2 gap-6 lg:gap-10"
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
      >
        {/* Gallery */}
        <motion.div
          className="lg:sticky lg:top-6"
          variants={{
            hidden: { opacity: 0, y: 14, filter: "blur(10px)" },
            show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: "easeOut" } },
          }}
        >
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/40 p-2">
            <Carousel>
              <CarouselContent>
                {product.image.map((src, idx) => (
                  <CarouselItem key={idx} className="bg-transparent">
                    <AspectRatio ratio={1 / 1}>
                      <Image
                        src={src}
                        alt={product.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 680px"
                        priority={idx === 0}
                        className="object-contain rounded-xl"
                      />
                    </AspectRatio>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          className="flex flex-col gap-4"
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
          }}
        >
          {/* category + title */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: {
                opacity: 1,
                y: 0,
                transition: {
                  opacity: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
                  y: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
              },
            }}
          >
            <ProductHeroHeading
              accent="auto"
              accentKey={product.category}
              kicker={
                <AnimatedCategoryKicker text={product.category} />
              }
              title={
                <AnimatedProductTitle
                  text={product.title}
                  mode={prefs.productTitleAnimationMode}
                  rsvpWpm={prefs.rsvpWpm}
                />
              }
              price={<AnimatedPrice usd={product.price} />}
            />
          </motion.div>

          {/* rating */}
          <motion.div
            className="flex flex-wrap items-center justify-between gap-3"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
            }}
          >
            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <CiStar className="h-5 w-5 text-yellow-500" />
              <AnimatedRating />
            </div>
          </motion.div>

          {/* actions */}
          <motion.div
            className="mt-2 flex flex-wrap gap-2"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
            }}
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, x: 18, filter: "blur(10px)" },
                show: {
                  opacity: 1,
                  x: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <Button variant="vegaBuyBtn" className="hover:shadow-md transition-shadow duration-300">
                Buy Now
              </Button>
            </motion.div>
            <motion.div
              variants={{
                hidden: { opacity: 0, x: 18, filter: "blur(10px)" },
                show: {
                  opacity: 1,
                  x: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <Button
                variant="vegaAddBasketBtn"
                className="hover:shadow-md transition-shadow duration-300"
                onClick={handleAddToCart}
              >
                Add to Basket
              </Button>
            </motion.div>
            <motion.div
              variants={{
                hidden: { opacity: 0, x: 18, filter: "blur(10px)" },
                show: {
                  opacity: 1,
                  x: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              <Button variant="vegaAddWishlistBtn" className="hover:shadow-md transition-shadow duration-300">
                Add to Wishlist
              </Button>
            </motion.div>
          </motion.div>

          {/* shipping */}
          <motion.div
            className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                <CiDeliveryTruck className="h-4 w-4" />
                Shipping
              </div>
						<div className="flex items-center gap-2">
							{showShippingDetails ? (
								<>
									<Button
										variant="secondary"
										onClick={handleLocate}
										disabled={isLocLoading || !warehouseLocations.length}
										size="sm"
									>
										{isLocLoading ? "Locating…" : "Retry location"}
									</Button>
									<Button variant="ghost" size="sm" onClick={() => setShowShippingDetails(false)}>
										Hide
									</Button>
								</>
							) : (
								<Button onClick={handleLocate} disabled={isLocLoading || !warehouseLocations.length} size="sm">
									{isLocLoading ? "Locating…" : "Get Shipping Details"}
								</Button>
							)}
						</div>
            </div>

					{showShippingDetails && userPostalCode && (closestWarehouse?.postalCode || product.shipFromPostalId) && (
              <div className="mt-3">
                <BringShippingDetails
								fromPostalCode={closestWarehouse?.postalCode || product.shipFromPostalId}
                  toPostalCode={userPostalCode}
                  productSpecifications={specs}
                />
              </div>
            )}

					{showShippingDetails && warehouseLocations.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-600 dark:text-gray-300">
								Enter a postal code to calculate shipping:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm w-40"
                    placeholder="Postal code"
                    value={manualPostal}
                    onChange={(e) => setManualPostal(e.target.value)}
                    inputMode="numeric"
                  />
                  <Button variant="secondary" size="sm" onClick={handleManualPostal} disabled={isLocLoading}>
                    Use Postal
                  </Button>
                </div>
                {locationError && <div className="text-xs text-red-600">{locationError}</div>}
							{!userPostalCode && !locationError && (
								<div className="text-xs text-gray-600 dark:text-gray-300">
									Tip: click <span className="font-medium">Retry location</span> to auto-detect your postal code.
								</div>
							)}
              </div>
            )}
              </motion.div>

          {/* availability */}
          <motion.div
            className="grid sm:grid-cols-2 gap-3 mt-2"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                <GoPackage className="h-4 w-4" />
                Availability
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {stockAtClosest > 0
                  ? `${stockAtClosest} in stock at closest warehouse`
                  : "Out of stock at closest warehouse"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Overall: {totalStock} in stock
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                <CiMapPin className="h-4 w-4" />
                Shipping from
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {closestWarehouse?.postalCode || product.shipFromPostalId || "—"}
              </div>
            </div>
          </motion.div>

          {/* description */}
          <motion.div
            className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{product.description}</p>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Bottom section */}
      <motion.section
        className="mt-8 rounded-2xl bg-slate-100/60 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-800 p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-3">Specifications</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(product.specifications || []).map((spec, idx) => (
            <div key={idx} className="flex flex-col">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{spec.key}</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {spec.value}
                {spec.key === "Weight" && " g"}
                {["Height", "Length", "Width"].includes(spec.key) && " cm"}
              </dd>
            </div>
          ))}
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Updated</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(product.updatedAt)
              )}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Created</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(product.createdAt)
              )}
            </dd>
          </div>
        </dl>
      </motion.section>
    </div>
  );
}

export default function ProductClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageShellClassName = "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-6";

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch product: ${res.statusText}`);
        const data: Product | null = await res.json();
        if (!stopped) setProduct(data);
      } catch {
        if (!stopped) {
          setError("Product not found");
          setProduct(null);
        }
      }
    })();
    return () => { stopped = true; };
  }, [productId]);

  if (error)
    return (
      <div className={pageShellClassName}>
        <p className="text-red-600">{error}</p>
      </div>
    );

  if (!product)
    return (
      <div className={pageShellClassName}>
        <ProductSkeleton />
      </div>
    );

  return (
    <div className={pageShellClassName}>
      <ProductDetails product={product} />
    </div>
  );
}
