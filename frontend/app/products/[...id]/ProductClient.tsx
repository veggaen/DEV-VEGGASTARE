"use client";

import { type ReactNode, useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
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
import { fetchUserEmployeePermissions } from "@/actions/user-company-permissions";
import { MyDeleteProductAction, MySetProductVisibilityAction } from "@/actions/products";
import type { EmployeePermissions } from "@/lib/types/company-permissions";
import { Archive, ArrowLeft, CreditCard, Eye, EyeOff, Pencil, Share2, ShieldCheck, ShoppingCart, Trash2, Loader2, Navigation, Flag, WalletCards } from "lucide-react";
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
type ProductVisibility = "PUBLIC" | "HIDDEN" | "ARCHIVED";

interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number; // stored in USD
  priceCurrency: string;
  acceptedFiatCurrencies: string[];
  stock: number;
  productType: "PHYSICAL" | "DIGITAL" | "HYBRID";
  visibility: ProductVisibility;
  hiddenAt?: string | null;
  archivedAt?: string | null;
  downloadsEnabled: boolean;
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

function getAcceptedTokenSymbols(product: Product) {
  return Array.from(
    new Set((product.acceptedTokens ?? []).map((token) => token.symbol).filter(Boolean))
  );
}

function getAcceptedFiatCurrencies(product: Product) {
  const currencies = product.acceptedFiatCurrencies?.length
    ? product.acceptedFiatCurrencies
    : [product.priceCurrency || "USD"];
  return Array.from(new Set(currencies.filter(Boolean)));
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

const premiumEase = [0.25, 1, 0.5, 1] as const;

function ProductDetailCursor() {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(-80);
  const y = useMotionValue(-80);
  const springX = useSpring(x, { stiffness: 160, damping: 24, mass: 0.45 });
  const springY = useSpring(y, { stiffness: 160, damping: 24, mass: 0.45 });

  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (event: PointerEvent) => {
      x.set(event.clientX - 18);
      y.set(event.clientY - 18);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduceMotion, x, y]);

  if (reduceMotion) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 hidden h-9 w-9 rounded-full border border-emerald-300/35 bg-emerald-300/10 shadow-[0_0_34px_rgba(16,185,129,0.28)] backdrop-blur-md lg:block"
      style={{ x: springX, y: springY }}
    />
  );
}

