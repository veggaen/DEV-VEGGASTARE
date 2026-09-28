"use client";

/** @fileOverview Hydration-safe, live OS motion preference. @stability stable */
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const getServerSnapshot = () => false;
const getSnapshot = () => window.matchMedia(query).matches;
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// The first client snapshot must match the server, even when the browser's
// preference is already known. React reads the actual preference after hydration.
// Keep text geometry stable; this hook controls effects, not content visibility.
export function useHydratedReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
