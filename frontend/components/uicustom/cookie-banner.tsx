"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cookie, Settings2 } from "lucide-react";

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
  const [showCustomize, setShowCustomize] = React.useState(false);
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
    setShowCustomize(true);
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
    setShowCustomize(false);
  };

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="cookie-banner"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-4 z-[85] px-4"
        >
          <div ref={ref} className="mx-auto max-w-md">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl dark:shadow-2xl">
              {/* Main content */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <Cookie className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      We use cookies
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Essential for login & security. Optional for analytics.{" "}
                      <Link 
                        href="/privacy" 
                        className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-200"
                      >
                        Learn more
                      </Link>
                    </p>
                  </div>
                </div>

                {/* Customize panel */}
                <AnimatePresence>
                  {showCustomize && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3">
                        {/* Essential - always on */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Essential</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Login, security, site function</p>
                          </div>
                          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                            Required
                          </span>
                        </div>

                        {/* Analytics toggle */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Analytics</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Usage insights</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={analytics}
                            onClick={() => setAnalytics((v) => !v)}
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              analytics ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                analytics ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Marketing toggle */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Marketing</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">Not used currently</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={marketing}
                            onClick={() => setMarketing((v) => !v)}
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              marketing ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                marketing ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons */}
                <div className="mt-4 flex items-center gap-2">
                  {showCustomize ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveAndDismiss({ analytics, marketing })}
                        className="flex-1 rounded-lg bg-zinc-900 dark:bg-white px-3 py-2 text-xs font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-100"
                      >
                        Save preferences
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustomize(false)}
                        className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Back
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => saveAndDismiss({ analytics: true, marketing: false })}
                        className="flex-1 rounded-lg bg-zinc-900 dark:bg-white px-3 py-2 text-xs font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-100"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => saveAndDismiss({ analytics: false, marketing: false })}
                        className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustomize(true)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
                        aria-label="Customize cookie preferences"
                        title="Customize"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
