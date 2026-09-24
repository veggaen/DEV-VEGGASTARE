"use client";
/** @fileOverview Non-modal, bounded consent controls; dismissed UI never traps page input. @stability stable */

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Cookie, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONSENT_CHANGED_EVENT, CONSENT_STORAGE_KEY } from "@/lib/telemetry-policy";

type CookieConsent = {
  version: 1;
  necessary: true;
  analytics: boolean;
  marketing: false;
  updatedAt: string;
};

function readConsent(): CookieConsent | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY) ?? "null");
    if (parsed?.version !== 1 || typeof parsed.analytics !== "boolean") return null;
    return { version: 1, necessary: true, analytics: parsed.analytics, marketing: false,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "" };
  } catch { return null; }
}

export default function CookieBanner() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const [showCustomize, setShowCustomize] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);
  const [saveError, setSaveError] = React.useState(false);
  const [focusPreferences, setFocusPreferences] = React.useState(false);
  const panel = React.useRef<HTMLElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const customize = React.useRef<HTMLButtonElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
    const existing = readConsent();
    setAnalytics(existing?.analytics ?? false);
    setDismissed(Boolean(existing));
  }, []);

  React.useEffect(() => {
    const open = () => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAnalytics(readConsent()?.analytics ?? false);
      setShowCustomize(true);
      setSaveError(false);
      setDismissed(false);
      setFocusPreferences(true);
    };
    const reset = () => {
      try {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
        window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
      } catch { /* Saving reports storage failures visibly below. */ }
      open();
    };
    window.addEventListener("veggat:cookie-consent-open", open);
    window.addEventListener("veggat:cookie-consent-reset", reset);
    return () => {
      window.removeEventListener("veggat:cookie-consent-open", open);
      window.removeEventListener("veggat:cookie-consent-reset", reset);
    };
  }, []);

  const isVisible = mounted && !dismissed;
  React.useLayoutEffect(() => {
    if (!isVisible || !panel.current) return;
    const element = panel.current;
    const update = () => {
      const bottom = Number.parseFloat(getComputedStyle(element).bottom) || 16;
      const height = element.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--cookie-banner-offset", `${Math.ceil(height + bottom + 8)}px`);
      window.dispatchEvent(new Event("veggat:cookie-banner-offset"));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      document.documentElement.style.setProperty("--cookie-banner-offset", "0px");
      window.dispatchEvent(new Event("veggat:cookie-banner-offset"));
    };
  }, [isVisible]);

  React.useEffect(() => {
    if (isVisible && focusPreferences) {
      heading.current?.focus({ preventScroll: true });
      setFocusPreferences(false);
    }
  }, [isVisible, focusPreferences]);

  const dismiss = () => {
    setDismissed(true);
    setShowCustomize(false);
    // A menu item may have unmounted by the time its preferences are closed.
    const target = returnFocus.current?.isConnected ? returnFocus.current
      : document.querySelector<HTMLElement>('button[aria-label="Open menu"]') ?? document.getElementById('main-content');
    target?.focus({ preventScroll: true });
    returnFocus.current = null;
  };

  const save = (allowAnalytics: boolean) => {
    const consent: CookieConsent = { version: 1, necessary: true, analytics: allowAnalytics,
      marketing: false, updatedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch {
      setSaveError(true);
      return;
    }
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
    dismiss();
  };

  // No exit presence: a transparent banner previously intercepted the first
  // wheel/click for 250ms after saving. The panel alone owns its hit area.
  if (!isVisible) return null;
  return (
    <motion.section
      ref={panel}
      role="region"
      aria-labelledby="cookie-preferences-title"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-85 flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
    >
      <div data-cookie-scroll className="min-h-0 overflow-y-auto overscroll-contain p-5">
        <div className="flex items-start gap-3">
          <Cookie aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-2">
            <h2 ref={heading} id="cookie-preferences-title" tabIndex={-1} className="text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">Cookie Preferences</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Essential storage keeps sign-in and security working. Optional analytics and speed measurements help improve Veggat.
            </p>
            <Link href="/privacy" className="inline-flex min-h-11 items-center rounded text-sm underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">Privacy Policy</Link>
          </div>
        </div>
        {showCustomize && (
          <div className="mt-4 space-y-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-sm font-medium">Essential</p><p className="text-xs text-muted-foreground">Sign-in, security and core features</p></div>
              <span className="text-xs font-medium text-muted-foreground">Always on</span>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-t border-border pt-3">
              <span className="min-w-0"><span className="block text-sm font-medium">Analytics</span><span id="cookie-analytics-description" className="block text-xs text-muted-foreground">Optional visit and performance measurements</span></span>
              <input type="checkbox" role="switch" name="analytics" aria-label="Analytics" aria-describedby="cookie-analytics-description" checked={analytics}
                onChange={event => setAnalytics(event.target.checked)} className="h-6 w-6 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">You can change this choice at any time from Menu → Cookie preferences. Marketing tracking is not enabled.</p>
          </div>
        )}
        {saveError && <p role="alert" className="mt-4 text-sm text-destructive">Your browser could not save this choice. Allow site storage and try again. Optional analytics stay governed by your last saved choice.</p>}
      </div>
      <div className="shrink-0 space-y-2 border-t border-border bg-popover p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal" onClick={() => save(false)}>Essential Only</Button>
          <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal" onClick={() => save(showCustomize ? analytics : true)}>{showCustomize ? 'Save Preferences' : 'Allow Analytics'}</Button>
        </div>
        {showCustomize ? (
          <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={() => { setShowCustomize(false); setSaveError(false); requestAnimationFrame(() => customize.current?.focus({preventScroll:true})); }}>Back</Button>
        ) : (
          <Button ref={customize} type="button" variant="ghost" className="min-h-11 w-full gap-2" aria-expanded={false} aria-label="Customize cookie preferences" onClick={() => setShowCustomize(true)}><Settings2 aria-hidden="true" className="h-4 w-4" />Customize</Button>
        )}
      </div>
    </motion.section>
  );
}