function ProductDetails({ product }: { product: Product }) {
  const router = useRouter();
  const { data: session } = useSession();
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();

  const [companyEditAllowed, setCompanyEditAllowed] = useState(false);
  const [companyLifecycleAllowed, setCompanyLifecycleAllowed] = useState(false);
  const [currentVisibility, setCurrentVisibility] = useState<ProductVisibility>(product.visibility ?? "PUBLIC");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const sessionUserId = (session as any)?.user?.id as string | undefined;
  const sessionRole = (session as any)?.user?.role as string | undefined;
  const isAdminLike = sessionRole === "ADMIN" || sessionRole === "OWNER";

  useEffect(() => {
    setCurrentVisibility(product.visibility ?? "PUBLIC");
  }, [product.visibility]);

  const canEditProduct = useMemo(() => {
    if (!sessionUserId) return false;
    if (isAdminLike) return true;
    if (product.userId === sessionUserId) return true;
    if (product.companyId && companyEditAllowed) return true;
    return false;
  }, [companyEditAllowed, isAdminLike, product.companyId, product.userId, sessionUserId]);

  const canManageProductLifecycle = useMemo(() => {
    if (!sessionUserId) return false;
    if (canEditProduct) return true;
    if (product.companyId && companyLifecycleAllowed) return true;
    return false;
  }, [canEditProduct, companyLifecycleAllowed, product.companyId, sessionUserId]);

  const handleDeleteProduct = useCallback(async () => {
    setIsDeleting(true);
    try {
      const result = await MyDeleteProductAction(product.id);
      if (result.error) {
        toast.error(result.error);
        setIsDeleting(false);
        return;
      }
      setCurrentVisibility("ARCHIVED");
      toast.success(result.success || "Product archived");
      setDeleteDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Failed to archive product");
    } finally {
      setIsDeleting(false);
    }
  }, [product.id, router]);

  const handleSetVisibility = useCallback(
    async (nextVisibility: ProductVisibility) => {
      setIsUpdatingVisibility(true);
      try {
        const result = await MySetProductVisibilityAction(product.id, nextVisibility);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setCurrentVisibility(result.visibility ?? nextVisibility);
        toast.success(result.success || "Product visibility updated");
        router.refresh();
      } catch {
        toast.error("Failed to update product visibility");
      } finally {
        setIsUpdatingVisibility(false);
      }
    },
    [product.id, router]
  );

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
          setCompanyLifecycleAllowed(false);
          return;
        }
        const perms = (res.permissions ?? {}) as EmployeePermissions;
        setCompanyEditAllowed(perms?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true);
        setCompanyLifecycleAllowed(
          perms?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true ||
            perms?.CAN_DELETE_PRODUCT === true ||
            perms?.CAN_MANAGE_PRODUCT_VISIBILITY === true
        );
      } catch {
        if (!alive) return;
        setCompanyEditAllowed(false);
        setCompanyLifecycleAllowed(false);
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
    if (Number.isFinite(product.stock)) return Math.max(0, product.stock);
    const inventory = product.inventory ?? [];
    return inventory.reduce((sum, it) => sum + it.stock, 0);
  }, [product.inventory, product.stock]);

  const stockAtClosest = useMemo(() => {
    if (!closestWarehouse) return totalStock;
    const inventory = product.inventory ?? [];
    const match = inventory.find((it) => it.warehouseId === closestWarehouse.id);
    if (match) return match.stock;
    if (!inventory.length) return totalStock;
    return inventory.reduce((m, it) => (it.stock > m ? it.stock : m), 0);
  }, [closestWarehouse, product.inventory, totalStock]);

  const isDigitalProduct = product.productType === "DIGITAL";
  const hasShipping = product.productType !== "DIGITAL";
  const acceptedTokenSymbols = useMemo(() => getAcceptedTokenSymbols(product), [product]);
  const acceptedFiatCurrencies = useMemo(() => getAcceptedFiatCurrencies(product), [product]);
  const hasCryptoPayments = acceptedTokenSymbols.length > 0;
  const isPublicListing = currentVisibility === "PUBLIC";
  const visibilityLabel =
    currentVisibility === "PUBLIC"
      ? "Public"
      : currentVisibility === "HIDDEN"
        ? "Hidden"
        : "Archived";
  const availabilityLabel =
    currentVisibility === "ARCHIVED"
      ? "Archived listing"
      : currentVisibility === "HIDDEN"
        ? "Hidden listing"
        : isDigitalProduct
          ? product.downloadsEnabled
            ? "Digital access available"
            : "Listing unavailable"
          : totalStock > 0
            ? `${totalStock} in stock`
            : "Stock check needed";
  const canPurchase = isPublicListing && product.downloadsEnabled !== false && (isDigitalProduct || totalStock > 0);

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
    if (!canPurchase) {
      toast.error("This product is currently out of stock.");
      return;
    }
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
  }, [canPurchase, session, product.id, product.title, router]);

  // Buy Now - add to cart then go straight to checkout
  const handleBuyNow = useCallback(async () => {
    if (!canPurchase) {
      toast.error("This product is currently out of stock.");
      return;
    }
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
  }, [canPurchase, session, product.id, router]);

  const productKindLabel = isDigitalProduct ? "Digital artifact" : product.productType === "HYBRID" ? "Hybrid product" : "Physical product";
  const updatedAt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(product.updatedAt));
  const createdAt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(product.createdAt));

  return (
    <div data-product-detail className="relative w-full space-y-8 pb-24 text-white">
      <ProductDetailCursor />
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/products"
          aria-label="Back to products"
          title="Back to products"
          className="group inline-grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.035] text-zinc-300 transition-all duration-300 hover:-translate-x-0.5 hover:border-emerald-300/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        </Link>
        {canManageProductLifecycle && (
          <div
            className={cn(
              "border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]",
              currentVisibility === "PUBLIC" && "border-emerald-300/35 bg-emerald-400/10 text-emerald-200",
              currentVisibility === "HIDDEN" && "border-amber-300/35 bg-amber-400/10 text-amber-200",
              currentVisibility === "ARCHIVED" && "border-zinc-500/45 bg-zinc-500/10 text-zinc-300"
            )}
          >
            {visibilityLabel}
          </div>
        )}
      </div>

      {/* Top section */}
      <motion.section
        className="grid min-h-[calc(100vh-150px)] grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10"
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
      >
        {/* Gallery */}
        <motion.div
          className="lg:col-span-7"
          variants={{
            hidden: { opacity: 0, y: 22, filter: "blur(14px)" },
            show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: premiumEase } },
          }}
        >
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] p-3 shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_8%,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_84%_80%,rgba(16,185,129,0.18),transparent_34%)]" />
            <div className="relative overflow-hidden rounded-lg bg-black/55">
            <Carousel>
              <CarouselContent>
                {product.image.map((src, idx) => (
                  <CarouselItem key={idx} className="bg-transparent">
                    <AspectRatio ratio={4 / 5}>
                      <Image
                        src={src}
                        alt={product.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 62vw"
                        loading={idx === 0 ? "eager" : "lazy"}
                        className="object-contain p-4 transition-transform duration-700 ease-out hover:scale-[1.018]"
                      />
                    </AspectRatio>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
            </div>
          </div>

          {/* Quick stats — text on background, divided by hairlines (no boxes) */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.055] px-4 py-3 text-center shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1">
              <div className="text-sm font-semibold text-white">{availabilityLabel}</div>
              <div className="mt-0.5 text-xs text-zinc-400">Availability</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.055] px-4 py-3 text-center shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1">
              <div className="text-sm font-semibold text-white">{product.condition}</div>
              <div className="mt-0.5 text-xs text-zinc-400">Condition</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.055] px-4 py-3 text-center shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1">
              <div className="text-sm font-semibold text-white">{isDigitalProduct ? "My downloads" : product.shipFromPostalId || "Not set"}</div>
              <div className="mt-0.5 text-xs text-zinc-400">{isDigitalProduct ? "Delivery" : "Ships from"}</div>
            </div>
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/40 p-6 shadow-[0_28px_110px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-7 lg:sticky lg:top-24 lg:col-span-5"
          variants={{
            hidden: { opacity: 0, x: 28, filter: "blur(12px)" },
            show: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: premiumEase } },
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
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200/80">
                  {productKindLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-zinc-300">
                  {product.category}
                </span>
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[0.98] tracking-normal text-white md:text-6xl lg:text-5xl xl:text-6xl">
                {product.title.split(" ").map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    className="mr-3 inline-block"
                    initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.58, ease: premiumEase, delay: 0.08 + index * 0.045 }}
                  >
                    {word}
                  </motion.span>
                ))}
              </h1>
              <div className="mt-5 text-2xl font-semibold text-emerald-200">
                <PriceAmount
                  amount={product.price}
                  currency={product.priceCurrency || "USD"}
                  acceptsWeb3={Array.isArray(product.acceptedTokens) && product.acceptedTokens.length > 0}
                  acceptedCryptos={product.acceptedTokens?.map((t: any) => t.symbol)}
                />
              </div>
            </div>
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
            {sessionUserId && !canManageProductLifecycle && (
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-red-600" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4" />
                Rapporter
              </Button>
            )}

            {canManageProductLifecycle && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canEditProduct && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href={`/products/edit/${product.id}`}>
                      <Pencil className="h-4 w-4" />
                      Edit listing
                    </Link>
                  </Button>
                )}
                {currentVisibility === "PUBLIC" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-amber-300/25 text-amber-200 hover:bg-amber-400/10"
                    disabled={isUpdatingVisibility}
                    onClick={() => handleSetVisibility("HIDDEN")}
                  >
                    {isUpdatingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                    Hide
                  </Button>
                ) : currentVisibility === "HIDDEN" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-emerald-300/25 text-emerald-200 hover:bg-emerald-400/10"
                    disabled={isUpdatingVisibility}
                    onClick={() => handleSetVisibility("PUBLIC")}
                  >
                    {isUpdatingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Publish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-zinc-500/40 text-zinc-200 hover:bg-white/10"
                    disabled={isUpdatingVisibility}
                    onClick={() => handleSetVisibility("HIDDEN")}
                  >
                    {isUpdatingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    Restore hidden
                  </Button>
                )}
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                      disabled={currentVisibility === "ARCHIVED"}
                    >
                      <Trash2 className="h-4 w-4" />
                      Archive
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Archive listing</DialogTitle>
                      <DialogDescription>
                        This removes &quot;{product.title}&quot; from the public marketplace and stops new purchases. Existing orders and download records stay valid.
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
                        {isDeleting ? "Archiving..." : "Archive listing"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </motion.div>

          {/* actions */}
          <motion.div
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
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
              <Button
                type="button"
                variant="vegaBuyBtn"
                className="h-[52px] w-full rounded-xl px-5 text-sm"
                onClick={handleBuyNow}
                disabled={!canPurchase}
                title={canPurchase ? undefined : "This product can't be purchased right now"}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {canPurchase ? "Buy now" : "Unavailable"}
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
                type="button"
                variant="vegaAddBasketBtn"
                className="h-[52px] rounded-xl px-5 text-sm font-semibold"
                onClick={handleAddToCart}
                disabled={!canPurchase}
              >
                Add to basket
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
              {/* Repurposed: was a dead "Wishlist" button that only toasted
                  "not connected yet" — now a working Share action. */}
              <Button
                type="button"
                variant="vegaAddWishlistBtn"
                className="h-[52px] rounded-xl px-5 text-sm font-semibold"
                onClick={async () => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: document.title, url });
                    } else {
                      await navigator.clipboard.writeText(url);
                      toast.success("Link copied to clipboard");
                    }
                  } catch {
                    /* user dismissed share sheet — no-op */
                  }
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </motion.div>
          </motion.div>

          {/* Accepted Payment Methods */}
          <motion.div
            className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: 0.3, delay: 0.1 } },
            }}
          >
            <span className="font-medium text-zinc-200">Payment</span>

            {/* Crypto chains from product's acceptedTokens */}
            {Array.isArray(product.acceptedTokens) && product.acceptedTokens.length > 0 && (
              <>
                {[...new Set(product.acceptedTokens.map((t: any) => t.family as string))].map((family) => (
                  <span
                    key={family}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-medium text-emerald-100"
                  >
                    <WalletCards className="h-3.5 w-3.5" />
                    {family === "EVM" ? "EVM mainnet" : "Solana mainnet"}
                  </span>
                ))}
              </>
            )}

            {/* Fiat methods — always available on the platform */}
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 font-medium text-sky-100">
              <CreditCard className="h-3.5 w-3.5" />
              PayPal ({acceptedFiatCurrencies.join(", ")})
            </span>
            {!hasCryptoPayments && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-medium text-zinc-400">
                <WalletCards className="h-3.5 w-3.5" />
                Crypto not configured
              </span>
            )}
          </motion.div>

          {/* shipping — available to everyone, including logged-out visitors.
              Location detection + Bring price lookup need no auth. */}
          {hasShipping ? (
          <motion.div
            className="mt-6 overflow-hidden rounded-xl border border-border bg-surface-1"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-3">
                <CiDeliveryTruck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Shipping estimate</div>
                  <div className="text-xs text-muted-foreground">
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
            <div className="p-4">
              {warehouseLocations.length > 0 ? (
                <>
                  {/* Show detected location or input options */}
                  {!userPostalCode ? (
                    <div className="space-y-3">
                      {/* Primary: Auto-Detect Button — single accent, no heavy gradient */}
                      <motion.button
                        type="button"
                        onClick={handleLocate}
                        disabled={isLocLoading}
                        className={cn(
                          "flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3",
                          "bg-emerald-600 font-medium text-white",
                          "transition-colors duration-200 hover:bg-emerald-500",
                          isLocLoading && "cursor-wait opacity-70"
                        )}
                        whileHover={!isLocLoading ? { scale: 1.005 } : {}}
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

            {/* Shipping Results — shown to everyone once a postal code is known */}
            <AnimatePresence mode="wait">
              {showShippingDetails && userPostalCode && (closestWarehouse?.postalCode || product.shipFromPostalId) && (
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
          <motion.div
            className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <div className="flex items-center gap-3 border-b border-border p-4">
              <GoPackage className="h-5 w-5 text-emerald-200" />
              <div>
                <div className="text-sm font-semibold text-white">Digital delivery</div>
                <div className="text-xs text-zinc-400">Access appears in My downloads after payment.</div>
              </div>
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              <div className="bg-black/25 p-4">
                <div className="text-xs font-medium text-zinc-500">Access</div>
                <div className="mt-1.5 text-sm text-white">Instant download token</div>
              </div>
              <div className="bg-black/25 p-4">
                <div className="text-xs font-medium text-zinc-500">Delivery model</div>
                <div className="mt-1.5 text-sm text-white">Digital license, no shipping step</div>
              </div>
            </div>
          </motion.div>
          )}

          {/* availability + ships-from — quiet inline stats, hairline separated */}
          <motion.div
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <GoPackage className="h-3.5 w-3.5" />
                Availability
              </div>
              <div className="mt-1.5 text-sm text-white">
                {isDigitalProduct ? (
                  product.downloadsEnabled ? "Digital download" : <span className="text-amber-600 dark:text-amber-400">Unavailable</span>
                ) : totalStock > 0 ? (
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
              {!isDigitalProduct && totalStock > 0 && closestWarehouse && stockAtClosest !== totalStock && (
                <div className="mt-1 text-xs text-zinc-400">
                  {totalStock} across all locations
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <CiMapPin className="h-3.5 w-3.5" />
                {isDigitalProduct ? "Delivery" : "Ships from"}
              </div>
              <div className="mt-1.5 text-sm text-white">
                {isDigitalProduct ? "My downloads" : closestWarehouse?.postalCode || product.shipFromPostalId || "—"}
              </div>
            </div>
          </motion.div>

          {/* description */}
          <motion.div
            className="mt-6 rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
            }}
          >
            <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/70">About this item</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-200">{product.description}</p>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features section */}
      {product.features && product.features.length > 0 && (
        <motion.section
          className="mt-24"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/70">Highlights</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">What stands out</h3>

          {/* Group features by category key */}
          {(() => {
            const grouped = new Map<string, Feature[]>();
            for (const f of product.features!) {
              const cat = f.key?.trim() || '';
              if (!grouped.has(cat)) grouped.set(cat, []);
              grouped.get(cat)!.push(f);
            }
            
            return Array.from(grouped.entries()).map(([category, items], groupIdx) => (
              <div key={groupIdx} className={groupIdx > 0 ? 'mt-6' : 'mt-8'}>
                {category && (
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {category}
                  </h4>
                )}
                <ul className="grid gap-3 sm:grid-cols-2">
                  {items.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                      <span className="text-sm leading-relaxed text-zinc-200">
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

      {/* Specifications */}
      <motion.section
        className="mt-24"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/70">Specifications</p>
        <h3 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">Technical facts</h3>
        <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(product.specifications || []).map((spec, idx) => (
            <div key={idx} className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
              <dt className="text-sm text-zinc-500">{spec.key}</dt>
              <dd className="text-right text-sm font-medium text-white">
                {spec.value}
                {spec.key === "Weight" && " g"}
                {["Height", "Length", "Width"].includes(spec.key) && " cm"}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <dt className="text-sm text-zinc-500">Updated</dt>
            <dd className="text-right text-sm font-medium text-white">{updatedAt}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <dt className="text-sm text-zinc-500">Created</dt>
            <dd className="text-right text-sm font-medium text-white">{createdAt}</dd>
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

  const pageShellClassName = "relative z-10 mx-auto w-full max-w-screen-2xl px-3 py-5 sm:px-4 md:px-6";
  const renderShell = (children: ReactNode) => (
    <div data-product-detail className="relative isolate min-h-full w-full overflow-hidden bg-black text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(52,211,153,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.035)_1px,transparent_1px)] bg-[size:46px_46px] opacity-20" />
      <div className={pageShellClassName}>{children}</div>
    </div>
  );

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
    return renderShell(
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
    );

  if (error)
    return renderShell(
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
    );

  if (isLoading || !product)
    return renderShell(<ProductSkeleton />);

  return renderShell(<ProductDetails product={product} />);
}
