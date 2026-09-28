"use client";

/** @fileOverview Consent-aware, route-aware Vercel instrumentation. @stability stable */
import { Suspense, useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  allowsAnalytics, CONSENT_CHANGED_EVENT, CONSENT_STORAGE_KEY, sanitizeTelemetryUrl,
} from "@/lib/telemetry-policy";

function consentGranted() {
  try { return allowsAnalytics(window.localStorage.getItem(CONSENT_STORAGE_KEY)); }
  catch { return false; }
}

function beforeSend<T extends { url: string }>(event: T): T | null {
  // Recheck every event: SDK scripts can remain loaded after consent is revoked.
  if (!consentGranted()) return null;
  const url = sanitizeTelemetryUrl(event.url);
  return url ? { ...event, url } : null;
}

export default function SiteTelemetry() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const sync = () => setEnabled(consentGranted());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <Analytics beforeSend={beforeSend} />
      <SpeedInsights beforeSend={beforeSend} />
    </Suspense>
  );
}
