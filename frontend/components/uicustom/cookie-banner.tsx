"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const COOKIE_CONSENT_VERSION = 1;
const STORAGE_KEY = "veggat:cookieConsent";

type CookieConsent = {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

function readConsent(): CookieConsent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed?.version !== "number") return null;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;

    return {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeConsent(consent: CookieConsent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // ignore
  }
}

export default function CookieBanner() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
    const existing = readConsent();
    if (existing) {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
      setDismissed(true);
      return;
    }
    setDismissed(false);
  }, []);

  const openPreferences = React.useCallback(() => {
    const existing = readConsent();
    setAnalytics(existing?.analytics ?? false);
    setMarketing(existing?.marketing ?? false);
    setExpanded(true);
    setDismissed(false);
  }, []);

  const resetConsent = React.useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    openPreferences();
  }, [openPreferences]);

  React.useEffect(() => {
    if (!mounted) return;
    const onOpen = () => openPreferences();
    const onReset = () => resetConsent();
    window.addEventListener("veggat:cookie-consent-open", onOpen);
    window.addEventListener("veggat:cookie-consent-reset", onReset);
    return () => {
      window.removeEventListener("veggat:cookie-consent-open", onOpen);
      window.removeEventListener("veggat:cookie-consent-reset", onReset);
    };
  }, [mounted, openPreferences, resetConsent]);

  const isVisible = mounted && !dismissed;

  const setCookieOffsetVar = React.useCallback((px: number) => {
    try {
      document.documentElement.style.setProperty("--cookie-banner-offset", `${Math.max(0, px)}px`);
      window.dispatchEvent(new Event("veggat:cookie-banner-offset"));
    } catch {
      // ignore
    }
  }, []);

  React.useLayoutEffect(() => {
    if (!mounted) return;

    if (!isVisible) {
      setCookieOffsetVar(0);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      setCookieOffsetVar(Number.isFinite(h) ? h + 16 : 0);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setCookieOffsetVar(0);
    };
  }, [isVisible, mounted, setCookieOffsetVar]);

  const saveAndDismiss = (next: { analytics: boolean; marketing: boolean }) => {
    const consent: CookieConsent = {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: next.analytics,
      marketing: next.marketing,
      updatedAt: new Date().toISOString(),
    };
    writeConsent(consent);
    setDismissed(true);
    setExpanded(false);
  };

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="cookie-banner"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-4 z-[85] px-4"
        >
          <div ref={ref} className="mx-auto max-w-3xl">
            {/* Solid banner - theme-aware, no gradients */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex flex-col gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Privacy & cookies</div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                    We use essential cookies for sign-in and core functionality. Optional cookies help us understand usage and
                    improve the experience.
                  </p>
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                    Learn more in <Link className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-200" href="/privacy">Privacy & cookies</Link>.
                  </div>
                </div>

                {expanded ? (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Essential</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Required for login, security, and basic site operation.</div>
                      </div>
                      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Always on</div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Analytics</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Helps us improve performance and UX.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnalytics((v) => !v)}
                        className={
                          "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                          (analytics 
                            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" 
                            : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600")
                        }
                        aria-pressed={analytics}
                      >
                        {analytics ? "On" : "Off"}
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Marketing</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Used for personalized content/ads (we don't use this by default).</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMarketing((v) => !v)}
                        className={
                          "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                          (marketing 
                            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" 
                            : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600")
                        }
                        aria-pressed={marketing}
                      >
                        {marketing ? "On" : "Off"}
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveAndDismiss({ analytics, marketing })}
                        className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200"
                      >
                        Save choices
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExpanded(false);
                          setAnalytics(false);
                          setMarketing(false);
                        }}
                        className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveAndDismiss({ analytics: true, marketing: true })}
                    className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98]"
                  >
                    Accept all
                  </button>
                  <button
                    type="button"
                    onClick={() => saveAndDismiss({ analytics: false, marketing: false })}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 active:scale-[0.98]"
                  >
                    Reject non-essential
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 active:scale-[0.98]"
                    aria-expanded={expanded}
                  >
                    {expanded ? "Hide" : "Customize"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
