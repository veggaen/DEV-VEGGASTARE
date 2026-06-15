"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { BringShippingDetails } from "@/components/uicustom/product/bringShipping-details";
import { fetchPostalCodeFromCoords } from "@/components/uicustom/product/postal-code-from-coords";
import { fetchCoordsFromPostalCode } from "@/components/uicustom/product/postal-cords-from-code";
import { PostalCodeAutocomplete } from "@/components/uicustom/postal-code-autocomplete";
import { cn, getCountryCode, haversineDistance } from "@/lib/utils";
import ProductSkeleton from "@/components/uicustom/skeletons/product-skeleton";
import PriceAmount from "@/components/crypto-related/PriceAmount";
import { usePricing } from "@/components/crypto-related/PricingContext";
import { useTheme } from "next-themes";
import { useUiPreferences } from "@/components/providers/ui-preferences";
import ProductHeroHeading from "@/components/uicustom/product/product-hero-heading";
import { fetchUserEmployeePermissions } from "@/actions/user-company-permissions";
import { MyDeleteProductAction } from "@/actions/products";
import type { EmployeePermissions } from "@/lib/types/company-permissions";
import { Pencil, Trash2, Loader2, Navigation, Flag } from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "@/components/uicustom/report/ReportDialog";

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
      const timeoutId = window.setTimeout(() => setPlay(false), 0);
      return () => window.clearTimeout(timeoutId);
    }

    // In dev, components can mount twice (React StrictMode). If we write to
    // sessionStorage immediately, the *second* mount will think it already played
    // and you'll see no intro at all. To avoid that, we delay the write slightly
    // and cancel it on unmount.
    // Also allow forcing intros for testing via ?intro=1
    try {
      const force = new URLSearchParams(window.location.search).get("intro") === "1";
      if (force) {
        const timeoutId = window.setTimeout(() => setPlay(true), 0);
        return () => window.clearTimeout(timeoutId);
      }

      const k = `vega:intro:${key}`;
      const now = Date.now();
      const lastRaw = window.sessionStorage.getItem(k);
      const last = lastRaw ? Number(lastRaw) : 0;

      if (Number.isFinite(last) && last > 0 && now - last < 1200) {
        const timeoutId = window.setTimeout(() => setPlay(false), 0);
        return () => window.clearTimeout(timeoutId);
      }

      const playTimeoutId = window.setTimeout(() => setPlay(true), 0);

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
        window.clearTimeout(playTimeoutId);
        window.clearTimeout(t);
      };
    } catch {
      // If storage is blocked, just play once for this mount.
      const timeoutId = window.setTimeout(() => setPlay(true), 0);
      return () => window.clearTimeout(timeoutId);
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
      const timeoutId = window.setTimeout(() => setPlay(false), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const type = getNavigationType();
    // User asked explicitly for Ctrl+R (reload). Don't replay on client-side navigation.
    if (type !== "reload") {
      const timeoutId = window.setTimeout(() => setPlay(false), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(() => setPlay(true), 0);
    return () => window.clearTimeout(timeoutId);
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
      const timeoutId = window.setTimeout(() => {
        setPhase("done");
        setIdx(cleaned.length);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;
    let t1: number | undefined;
    let t2: number | undefined;
    let interval: number | undefined;

    const startTimeoutId = window.setTimeout(() => {
      setPhase("acronym");
      setIdx(0);
    }, 0);

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
      window.clearTimeout(startTimeoutId);
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
      className="text-sm"
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
interface Feature { text: string; key?: string; icon?: string; }
interface WarehouseLocation { id: string; country: string; postalCode: string; countryCode?: string; }
interface Inventory { id: string; stock: number; warehouseId: string; }

interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number; // stored in USD
  priceCurrency: string;
  acceptedFiatCurrencies: string[];
  condition: string;
  image: string[];
  specifications: Specification[] | null;
  features: Feature[] | null;
  userId: string;
  companyId: string | null;
  acceptedTokens: Array<{
    family: "EVM" | "SOLANA";
    symbol: string;
    decimals: number;
    tokenAddress: string | null;
    tokenMint: string | null;
  }>;
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
// Exact sequence for "Advanced Network Security Package":
// 'A' -> 'A N' -> 'A N S' -> 'A N S P' -> 'AD N S P' -> 'AD NE S P' -> ...
// New characters are UPPERCASE, previous chars stay as-is until they become lowercase
function buildKineticStages(words: string[]): Array<{ text: string; newCharIdx: number; isUppercase: boolean[] }> {
  if (words.length === 0) return [{ text: "", newCharIdx: -1, isUppercase: [] }];

  const stages: Array<{ text: string; newCharIdx: number; isUppercase: boolean[] }> = [];

  // Phase 1: Build spaced acronym directly (all uppercase)
  // 'A' -> 'A N' -> 'A N S' -> 'A N S P'
  for (let i = 0; i < words.length; i++) {
    const acronymParts = words.slice(0, i + 1).map((w) => w[0].toUpperCase());
    const text = acronymParts.join(" ");
    // Track which chars are uppercase (all of them in phase 1, spaces excluded from tracking)
    const isUppercase: boolean[] = [];
    for (const ch of text) {
      if (ch !== " ") isUppercase.push(true);
    }
    // newCharIdx is the position of the last letter (accounting for spaces)
    const newCharIdx = i === 0 ? 0 : text.length - 1;
    stages.push({ text, newCharIdx, isUppercase });
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
        // - Previous chars in THIS word that came before: first char upper, rest lower
        // - New char: UPPERCASE
        // - Other words: keep their current state
        const displayParts: string[] = [];
        const isUppercase: boolean[] = [];
        let globalNewCharIdx = -1;
        let charCount = 0;
        let nonSpaceCount = 0;

        for (let wi = 0; wi < words.length; wi++) {
          const w = words[wi];
          const len = wordLengths[wi];
          let part = "";

          for (let ci = 0; ci < len; ci++) {
            const isNewChar = wi === wordIdx && ci === len - 1;
            if (isNewChar) {
              globalNewCharIdx = charCount;
              part += w[ci].toUpperCase();
              isUppercase.push(true);
            } else {
              // Proper case: first char upper, rest lower
              part += ci === 0 ? w[ci].toUpperCase() : w[ci].toLowerCase();
              isUppercase.push(ci === 0); // only first char is uppercase
            }
            charCount++;
            nonSpaceCount++;
          }

          displayParts.push(part);
          charCount++; // for space
        }

        stages.push({ text: displayParts.join(" "), newCharIdx: globalNewCharIdx, isUppercase });
      }
    }

    if (!anyIncomplete) break;
  }

  // Phase 3: Final stage - fully normalized proper case (no uppercase emphasis)
  const finalText = words
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const finalIsUppercase: boolean[] = [];
  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      finalIsUppercase.push(i === 0);
    }
  }
  const lastStage = stages[stages.length - 1];
  if (!lastStage || lastStage.text !== finalText) {
    stages.push({ text: finalText, newCharIdx: -1, isUppercase: finalIsUppercase });
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

// New stage structure: track revealed characters per word
interface KineticStage {
  // How many characters revealed per word [1, 1, 1, 1] -> [2, 1, 1, 1] -> ...
  revealed: number[];
  // Which word just got a new character (-1 if none)
  activeWordIdx: number;
  // Which character position in that word is new (-1 if none)
  activeCharIdx: number;
}

// Build stages for fixed-position animation
// Each word stays in place, characters fill in from left to right
function buildFixedPositionStages(words: string[]): KineticStage[] {
  if (words.length === 0) return [{ revealed: [], activeWordIdx: -1, activeCharIdx: -1 }];

  const stages: KineticStage[] = [];

  // Phase 1: Build acronym - reveal first letter of each word one by one
  // Stage 0: just first letter of first word
  // Stage 1: first letter of words 0 and 1
  // ...
  for (let i = 0; i < words.length; i++) {
    const revealed = words.map((_, idx) => (idx <= i ? 1 : 0));
    stages.push({
      revealed,
      activeWordIdx: i,
      activeCharIdx: 0,
    });
  }

  // Phase 2: Cycling expansion - add one char to each word in rotation
  const revealed = words.map(() => 1); // Start with acronym

  let safetyCounter = 0;
  const maxIterations = words.length * Math.max(...words.map((w) => w.length)) + 10;

  while (safetyCounter++ < maxIterations) {
    let anyIncomplete = false;

    for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
      const word = words[wordIdx];
      if (revealed[wordIdx] < word.length) {
        anyIncomplete = true;
        revealed[wordIdx]++;

        stages.push({
          revealed: [...revealed],
          activeWordIdx: wordIdx,
          activeCharIdx: revealed[wordIdx] - 1,
        });
      }
    }

    if (!anyIncomplete) break;
  }

  // Final stage - all revealed, no active char
  stages.push({
    revealed: words.map((w) => w.length),
    activeWordIdx: -1,
    activeCharIdx: -1,
  });

  return stages;
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

  const [stageIndex, setStageIndex] = useState(0);
  const [introDone, setIntroDone] = useState(!shouldAnimate);
  
  // Hover state: track which letter is hovered and its position
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<{ wordIdx: number; charIdx: number } | null>(null);

  // Build fixed-position stages
  const stages = useMemo(() => buildFixedPositionStages(words), [words]);

  useEffect(() => {
    if (!shouldAnimate) {
      const timeoutId = window.setTimeout(() => {
        setStageIndex(stages.length - 1);
        setIntroDone(true);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const initTimeoutId = window.setTimeout(() => {
      setStageIndex(0);
      setIntroDone(false);
    }, 0);

    let cancelled = false;
    const run = async () => {
      // Ease-out speed curve: starts fast, slows toward end for polish
      const totalStages = stages.length;
      const baseDelay = 120; // Base delay
      
      for (let i = 1; i < totalStages; i++) {
        if (cancelled) return;
        setStageIndex(i);
        
        // Ease-out curve: fast start, gentle slowdown at end
        const progress = i / totalStages;
        const easeOut = 1 - Math.pow(1 - progress, 2); // quadratic ease-out
        const delay = Math.round(baseDelay * (0.4 + easeOut * 0.6));
        
        await new Promise((r) => setTimeout(r, delay));
      }

      // Brief settle at the end
      await new Promise((r) => setTimeout(r, 150));
      if (!cancelled) setIntroDone(true);
    };
    run();

    return () => {
      cancelled = true;
      window.clearTimeout(initTimeoutId);
    };
  }, [shouldAnimate, stages, words.length]);

  // Build a flat list of character positions for neighbor detection
  const charPositions = useMemo(() => {
    const positions: Array<{ wordIdx: number; charIdx: number; char: string }> = [];
    words.forEach((word, wordIdx) => {
      Array.from(word).forEach((char, charIdx) => {
        positions.push({ wordIdx, charIdx, char: char.toLowerCase() });
      });
    });
    return positions;
  }, [words]);

  // Check if a position is a neighbor of hovered position
  const getHoverEffect = useCallback((wordIdx: number, charIdx: number, char: string): { scale: number; glow: boolean; intensity: number } => {
    if (!introDone || !hoveredChar) return { scale: 1, glow: false, intensity: 0 };

    const lowerChar = char.toLowerCase();
    const isMatchingChar = lowerChar === hoveredChar.toLowerCase();
    
    // Find flat index of current position
    let currentFlatIdx = 0;
    for (let wi = 0; wi < wordIdx; wi++) {
      currentFlatIdx += words[wi].length;
    }
    currentFlatIdx += charIdx;

    // Find flat index of hovered position
    let hoveredFlatIdx = -1;
    if (hoveredPosition) {
      hoveredFlatIdx = 0;
      for (let wi = 0; wi < hoveredPosition.wordIdx; wi++) {
        hoveredFlatIdx += words[wi].length;
      }
      hoveredFlatIdx += hoveredPosition.charIdx;
    }

    // Check if this is a neighbor (within 1 position)
    const distance = hoveredFlatIdx >= 0 ? Math.abs(currentFlatIdx - hoveredFlatIdx) : Infinity;
    const isDirectNeighbor = distance === 1;
    const isHoveredPosition = distance === 0;

    if (isHoveredPosition) {
      // The directly hovered character - full effect
      return { scale: 1.25, glow: true, intensity: 1 };
    } else if (isDirectNeighbor) {
      // Immediate neighbors - 40% effect
      return { scale: 1.1, glow: true, intensity: 0.4 };
    } else if (isMatchingChar) {
      // All matching letters - 70% effect
      return { scale: 1.18, glow: true, intensity: 0.7 };
    }

    return { scale: 1, glow: false, intensity: 0 };
  }, [introDone, hoveredChar, hoveredPosition, words]);

  if (reduceMotion || mode === "off") {
    return (
      <h1 className="text-balance text-2xl md:text-3xl font-semibold leading-tight tracking-tight text-foreground drop-shadow-sm">
        {cleaned}
      </h1>
    );
  }

  const currentStage = stages[stageIndex] || { revealed: words.map((w) => w.length), activeWordIdx: -1, activeCharIdx: -1 };
  const { revealed, activeWordIdx, activeCharIdx } = currentStage;

  return (
    <motion.h1
      className="text-balance text-2xl md:text-3xl font-semibold leading-tight tracking-tight text-foreground drop-shadow-sm"
      aria-label={cleaned}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onPointerLeave={() => {
        setHoveredChar(null);
        setHoveredPosition(null);
      }}
    >
      {/* Each word gets a fixed-width container, characters are absolutely positioned inside */}
      <span className="inline-flex flex-wrap gap-[0.35em]">
        {words.map((word, wordIdx) => {
          const revealedCount = revealed[wordIdx] || 0;
          
          return (
            <span
              key={`word-${wordIdx}`}
              className="relative inline-block"
            >
              {/* Invisible placeholder for fixed width - title case */}
              <span className="invisible" aria-hidden="true">
                {word[0].toUpperCase() + word.slice(1).toLowerCase()}
              </span>
              
              {/* Actual animated characters - absolutely positioned over placeholder */}
              <span className="absolute inset-0 inline-flex">
                {Array.from(word).map((char, charIdx) => {
                  const isRevealed = charIdx < revealedCount;
                  const isNew = wordIdx === activeWordIdx && charIdx === activeCharIdx && !introDone;
                  const isFirstChar = charIdx === 0;

                  // Title case: first letter uppercase, rest lowercase
                  const displayChar = isFirstChar ? char.toUpperCase() : char.toLowerCase();

                  // Get hover effect for this character
                  const hoverEffect = getHoverEffect(wordIdx, charIdx, char);

                  // Color cycle based on character position for variety
                  const charPosition = wordIdx * 10 + charIdx;
                  const hue = (charPosition * 40) % 360;
                  const glowColor = `hsl(${hue}, 80%, 65%)`;

                  // Combine intro animation with hover effects
                  const isAnimatingIn = isNew;
                  const hasHoverEffect = hoverEffect.intensity > 0;
                  
                  // Scale: intro pop, hover effect, or normal
                  const scale = isAnimatingIn ? 1.35 : hoverEffect.scale;
                  const yOffset = isAnimatingIn ? -3 : (hasHoverEffect ? -2 * hoverEffect.intensity : 0);

                  // Glow: intro glow or hover glow
                  const showGlow = isAnimatingIn || hoverEffect.glow;
                  const glowIntensity = isAnimatingIn ? 1 : hoverEffect.intensity;

                  return (
                    <span
                      key={`char-${wordIdx}-${charIdx}`}
                      className="inline-block origin-bottom cursor-default"
                      style={{
                        opacity: isRevealed ? 1 : 0,
                        transform: `scale(${scale}) translateY(${yOffset}px)`,
                        color: showGlow ? glowColor : undefined,
                        textShadow: showGlow 
                          ? `0 0 ${12 * glowIntensity}px ${glowColor}, 0 0 ${24 * glowIntensity}px ${glowColor}, 0 2px 4px rgba(0,0,0,${0.3 * glowIntensity})` 
                          : "none",
                        transition: "opacity 0.2s ease-out, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.25s ease-out, text-shadow 0.25s ease-out",
                      }}
                      onPointerEnter={() => {
                        if (introDone) {
                          setHoveredChar(char);
                          setHoveredPosition({ wordIdx, charIdx });
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
      const timeoutId = window.setTimeout(() => {
        setStageIndex(stages.length - 1);
        setIntroDone(true);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const initTimeoutId = window.setTimeout(() => {
      setStageIndex(0);
      setIntroDone(false);
    }, 0);

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
      window.clearTimeout(initTimeoutId);
    };
  }, [intro, reduceMotion, stages]);

  const currentStage = stages[stageIndex] || { text: cleaned, newCharIdx: -1, isUppercase: [] };
  const displayChars = Array.from(currentStage.text);
  const newCharIdx = currentStage.newCharIdx;

  return (
    <motion.span 
      className="inline-flex text-[11px] uppercase tracking-[0.18em] rounded-full px-3 py-1 bg-white/60 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 border border-black/10 dark:border-white/10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {displayChars.map((ch, idx) => {
        const isSpace = ch === " ";
        const isNew = idx === newCharIdx && !introDone;
        return (
          <span
            key={`cat-${idx}`}
            className={isSpace ? "w-[0.35em]" : "inline-block origin-bottom"}
            style={{
              transform: isNew ? "scale(1.12) translateY(-1px)" : "scale(1) translateY(0)",
              transition: "transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          >
            {isSpace ? "\u00A0" : ch}
          </span>
        );
      })}
    </motion.span>
  );
}

function AnimatedPrice({ amount, currency = 'USD', acceptsWeb3 = false }: { amount: number; currency?: string; acceptsWeb3?: boolean }) {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const intro = useOncePerTabGate(`price:${amount}:${currency}`);

  const { nativeSymbol, convertFromUSD } = usePricing();
  
  // Convert from original currency to USD first
  const FIAT_TO_USD: Record<string, number> = { USD: 1, NOK: 0.091, EUR: 1.08, GBP: 1.27 };
  const usdValue = amount * (FIAT_TO_USD[currency] ?? 1);
  
  const primary = useMemo(() => convertFromUSD(usdValue, "NATIVE"), [usdValue, convertFromUSD]);

  const base = resolvedTheme === "dark" ? "#F8FAFC" : "#0F172A";
  const green = "#22C55E";
  const purple = "#A855F7";

  const primaryText = useMemo(() => {
    if (primary == null) return "";
    return `${formatDecimal(primary, 6)} ${nativeSymbol}`;
  }, [nativeSymbol, primary]);

  const secondaryText = useMemo(() => {
    // Show original currency if not USD
    if (currency !== 'USD') {
      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
      return `(${formatted} ≈ ${formatUSD(usdValue)})`;
    }
    return `(~ ${formatUSD(usdValue)})`;
  }, [amount, currency, usdValue]);

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
      const timeoutId = window.setTimeout(() => {
        setPrimaryStageIndex(primaryStages.length - 1);
        setSecondaryStageIndex(secondaryStages.length - 1);
        setIntroDone(true);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const initTimeoutId = window.setTimeout(() => {
      setPrimaryStageIndex(0);
      setSecondaryStageIndex(0);
      setIntroDone(false);
    }, 0);

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
      window.clearTimeout(initTimeoutId);
    };
  }, [shouldAnimate, primaryStages, secondaryStages]);

  if (reduceMotion || !intro) {
    return (
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        <PriceAmount 
          amount={amount} 
          currency={currency}
          acceptsWeb3={acceptsWeb3}
        />
      </div>
    );
  }

  if (primary == null) {
    return (
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">—</div>
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
          className="text-zinc-900 dark:text-zinc-100 inline-flex"
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
  const router = useRouter();
  const { data: session } = useSession();
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();

  const [companyEditAllowed, setCompanyEditAllowed] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const sessionUserId = (session as any)?.user?.id as string | undefined;
  const sessionRole = (session as any)?.user?.role as string | undefined;
  const isAdminLike = sessionRole === "ADMIN" || sessionRole === "OWNER";

  const canEditProduct = useMemo(() => {
    if (!sessionUserId) return false;
    if (isAdminLike) return true;
    if (product.userId === sessionUserId) return true;
    if (product.companyId && companyEditAllowed) return true;
    return false;
  }, [companyEditAllowed, isAdminLike, product.companyId, product.userId, sessionUserId]);

  const handleDeleteProduct = useCallback(async () => {
    setIsDeleting(true);
    try {
      const result = await MyDeleteProductAction(product.id);
      if (result.error) {
        toast.error(result.error);
        setIsDeleting(false);
        return;
      }
      toast.success(result.success || "Product deleted successfully");
      setDeleteDialogOpen(false);
      // Redirect to products page
      router.push("/products");
    } catch (err) {
      toast.error("Failed to delete product");
      setIsDeleting(false);
    }
  }, [product.id, router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!sessionUserId) return;
        if (!product.companyId) return;
        // Ask server for employee permissions
        const res = await fetchUserEmployeePermissions({ id: sessionUserId }, product.companyId);
        if (!alive) return;
        if (!res.success) {
          setCompanyEditAllowed(false);
          return;
        }
        const perms = (res.permissions ?? {}) as EmployeePermissions;
        setCompanyEditAllowed(perms?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true);
      } catch {
        if (!alive) return;
        setCompanyEditAllowed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [product.companyId, sessionUserId]);

  const [userPostalCode, setUserPostalCode] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [closestWarehouse, setClosestWarehouse] = useState<WarehouseLocation | null>(null);
  const [hasFetchedLocation, setHasFetchedLocation] = useState(false);
  const [showShippingDetails, setShowShippingDetails] = useState(false);
  const [isLocLoading, setIsLocLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

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

  // Specs normalization - use sensible defaults for shipping calculation
  const specs = useMemo(() => {
    // Default package: 20x15x10cm, 500g (reasonable small parcel)
    const base = { length: 20, width: 15, height: 10, grossWeight: 500 };
    (product.specifications || []).forEach((s) => {
      const v = parseFloat(s.value);
      if (!isNaN(v) && v > 0) {
        if (s.key === "Length") base.length = v;
        if (s.key === "Width") base.width = v;
        if (s.key === "Height") base.height = v;
        if (s.key === "Weight") base.grossWeight = v;
      }
    });
    return base;
  }, [product.specifications]);

  // Inventory helpers
  const totalStock = useMemo(() => {
    const inventory = product.inventory ?? [];
    return inventory.reduce((sum, it) => sum + it.stock, 0);
  }, [product.inventory]);

  const stockAtClosest = useMemo(() => {
    if (!closestWarehouse) return 0;
    const inventory = product.inventory ?? [];
    const match = inventory.find((it) => it.warehouseId === closestWarehouse.id);
    if (match) return match.stock;
    // fallback: max warehouse stock
    return inventory.reduce((m, it) => (it.stock > m ? it.stock : m), 0);
  }, [closestWarehouse, product.inventory]);

  // State for user's distance to closest warehouse
  const [userDistanceToWarehouseKm, setUserDistanceToWarehouseKm] = useState<number | undefined>(undefined);

  // Find closest warehouse from user geolocation
  const resolveClosestWarehouse = useCallback(
    async (userLat: number, userLon: number): Promise<{ warehouse: WarehouseLocation; distanceKm: number } | null> => {
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
      return { warehouse: closest, distanceKm: min === Number.MAX_VALUE ? 999 : min };
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
      
      // Try to fetch city from postal code
      try {
        const res = await fetch(`/api/bring-shipping-suggest-postcode?postalCode=${postal}&countryCode=no`);
        const data = await res.json();
        const match = data?.postal_codes?.find((p: any) => p.postal_code === postal);
        if (match?.city) {
          setUserCity(match.city);
        }
      } catch {
        // Ignore city lookup errors
      }
      
      const result = await resolveClosestWarehouse(latitude, longitude);
      if (result) {
        setClosestWarehouse(result.warehouse);
        setUserDistanceToWarehouseKm(result.distanceKm);
      }
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

  // Cart actions
  const handleAddToCart = useCallback(async () => {
    if (!session) {
      toast.error('Sign in to add items to your basket', {
        action: { label: 'Sign in', onClick: () => router.push('/auth') },
      });
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
      toast.success('Added to basket', {
        description: product.title,
        action: { label: 'View basket', onClick: () => router.push('/cart') },
        duration: 4000,
      });
    } catch {
      toast.error('Failed to add item to basket');
    }
  }, [session, product.id, product.title, router]);

  // Buy Now - add to cart then go straight to checkout
  const handleBuyNow = useCallback(async () => {
    if (!session) {
      toast.error('Sign in to purchase items', {
        action: { label: 'Sign in', onClick: () => router.push('/auth') },
      });
      return;
    }
    const userId = (session as any)?.user?.id;
    try {
      const res = await fetch(`/api/cart/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      router.push('/checkout');
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }, [session, product.id, router]);

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
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-2">
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
              kicker={product.category}
              title={product.title}
              price={
                <PriceAmount 
                  amount={product.price} 
                  currency={product.priceCurrency || 'USD'}
                  acceptsWeb3={Array.isArray(product.acceptedTokens) && product.acceptedTokens.length > 0}
                  acceptedCryptos={product.acceptedTokens?.map((t: any) => t.symbol)}
                />
              }
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

            {/* Report button — visible to logged-in non-owners */}
            {sessionUserId && !canEditProduct && (
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-red-600" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4" />
                Rapporter
              </Button>
            )}

            {canEditProduct && (
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href={`/products/edit/${product.id}`}>
                    <Pencil className="h-4 w-4" />
                    Edit listing
                  </Link>
                </Button>
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Product</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete &quot;{product.title}&quot;? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button 
                        variant="outline" 
                        onClick={() => setDeleteDialogOpen(false)}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteProduct}
                        disabled={isDeleting}
                        className="gap-2"
                      >
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isDeleting ? "Deleting..." : "Delete Product"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
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
              <Button variant="vegaBuyBtn" className="hover:shadow-md transition-shadow duration-300" onClick={handleBuyNow}>
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

          {/* Accepted Payment Methods */}
          <motion.div
            className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: 0.3, delay: 0.1 } },
            }}
          >
            <span className="font-medium text-zinc-600 dark:text-zinc-300">Accepts:</span>

            {/* Crypto chains from product's acceptedTokens */}
            {Array.isArray(product.acceptedTokens) && product.acceptedTokens.length > 0 && (
              <>
                {[...new Set(product.acceptedTokens.map((t: any) => t.family as string))].map((family) => (
                  <span
                    key={family}
                    className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-purple-400"
                  >
                    {family === "EVM" ? "⟠" : "◎"} {family === "EVM" ? "Ethereum" : "Solana"}
                  </span>
                ))}
              </>
            )}

            {/* Fiat methods — always available on the platform */}
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-blue-400">
              PayPal
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-orange-400">
              Vipps
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-pink-400">
              Klarna
            </span>
          </motion.div>

          {/* shipping - Only show for logged-in users */}
          {session ? (
          <motion.div
            className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 overflow-hidden"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-500/30 flex items-center justify-center">
                  <CiDeliveryTruck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Shipping Estimate</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {userPostalCode 
                      ? `Delivering to ${userPostalCode}${userCity ? ` ${userCity}` : ''}`
                      : 'Get shipping costs instantly'}
                  </div>
                </div>
              </div>
              {showShippingDetails && userPostalCode && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowShippingDetails(false);
                    setUserPostalCode(null);
                    setUserCity(null);
                    setShowManualInput(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Change
                </Button>
              )}
            </div>

            {/* Location Input - Prominent Auto-Detect Design */}
            <div className="p-4 bg-gray-50 dark:bg-white/[0.02]">
              {warehouseLocations.length > 0 ? (
                <>
                  {/* Show detected location or input options */}
                  {!userPostalCode ? (
                    <div className="space-y-4">
                      {/* Primary: Big Auto-Detect Button */}
                      <motion.button
                        type="button"
                        onClick={handleLocate}
                        disabled={isLocLoading}
                        className={cn(
                          "w-full py-4 px-4 rounded-xl",
                          "bg-linear-to-br from-emerald-500 to-teal-600",
                          "hover:from-emerald-400 hover:to-teal-500",
                          "text-white font-medium",
                          "flex items-center justify-center gap-3",
                          "transition-all duration-200",
                          "shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30",
                          isLocLoading && "opacity-70 cursor-wait"
                        )}
                        whileHover={!isLocLoading ? { scale: 1.01 } : {}}
                        whileTap={!isLocLoading ? { scale: 0.99 } : {}}
                      >
                        {isLocLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Finding your location...</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="h-5 w-5" />
                            <span>Use My Location</span>
                          </>
                        )}
                      </motion.button>

                      {/* Secondary: Manual entry toggle */}
                      {!showManualInput ? (
                        <button
                          type="button"
                          onClick={() => setShowManualInput(true)}
                          className="w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-2"
                        >
                          Or enter postal code manually
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <PostalCodeAutocomplete
                            value=""
                            onChange={(postal, city) => {
                              if (postal.length >= 4) {
                                setUserPostalCode(postal);
                                if (city) setUserCity(city);
                                setShowShippingDetails(true);
                              }
                            }}
                            onSelect={async (suggestion) => {
                              setUserPostalCode(suggestion.postal_code);
                              setUserCity(suggestion.city || null);
                              setShowShippingDetails(true);
                              setLocationError(null);
                              
                              if (suggestion.latitude && suggestion.longitude) {
                                const lat = parseFloat(suggestion.latitude);
                                const lon = parseFloat(suggestion.longitude);
                                if (!isNaN(lat) && !isNaN(lon)) {
                                  const result = await resolveClosestWarehouse(lat, lon);
                                  if (result) {
                                    setClosestWarehouse(result.warehouse);
                                    setUserDistanceToWarehouseKm(result.distanceKm);
                                  }
                                }
                              }
                              setHasFetchedLocation(true);
                            }}
                            isLocating={isLocLoading}
                            placeholder="Type postal code (e.g. 4310)"
                            countryCode={warehouseLocations[0]?.countryCode?.toLowerCase() || "no"}
                            disabled={isLocLoading}
                            showLocateButton={false}
                          />
                          <button
                            type="button"
                            onClick={() => setShowManualInput(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            ← Back to auto-detect
                          </button>
                        </div>
                      )}

                      {locationError && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-1.5">
                          <CiMapPin className="h-3 w-3" />
                          {locationError}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Location detected - show confirmation */
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CiMapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {userPostalCode} {userCity}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          ✓ Location confirmed
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  Shipping not available for this product
                </p>
              )}
            </div>

            {/* Shipping Results - Only show for logged-in users */}
            <AnimatePresence mode="wait">
              {session && showShippingDetails && userPostalCode && (closestWarehouse?.postalCode || product.shipFromPostalId) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-gray-100 dark:border-white/5"
                >
                  <div className="p-4 bg-white dark:bg-transparent">
                    <BringShippingDetails
                      fromPostalCode={closestWarehouse?.postalCode || product.shipFromPostalId}
                      toPostalCode={userPostalCode}
                      productSpecifications={specs}
                      warehouse={closestWarehouse ? {
                        postalCode: closestWarehouse.postalCode,
                        city: userCity || undefined,
                        distanceKm: userDistanceToWarehouseKm,
                      } : undefined}
                      userDistanceKm={userDistanceToWarehouseKm}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          ) : (
            /* Guest users - show login prompt */
            <motion.div
              className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 overflow-hidden"
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
              }}
            >
              <div className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-linear-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center">
                  <CiDeliveryTruck className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Shipping Estimate</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <Link href="/auth/login" className="text-emerald-600 dark:text-emerald-400 hover:underline">Sign in</Link>
                    {" "}to see shipping costs
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* availability */}
          <motion.div
            className="grid sm:grid-cols-2 gap-3 mt-2"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-transparent p-4">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
                <GoPackage className="h-4 w-4" />
                Availability
              </div>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {totalStock > 0 ? (
                  closestWarehouse ? (
                    stockAtClosest > 0 
                      ? `${stockAtClosest} in stock nearby`
                      : "Check other locations"
                  ) : (
                    `${totalStock} in stock`
                  )
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Out of stock</span>
                )}
              </div>
              {totalStock > 0 && closestWarehouse && stockAtClosest !== totalStock && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Total: {totalStock} across all locations
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-transparent p-4">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
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
            className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-transparent p-4"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{product.description}</p>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features section */}
      {product.features && product.features.length > 0 && (
        <motion.section
          className="mt-8 rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 p-6"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">Features</h3>
          
          {/* Group features by category key */}
          {(() => {
            const grouped = new Map<string, Feature[]>();
            for (const f of product.features!) {
              const cat = f.key?.trim() || '';
              if (!grouped.has(cat)) grouped.set(cat, []);
              grouped.get(cat)!.push(f);
            }
            
            return Array.from(grouped.entries()).map(([category, items], groupIdx) => (
              <div key={groupIdx} className={groupIdx > 0 ? 'mt-4' : ''}>
                {category && (
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    {category}
                  </h4>
                )}
                <ul className="space-y-2">
                  {items.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ));
          })()}
        </motion.section>
      )}

      {/* Bottom section */}
      <motion.section
        className="mt-8 rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">Specifications</h3>
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

      {/* Report Dialog */}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        contentType="PRODUCT"
        contentId={product.id}
        contentLabel="dette produktet"
      />
    </div>
  );
}

export default function ProductClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pageShellClassName = "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-6";

  useEffect(() => {
    let stopped = false;
    setIsLoading(true);
    setError(null);
    
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}`, { cache: "no-store" });
        if (stopped) return;
        
        if (res.status === 404) {
          setError("not-found");
          setProduct(null);
          return;
        }
        
        if (!res.ok) {
          setError("fetch-error");
          setProduct(null);
          return;
        }
        
        const data: Product | null = await res.json();
        if (!stopped) setProduct(data);
      } catch {
        if (!stopped) {
          setError("network-error");
          setProduct(null);
        }
      } finally {
        if (!stopped) setIsLoading(false);
      }
    })();
    return () => { stopped = true; };
  }, [productId]);

  if (error === "not-found")
    return (
      <div className={pageShellClassName}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Product Not Found</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            This product may have been removed or the link is invalid.
          </p>
          <Link
            href="/products"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );

  if (error)
    return (
      <div className={pageShellClassName}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            We couldn&apos;t load this product. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Retry
          </button>
        </div>
      </div>
    );

  if (isLoading || !product)
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
