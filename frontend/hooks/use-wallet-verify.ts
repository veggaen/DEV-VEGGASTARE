/**
 * @fileOverview Inline wallet signature-verification hook for the sidebar.
 *
 * Drives the flow: idle → preparing → in-wallet → waiting → success | error
 *
 * The verification message is built **client-side** (SIWE-like format) so the
 * wallet popup appears instantly — no server round-trip before signing.
 * After signing, the message + signature are submitted in a single POST to
 *   POST /api/wallets/evm/verify
 *
 * The hook is headless — it exposes state only; the UI decides how to render
 * the animated dots, labels, cancel buttons, etc.
 *
 * @stability maturing
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnections, useSignMessage } from "wagmi";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type VerifyStep =
  | "idle"
  /** Building message + finding connector — "Preparing…" */
  | "preparing"
  /** Wallet prompt is actually open — "Continue in wallet…" */
  | "in-wallet"
  /** Signature submitted, waiting for server verify — animated dots */
  | "waiting"
  /** Verification succeeded */
  | "success"
  /** Something went wrong (message in `error`) */
  | "error";

export interface UseWalletVerifyReturn {
  /** Current step in the flow */
  step: VerifyStep;
  /** Human-readable error (only set when step === "error") */
  error: string | null;
  /** Kick off the verification flow */
  verify: () => Promise<void>;
  /** Cancel/reset back to idle */
  reset: () => void;
}

/** How long to wait (ms) for the wallet to respond before auto-cancelling */
const WALLET_PROMPT_TIMEOUT_MS = 60_000;
/** How long the verify POST can take before timeout.
 *  Generous for Neon cold starts + Next.js dev compilation. */
const FETCH_TIMEOUT_MS = 90_000;
/** Retries on network / server errors */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a SIWE-like verification message entirely client-side.
 * Matches the format the server expects to parse in /api/wallets/evm/verify.
 */
