/**
 * @fileOverview Brand Voice / Tone-of-Voice system — one place for recurring
 * product copy so the whole app speaks consistently and the voice is switchable
 * via user settings.
 * @stability evolving
 *
 * One place for recurring product copy, so the whole app speaks consistently
 * and the voice can be switched (configurable via user settings — see
 * UiPreferences.toneOfVoice) without hunting strings across 215 components.
 *
 * DEFAULT = "vibe": punchy + warm/community, derived from the app's existing
 * foundation ("Pulse out — let the world feel your beat", "the Vibe's still
 * beating", "Feel the ripple"). Copy follows the 7 C's: clear, concise,
 * concrete, scannable, action-oriented.
 *
 * Usage:
 *   const t = getVoice(prefs.toneOfVoice);
 *   t.emptyCart.title  →  "Your basket's empty"
 */

export type ToneId = "vibe" | "professional" | "community";

export interface VoicePack {
  id: ToneId;
  label: string;
  description: string;

  // Auth
  signInCta: string;
  signUpCta: string;
  loginHeadline: string;
  loginSub: string;

  // Commerce
  buyNow: string;
  addToCart: string;
  addedToCart: string;
  signInToBuy: string;
  signInToCart: string;
  emptyCart: { title: string; body: string; cta: string };
  outOfStock: string;

  // Reach
  reachTagline: string;

  // Generic
  loading: string;
  retry: string;
  somethingWrong: string;
}

const vibe: VoicePack = {
  id: "vibe",
  label: "Vibe",
  description: "Punchy & warm — bold hooks, human and energetic (the default).",
  signInCta: "Sign in",
  signUpCta: "Join the vibe",
  loginHeadline: "Welcome back — the vibe's still beating",
  loginSub: "Sync with your community. Pulse your thoughts. Feel the ripple.",
  buyNow: "Buy now",
  addToCart: "Add to basket",
  addedToCart: "In your basket",
  signInToBuy: "Sign in to grab this",
  signInToCart: "Sign in to start a basket",
  emptyCart: { title: "Your basket's empty", body: "Find something worth the pulse.", cta: "Browse products" },
  outOfStock: "Sold out",
  reachTagline: "Real reach, honestly earned — not vanity counts.",
  loading: "Loading…",
  retry: "Try again",
  somethingWrong: "That didn't work. Give it another go.",
};

const professional: VoicePack = {
  id: "professional",
  label: "Professional",
  description: "Calm, clear, trustworthy — Stripe/Linear-like.",
  signInCta: "Sign in",
  signUpCta: "Create account",
  loginHeadline: "Welcome back",
  loginSub: "Sign in to access your account and continue where you left off.",
  buyNow: "Buy now",
  addToCart: "Add to cart",
  addedToCart: "Added to cart",
  signInToBuy: "Sign in to purchase",
  signInToCart: "Sign in to add items",
  emptyCart: { title: "Your cart is empty", body: "Browse the marketplace to get started.", cta: "Browse products" },
  outOfStock: "Out of stock",
  reachTagline: "Reach reflects verified identity and real activity.",
  loading: "Loading…",
  retry: "Try again",
  somethingWrong: "Something went wrong. Please try again.",
};

const community: VoicePack = {
  id: "community",
  label: "Community",
  description: "Warm, friendly, human — belonging over features.",
  signInCta: "Sign in",
  signUpCta: "Join us",
  loginHeadline: "Good to see you again",
  loginSub: "Your people are here. Jump back in.",
  buyNow: "Buy now",
  addToCart: "Add to basket",
  addedToCart: "In your basket",
  signInToBuy: "Sign in to buy",
  signInToCart: "Sign in to save items",
  emptyCart: { title: "Nothing here yet", body: "Discover what the community is sharing.", cta: "Explore products" },
  outOfStock: "Sold out",
  reachTagline: "Reach you earn by being real and showing up.",
  loading: "Loading…",
  retry: "Try again",
  somethingWrong: "Hmm, that didn't work — try once more.",
};

export const VOICE_PACKS: Record<ToneId, VoicePack> = { vibe, professional, community };

/** The default tone — derived from the app's existing foundation. */
export const DEFAULT_TONE: ToneId = "vibe";

export function getVoice(tone: ToneId | undefined | null): VoicePack {
  return VOICE_PACKS[tone ?? DEFAULT_TONE] ?? vibe;
}
