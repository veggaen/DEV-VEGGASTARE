"use client";

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function PrivacyPage() {
  const reduceMotion = useReducedMotion();

  const openCookieSettings = () => {
    try {
      window.dispatchEvent(new Event("veggat:cookie-consent-open"));
    } catch {
      // ignore
    }
  };

  const resetCookieConsent = () => {
    try {
      window.dispatchEvent(new Event("veggat:cookie-consent-reset"));
    } catch {
      // ignore
    }
  };

  const resetSiteData = async () => {
    const ok = window.confirm(
      "This will clear local storage + non-essential cookies and sign you out of the access gate. Continue?"
    );
    if (!ok) return;

    try {
      // Clear HTTP-only gate cookie via server.
      await fetch("/api/access-gate", { method: "DELETE" });
    } catch {
      // ignore
    }

    try {
      // Clear local app storage.
      localStorage.clear();
      sessionStorage.clear();

      // Clear non-HTTP-only cookies.
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = (eqPos > -1 ? cookie.slice(0, eqPos) : cookie).trim();
        if (!name) continue;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }

      // Also reset cookie-consent state if the banner listens for it.
      resetCookieConsent();
    } catch {
      // ignore
    }

    window.location.href = "/gate?redirect=/";
  };

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Clean background - no gradient orbs */}

      <div className="relative mx-auto w-full max-w-5xl px-6 py-16">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="space-y-8"
        >
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
              <span>Privacy & cookies</span>
            </div>
            <h1 className="text-balance text-4xl font-semibold text-foreground sm:text-5xl">Privacy-first, by default.</h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
              This page explains what we store in your browser and why. We keep this high-level on purpose — enough to be
              transparent, without publishing details that could be useful for abuse.
            </p>
          </header>

          <section className="rounded-2xl border border-border bg-card/50 dark:bg-black/30 p-6 backdrop-blur-xl">
            <h2 className="text-xl font-semibold text-foreground">What we use</h2>
            <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <div>
                <div className="font-semibold text-foreground/85">Essential cookies (required)</div>
                <div>
                  Used for authentication, security, and core site operation (for example: keeping you signed in, preventing
                  request forgery, and maintaining basic session state).
                </div>
              </div>
              <div>
                <div className="font-semibold text-foreground/85">Preference storage</div>
                <div>
                  Some UI settings and feature toggles are stored locally in your browser so the site feels consistent between
                  visits.
                </div>
              </div>
              <div>
                <div className="font-semibold text-foreground/85">Optional cookies (only if you consent)</div>
                <div>
                  Analytics cookies can help us understand which screens are slow or confusing. Marketing cookies are not used
                  by default.
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/50 dark:bg-black/30 p-6 backdrop-blur-xl">
            <h2 className="text-xl font-semibold text-foreground">Your choices</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              You can accept all cookies, reject non-essential cookies, or customize categories. You can also clear your
              browser storage to reset choices.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
						type="button"
						onClick={openCookieSettings}
						className="rounded-xl bg-primary/10 dark:bg-white/10 px-4 py-2 text-sm font-semibold text-primary dark:text-white/90 transition-colors hover:bg-primary/15 dark:hover:bg-white/15"
					>
						Cookie settings
					</button>
					<button
						type="button"
						onClick={resetCookieConsent}
						className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						Reset consent
					</button>
        <button
          type="button"
          onClick={resetSiteData}
          className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Reset site data
        </button>
              <Link
                href="/"
                className="rounded-xl bg-muted/50 dark:bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"
              >
                Back home
              </Link>
              <Link
                href="/info"
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground/60 transition-colors hover:bg-muted/50 dark:hover:bg-white/5 hover:text-foreground dark:hover:text-white/90"
              >
                Info / contact
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/50 dark:bg-black/30 p-6 backdrop-blur-xl">
            <h2 className="text-xl font-semibold text-foreground">Security note</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              We won’t list internal infrastructure details here. If you find a security issue, please report it responsibly.
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