function buildVerifyMessage(address: string, chainId: number | undefined): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const issuedAt = new Date();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.veggat.com";

  return [
    "VeggaStare wants you to sign in with your Ethereum account:",
    address,
    "",
    "Link this wallet to your VeggaStare account.",
    "This is a gasless signature request.",
    "",
    `URI: ${origin}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
    chainId ? `Chain ID: ${chainId}` : undefined,
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Fetch with per-request timeout + automatic retries for network errors */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  outerSignal?: AbortSignal,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (outerSignal?.aborted) throw new DOMException("Aborted", "AbortError");

    console.log("[wallet-verify] fetch attempt %d/%d → %s", attempt + 1, MAX_RETRIES + 1, url);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(
        new DOMException(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`, "TimeoutError"),
      );
    }, FETCH_TIMEOUT_MS);

    const onParentAbort = () => controller.abort();
    outerSignal?.addEventListener("abort", onParentAbort, { once: true });

    try {
      const t0 = performance.now();
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      outerSignal?.removeEventListener("abort", onParentAbort);
      console.log(
        "[wallet-verify] ✓ fetch %s → %d in %dms",
        url,
        res.status,
        Math.round(performance.now() - t0),
      );
      return res;
    } catch (err) {
      clearTimeout(timeout);
      outerSignal?.removeEventListener("abort", onParentAbort);
      lastError = err;
      if (outerSignal?.aborted) throw err;
      if (attempt < MAX_RETRIES) {
        console.warn(
          "[wallet-verify] Fetch %s attempt %d failed, retrying in %dms…",
          url,
          attempt + 1,
          RETRY_DELAY_MS,
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

function getVerifyFetchErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return "Verification timed out — server may still be warming up. Try again";
    }
  }
  if (err instanceof TypeError) {
    return "Network request failed — check connection and retry";
  }
  return "Network error verifying — try again";
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useWalletVerify({
  address,
  chainId,
  connectorUid,
  authProvider,
  socialEmail,
  onSuccess,
}: {
  address: string | undefined;
  chainId: number | undefined;
  /** UID of the wagmi connector that owns this wallet — sign with THIS connector */
  connectorUid: string | undefined;
  /** AUTH provider name (e.g. "google", "discord") — persisted on the Wallet record */
  authProvider?: string;
  /** Social email (e.g. user@gmail.com) — persisted on the Wallet record */
  socialEmail?: string;
  /** Called after a successful verify — use to refetch linked wallets */
  onSuccess?: () => void;
}): UseWalletVerifyReturn {
  const [step, setStep] = useState<VerifyStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const { signMessageAsync } = useSignMessage();
  const connections = useConnections();

  // Keep connections in a ref so the async callback always reads latest
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  // Guard against double-click
  const busyRef = useRef(false);
  // Abort controller for cancellation
  const abortRef = useRef<AbortController | null>(null);
  // Timeout handle for auto-cancel
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const verify = useCallback(async () => {
    if (busyRef.current || !address) return;
    busyRef.current = true;
    setError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      /* ── 1. Build message client-side (instant, no server call) ── */
      setStep("preparing");

      const message = buildVerifyMessage(address, chainId);
      console.log("[wallet-verify] Built message for %s (chain %s)", address, chainId ?? "any");

      /* ── 2. Find connector & prompt wallet signature ──────────── */
      const currentConns = connectionsRef.current;
      const addrLower = address.toLowerCase();

      // Try by UID first, then fallback by address
      let targetConnector = connectorUid
        ? currentConns.find((c) => c.connector.uid === connectorUid)?.connector
        : undefined;

      if (!targetConnector) {
        const connByAddr = currentConns.find((c) =>
          c.accounts.some((a) => a.toLowerCase() === addrLower),
        );
        targetConnector = connByAddr?.connector;
      }

      if (!targetConnector) {
        console.error(
          "[wallet-verify] No connector for %s (uid=%s). Connections:",
          address,
          connectorUid,
          currentConns.map((c) => ({
            uid: c.connector.uid,
            name: c.connector.name,
            type: c.connector.type,
            accounts: c.accounts,
          })),
        );
        setStep("error");
        setError("Wallet not connected — reconnect and try again");
        return;
      }

      console.log("[wallet-verify] Signing with connector: %s (%s)", targetConnector.name, targetConnector.type);
      setStep("in-wallet");

      // Capture connector metadata for DB persistence
      const connMeta = {
        connectorType: targetConnector.type ?? undefined,
        connectorName: targetConnector.name ?? undefined,
      };

      // Auto-timeout for wallet prompt
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (busyRef.current) {
          setStep("error");
          setError("Wallet didn't respond — try again");
          busyRef.current = false;
          abortRef.current?.abort();
        }
      }, WALLET_PROMPT_TIMEOUT_MS);

      let signature: string;
      try {
        signature = await signMessageAsync({
          message,
          connector: targetConnector,
          account: address as `0x${string}`,
        });
      } catch (signErr) {
        console.warn("[wallet-verify] Sign rejected:", signErr);
        if (!abort.signal.aborted) {
          setStep("error");
          setError("Signature rejected");
        }
        return;
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }

      if (abort.signal.aborted) return;
      console.log("[wallet-verify] ✓ Signature obtained, submitting to server…");

      /* ── 3. Submit message + signature to server (single POST) ── */
      setStep("waiting");

      let verifyRes: Response;
      try {
        verifyRes = await fetchWithRetry(
          "/api/wallets/evm/verify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address,
              chainId,
              message,
              signature,
              // Pass connector metadata so the server can store it on the Wallet record.
              // This lets the UI show "Reown via Google" etc. even across sessions.
              connectorType: connMeta.connectorType,
              authProvider: authProvider || undefined,
              socialEmail: socialEmail || undefined,
            }),
          },
          abort.signal,
        );
      } catch (fetchErr) {
        if (abort.signal.aborted) return;
        console.error("[wallet-verify] Verify fetch failed:", fetchErr);
        setStep("error");
        setError(getVerifyFetchErrorMessage(fetchErr));
        return;
      }

      const verifyJson = await verifyRes.json().catch(() => null);
      if (abort.signal.aborted) return;

      if (!verifyRes.ok) {
        console.error("[wallet-verify] Verify failed:", verifyRes.status, verifyJson);
        setStep("error");
        setError(verifyJson?.error ?? "Verification failed");
        return;
      }

      /* ── 4. Done! ────────────────────────────────────────────── */
      console.log("[wallet-verify] ✓ Verified!");
      setStep("success");
      onSuccess?.();
    } catch (err: unknown) {
      if (abort.signal.aborted) return;
      console.error("[wallet-verify] Unexpected:", err);
      setStep("error");
      setError("Something went wrong");
    } finally {
      busyRef.current = false;
      abortRef.current = null;
    }
  }, [address, chainId, connectorUid, authProvider, socialEmail, signMessageAsync, onSuccess]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStep("idle");
    setError(null);
    busyRef.current = false;
  }, []);

  return { step, error, verify, reset };
}
