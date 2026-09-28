/** @fileOverview Honest showcase offers, using the authoritative credit SKU price. @stability stable */
import { SHOWCASE_PRODUCTS } from "@/lib/showcase-catalog";
export const PLANS = [
  { id: "demo", name: "Explore free", price: "0 NOK", note: "No card needed", featured: false,
    tagline: "Try the marketplace and an isolated demo workspace.",
    features: ["Browse digital products", "Demo checkout and private sample downloads", "Five one-time demo AI credits", "No shared password or real payments"],
    href: "/", ctaLabel: "Open the free demo" },
  { id: "credits", name: "AI credits", price: `${SHOWCASE_PRODUCTS.credits.amountOre / 100} NOK`, note: "One-time pack · no subscription", featured: true,
    tagline: `${SHOWCASE_PRODUCTS.credits.credits} prepaid credits for available premium models.`,
    features: ["Credit cost shown before each message", "Verified payment required before credits arrive", "Failed generations refund reserved credits", "Daily account and platform spending limits"],
    href: `/products/${SHOWCASE_PRODUCTS.credits.id}`, ctaLabel: "View the credit pack" },
  { id: "byok", name: "Your API key", price: "Your provider's rates", note: "No platform credit debit", featured: false,
    tagline: "Use a personal provider key from your own signed-in account.",
    features: ["Keys encrypted at rest", "Your provider bills usage directly", "Daily rate limits still apply", "Provider availability and terms apply"],
    href: "/settings?section=ai", ctaLabel: "Manage API keys" },
] as const;
