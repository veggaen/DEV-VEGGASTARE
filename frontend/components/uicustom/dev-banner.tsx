"use client";

import Link from "next/link";
import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Construction, X } from "lucide-react";

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
  const [footerLiftPx, setFooterLiftPx] = React.useState(0);
  const [cookieLiftPx, setCookieLiftPx] = React.useState(0);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const hideOnAuthPages = pathname?.startsWith("/auth/");
  const isLoggedIn = !!currentUser?.id;

  const readLocalDismissedVersion = React.useCallback(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_VERSION);
      if (!raw) return 0;

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
      window.removeEventListener("storage", onStorage);
    };
  }, [isLoggedIn, readLocalDismissedVersion]);

  // Resolve dismissal state
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

  // Lift above footer and cookie banner
  React.useEffect(() => {
    if (!mounted) return;

    let raf = 0;
    const compute = () => {
      raf = 0;

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
      const overlap = Math.max(0, vh - rect.top);
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
    window.addEventListener("veggat:cookie-banner-offset", onScrollOrResize as EventListener);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("veggat:cookie-banner-offset", onScrollOrResize as EventListener);
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
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, bottom: 16 + footerLiftPx + cookieLiftPx }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-x-0 z-[80] px-4"
        >
          <div ref={ref} className="mx-auto max-w-sm">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 shadow-lg">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Construction className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Under development
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
                  <Link href="/info" className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300">
                    Learn more
                  </Link>
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
