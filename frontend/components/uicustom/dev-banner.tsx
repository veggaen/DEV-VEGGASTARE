"use client";

import Link from "next/link";
import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";

// Increment this when the notice content/meaning changes and you want everyone to see it again.
const NOTICE_VERSION = 1;
const STORAGE_KEY_VERSION = "veggat:siteNoticeDismissedVersion";
const DEV_BANNER_OFFSET_VAR = "--dev-banner-offset";

type NoticePrefResponse = { dismissedVersion: number | null };

export default function DevBanner() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);
  const [localDismissedVersion, setLocalDismissedVersion] = React.useState(0);
  const [online, setOnline] = React.useState(true);
  const [footerLiftPx, setFooterLiftPx] = React.useState(0);
  const [cookieLiftPx, setCookieLiftPx] = React.useState(0);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const hideOnAuthPages = pathname?.startsWith("/auth/");
  const isLoggedIn = !!currentUser?.id;

  const readLocalDismissedVersion = React.useCallback(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_VERSION);
      if (!raw) return 0;

      // Back-compat:
      // - Old format: "1" (number as string)
      // - New format: {"v":1,"t":1700000000000}
      try {
        const parsed = JSON.parse(raw) as { v?: unknown; t?: unknown };
        const v = typeof parsed?.v === "number" ? parsed.v : Number(parsed?.v);
        return Number.isFinite(v) && v > 0 ? v : 0;
      } catch {
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : 0;
      }
    } catch {
      return 0;
    }
  }, []);

  const writeLocalDismissedVersion = React.useCallback((version: number) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY_VERSION,
        JSON.stringify({ v: version, t: Date.now() })
      );
    } catch {
      // ignore
    }
  }, []);

  const fetchServerPref = React.useCallback(async () => {
    const res = await fetch("/api/preferences/site-notice", {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) {
      return { dismissedVersion: null } satisfies NoticePrefResponse;
    }
    const data = (await res.json().catch(() => ({ dismissedVersion: null }))) as NoticePrefResponse;
    return {
      dismissedVersion:
        typeof data?.dismissedVersion === "number" && Number.isFinite(data.dismissedVersion)
          ? data.dismissedVersion
          : null,
    } satisfies NoticePrefResponse;
  }, []);

  const persistServerPref = React.useCallback(async (dismissedVersion: number) => {
    await fetch("/api/preferences/site-notice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissedVersion }),
    }).catch(() => {
      // ignore
    });
  }, []);

  React.useEffect(() => {
    setMounted(true);

    const localV = readLocalDismissedVersion();
    setLocalDismissedVersion(localV);

    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    // Cross-tab sync: if the user dismisses the banner elsewhere, reflect it.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_VERSION) return;
      const nextV = readLocalDismissedVersion();
      setLocalDismissedVersion(nextV);
      if (!isLoggedIn) {
        setDismissed(nextV >= NOTICE_VERSION);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("storage", onStorage);
    };
  }, [isLoggedIn, readLocalDismissedVersion]);

  // Resolve dismissal state (local for logged-out, server for logged-in).
  React.useEffect(() => {
    if (!mounted) return;
    if (hideOnAuthPages) {
      setReady(true);
      setDismissed(true);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const localV = readLocalDismissedVersion();
      setLocalDismissedVersion(localV);

      if (!isLoggedIn) {
        if (!cancelled) {
          setDismissed(localV >= NOTICE_VERSION);
          setReady(true);
        }
        return;
      }

      const server = await fetchServerPref();
      const serverV = server.dismissedVersion ?? 0;
      const effective = Math.max(localV, serverV);

      // If the user dismissed while logged-out, sync that to their account.
      if (localV > serverV) {
        void persistServerPref(localV);
      }

      if (!cancelled) {
        setDismissed(effective >= NOTICE_VERSION);
        setReady(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchServerPref, hideOnAuthPages, isLoggedIn, mounted, persistServerPref, readLocalDismissedVersion]);

  // When the footer becomes visible, lift the banner so it doesn't cover it.
  React.useEffect(() => {
    if (!mounted) return;

    let raf = 0;
    const compute = () => {
      raf = 0;

			// If another fixed banner is present (cookie consent), lift above it.
			try {
				const raw = getComputedStyle(document.documentElement)
					.getPropertyValue("--cookie-banner-offset")
					.trim();
				const n = raw ? Number(raw.replace("px", "")) : 0;
				setCookieLiftPx(Number.isFinite(n) ? Math.max(0, n) : 0);
			} catch {
				setCookieLiftPx(0);
			}

      const footer = document.querySelector("footer");
      if (!footer) {
        setFooterLiftPx(0);
        return;
      }

      const rect = footer.getBoundingClientRect();
      const vh = window.innerHeight || 0;

      // Amount of footer that is inside the viewport from the bottom.
      // If footer is below the viewport, this is 0.
      const overlap = Math.max(0, vh - rect.top);

      // Keep the lift bounded so we don't over-animate on very tall footers.
      const bounded = Math.min(overlap, 280);
      setFooterLiftPx((prev) => (Math.abs(prev - bounded) < 1 ? prev : bounded));
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
		window.addEventListener("veggat:cookie-banner-offset", onScrollOrResize as any);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
			window.removeEventListener("veggat:cookie-banner-offset", onScrollOrResize as any);
    };
  }, [mounted]);

  const isVisible = mounted && ready && !dismissed && !hideOnAuthPages;

  const setDevOffsetVar = React.useCallback((px: number) => {
    try {
      document.documentElement.style.setProperty(DEV_BANNER_OFFSET_VAR, `${Math.max(0, px)}px`);
      window.dispatchEvent(new Event("veggat:dev-banner-offset"));
    } catch {
      // ignore
    }
  }, []);

  React.useLayoutEffect(() => {
    if (!mounted) return;
    if (!isVisible) {
      setDevOffsetVar(0);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      // Add a little breathing room to match how the banner is positioned.
      setDevOffsetVar(Number.isFinite(h) ? h + 16 : 0);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setDevOffsetVar(0);
    };
  }, [isVisible, mounted, setDevOffsetVar]);

  const dismiss = () => {
    setDismissed(true);
    writeLocalDismissedVersion(NOTICE_VERSION);
    setLocalDismissedVersion(NOTICE_VERSION);

    if (isLoggedIn) {
      void persistServerPref(NOTICE_VERSION);
    }
  };

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="dev-banner"
          initial={reduceMotion ? { opacity: 1, bottom: 16 } : { opacity: 0, y: 18, bottom: 16 }}
          animate={
            reduceMotion
              ? { opacity: 1, bottom: 16 + footerLiftPx + cookieLiftPx }
              : { opacity: 1, y: 0, bottom: 16 + footerLiftPx + cookieLiftPx }
          }
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-x-0 z-[80] px-4"
        >
        <div ref={ref} className="mx-auto max-w-3xl">
					<div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(800px 120px at 25% 40%, rgba(34,197,94,0.18), transparent 60%), radial-gradient(900px 140px at 75% 40%, rgba(56,189,248,0.16), transparent 60%)",
                mixBlendMode: "screen",
              }}
            />

            <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                  <span
                    className={
                      "inline-flex h-2.5 w-2.5 shrink-0 rounded-full " +
                      (online ? "bg-emerald-400" : "bg-amber-400")
                    }
                    aria-hidden
                  />
                  <span className="truncate">Under development</span>
                </div>
                <p className="mt-1 text-xs text-white/70 sm:text-sm">
                  Expect iteration: animations, features, and UX polish are actively evolving.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/info"
                  className="group relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition-all duration-300 hover:bg-white/5 hover:text-white"
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
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
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
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  </span>
                  <span>Info</span>
                </Link>

        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl px-3 py-2 text-xs font-medium text-white/70 transition-all duration-300 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss development banner"
          title={
            isLoggedIn
              ? "Hide this notice (saved to your account)"
              : "Hide this notice (saved in your browser)"
          }
        >
          Dismiss
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
