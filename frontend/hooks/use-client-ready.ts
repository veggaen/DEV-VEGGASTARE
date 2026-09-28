"use client";
/** @fileOverview Keep JS-dependent controls inert until their handlers are attached. @stability stable */
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Render labels/fields on the server, but don't accept input that a controlled
// form could silently discard when hydration restores its initial values.
export function useClientReady() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
