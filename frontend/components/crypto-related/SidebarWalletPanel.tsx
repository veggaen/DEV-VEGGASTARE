/**
 * @fileOverview Compact multi-wallet panel for the nav sidebar.
 * Shows all linked wallets (from DB) plus live-connected wallets from multiple
 * providers. Supports active wallet indicator, per-wallet disconnect, network
 * switching, and an always-visible "Connect Wallet" button.
 *
 * @stability experimental
 */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  useAccount,
  useBalance,
  useChainId,
  useChains,
  useConnect,
  useConnections,
  useDisconnect,
  useEnsName,
  useFeeData,
  useSwitchAccount,
  useSwitchChain,
} from "wagmi";
import { ModalController } from "@reown/appkit-controllers";
import { useAppKitAccount } from "@reown/appkit/react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { FiZap, FiExternalLink, FiPower, FiChevronDown, FiShield, FiLogOut, FiSend, FiTerminal, FiPlusCircle, FiClock, FiRefreshCw, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { CopyChip } from "@/components/uicustom/CopyChip";
import { CHAIN_DISPLAY } from "@/lib/vegga-system-constants";
import { useWalletVerify, type VerifyStep } from "@/hooks/use-wallet-verify";
import { useDonate, getNextDonationInfo, type DonateStep } from "@/hooks/use-donate";
import { useWalletTransfer } from "@/hooks/use-wallet-transfer";
import { isLocalChain } from "@/lib/is-local-chain";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { usePricing } from "@/components/crypto-related/PricingContext";
import {
  resolveWalletTier,
  getTierDef,
  getNextTier,
  tierColorClasses,
  WALLET_BUFF_TIERS,
  type WalletBuffTier,
} from "@/lib/wallet-buff-tiers";
import { formatUnits, isAddress, parseEther } from "viem";
import { toast } from "sonner";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { createLogger } from "@/lib/logger";

const log = createLogger('WalletPanel');

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type LinkedWallet = {
  id: string;
  label: string;
  family: "EVM" | "SOLANA" | "BITCOIN";
  address: string;
  chainId: number | null;
  isDefault: boolean;
  verifiedAt: string | null;
  donationTotalUsd: number;
  /** Connector type that created this wallet (e.g. "AUTH", "injected") */
  connectorType?: string;
  /** For AUTH wallets: social provider (e.g. "google", "discord") */
  authProvider?: string;
  /** For AUTH wallets: email from the social provider */
  socialEmail?: string;
};

type TransferReceipt = {
  id: string;
  sourceAddress: string;
  destinationAddress: string;
  amountNative: string;
  amountNok: number;
  nativeSymbol: string;
  txHash: string;
  chainId: number | null;
  createdAt: number;
};

/**
 * Registry entry for a wallet seen this session.
 * Persists even when the provider auto-disconnects (AppKit AUTH),
 * so the card stays visible as a grey/inactive row with copyable address.
 */
type WalletRegistryEntry = {
  key: string;
  label: string;
  /** User-defined custom label (overrides label in display) */
  customLabel?: string;
  family: string;
  address: string;
  connectorName: string;
  connectorType: string;
  connectorUid: string;
  connectorId: string;
  connectorIcon?: string;
  /** Auth provider saved at connect time (Google, Discord, etc.) — only for AUTH wallets */
  authProvider?: string;
  /** Social display name saved at connect time */
  socialName?: string;
  /** Social email saved at connect time */
  socialEmail?: string;
  /** DB wallet ID (cuid) — backfilled when DB wallets are synced */
  dbWalletId?: string;
  addedAt: number;
};

/**
 * Open a popup window centered on the user's current screen.
 * Falls back to default positioning if screen geometry isn't available.
 */
function openCenteredPopup(url: string, name: string, width = 600, height = 800): Window | null {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  return window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
  );
}

/** SessionStorage key for persisting the wallet registry across page reloads / OAuth redirects */
const REGISTRY_STORAGE_KEY = 'veggat_wallet_registry';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Save wallet registry to sessionStorage */
function saveRegistryToStorage(registry: Map<string, WalletRegistryEntry>) {
  try {
    const entries = [...registry.entries()];
    if (entries.length > 0) {
      sessionStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(entries));
    } else {
      sessionStorage.removeItem(REGISTRY_STORAGE_KEY);
    }
  } catch { /* sessionStorage unavailable */ }
}

/** Restore wallet registry from sessionStorage */
function restoreRegistryFromStorage(): [string, WalletRegistryEntry][] {
  try {
    const stored = sessionStorage.getItem(REGISTRY_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore corrupt data */ }
  return [];
}

function trimAddress(addr: string, head = 6, tail = 4) {
  if (!addr || addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function chainIcon(family: string) {
  return CHAIN_DISPLAY[family]?.icon ?? "⬡";
}

function chainColor(family: string) {
  return CHAIN_DISPLAY[family]?.color ?? "#71717a";
}

function explorerTxUrl(chainId: number | null | undefined, txHash: string): string | null {
  if (!txHash) return null;
  if (chainId === 1) return `https://etherscan.io/tx/${txHash}`;
  if (chainId === 369) return `https://scan.pulsechain.com/tx/${txHash}`;
  return null;
}

/** Map connector names/ids to friendly labels */
function connectorLabel(name: string): string {
  const map: Record<string, string> = {
    metaMask: "MetaMask",
    MetaMask: "MetaMask",
    "io.metamask": "MetaMask",
    "io.metamask.flask": "MetaMask Flask",
    coinbaseWalletSDK: "Coinbase",
    "Coinbase Wallet": "Coinbase",
    "com.coinbase.wallet": "Coinbase",
    walletConnect: "WalletConnect",
    WalletConnect: "WalletConnect",
    injected: "Browser Wallet",
    Injected: "Browser Wallet",
    safe: "Safe",
    "Safe{Wallet}": "Safe",
    Auth: "AppKit Social",
    "Phantom": "Phantom",
    "io.phantom": "Phantom",
    "app.phantom": "Phantom",
    "Brave Wallet": "Brave",
    "com.brave.wallet": "Brave",
    "Rabby Wallet": "Rabby",
    "io.rabby": "Rabby",
    "Ledger": "Ledger",
    "com.ledger": "Ledger",
    "Zerion": "Zerion",
    "io.zerion.wallet": "Zerion",
    "Rainbow": "Rainbow",
    "me.rainbow": "Rainbow",
    "Trust Wallet": "Trust",
    "com.trustwallet.app": "Trust",
    "Local RPC": "Local RPC",
    "Local Dev": "Local Dev",
  };
  return map[name] ?? name;
}

type LocalRpcSource = {
  chainId: number;
  chainName: string;
  rpcUrl: string;
};

type LocalRpcAction =
  | "mine"
  | "increase-time"
  | "snapshot"
  | "revert"
  | "set-balance"
  | "send-from-account";

type LocalRpcAccount = LocalRpcSource & {
  address: string;
  /** ETH balance as a display string (e.g. "100.0") — may be null if fetch failed */
  balanceEth?: string | null;
};

const LOCAL_RPC_SOURCES: LocalRpcSource[] = [
  {
    chainId: 31337,
    chainName: "Anvil Local",
    rpcUrl: process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? "http://127.0.0.1:8545",
  },
  {
    chainId: 1337,
    chainName: "Ganache Local",
    rpcUrl: process.env.NEXT_PUBLIC_GANACHE_RPC_URL ?? "http://127.0.0.1:7545",
  },
];

function localChainName(chainId?: number): string | undefined {
  if (chainId === 31337) return "Anvil Local";
  if (chainId === 1337) return "Ganache Local";
  return undefined;
}

function localRpcEntryKey(chainId: number | undefined, address: string): string {
  return `${chainId ?? 0}:${address.toLowerCase()}`;
}

function findLocalRpcSource(chainId: number): LocalRpcSource | undefined {
  return LOCAL_RPC_SOURCES.find((source) => source.chainId === chainId);
}

function toHexWeiFromEth(ethValue: string): string | null {
  try {
    const wei = parseEther(ethValue.trim().replace(",", "."));
    if (wei <= BigInt(0)) return null;
    return `0x${wei.toString(16)}`;
  } catch {
    return null;
  }
}

async function callLocalRpc<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC ${response.status}`);
    const json = (await response.json()) as { result?: T; error?: { message?: string } };
    if (json.error) throw new Error(json.error.message ?? "RPC error");
    if (json.result === undefined) throw new Error("RPC missing result");
    return json.result;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchLocalRpcAccounts(): Promise<LocalRpcAccount[]> {
  const settled = await Promise.allSettled(
    LOCAL_RPC_SOURCES.map(async (source) => {
      const addresses = await callLocalRpc<string[]>(source.rpcUrl, "eth_accounts");
      // Fetch balances in parallel for all accounts on this source
      const withBalances = await Promise.all(
        addresses.map(async (address) => {
          let balanceEth: string | null = null;
          try {
            const hexBalance = await callLocalRpc<string>(source.rpcUrl, "eth_getBalance", [address, "latest"]);
            const wei = BigInt(hexBalance);
            // Convert to ETH with 4 decimal precision
            const ethFloat = Number(wei) / 1e18;
            balanceEth = ethFloat > 999 ? `${(ethFloat / 1000).toFixed(1)}k` : ethFloat.toFixed(ethFloat < 0.01 ? 6 : 2);
          } catch { /* ignore — balance just won't show */ }
          return { ...source, address, balanceEth };
        }),
      );
      return withBalances;
    }),
  );

  const wallets: LocalRpcAccount[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") wallets.push(...result.value);
  }
  return wallets;
}

/* ── Wallet brand icon URL resolver ─────────────────────────────── */

/** WalletConnect blue logo as inline SVG data URI (no external file needed) */
const WC_ICON_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Crect width='480' height='480' rx='96' fill='%233B99FC'/%3E%3Cpath d='M141.1 181.8c54.9-53.7 143.9-53.7 198.8 0l6.6 6.5a6.8 6.8 0 010 9.7l-22.6 22.1a3.5 3.5 0 01-5 0l-9.1-8.9c-38.3-37.5-100.4-37.5-138.7 0l-9.7 9.5a3.5 3.5 0 01-5 0L134 198.8a6.8 6.8 0 010-9.7l7.1-7.3zm245.6 45.7 20.1 19.7a6.8 6.8 0 010 9.7L304.6 356.5a7 7 0 01-9.9 0l-72.5-70.9a1.8 1.8 0 00-2.5 0l-72.5 70.9a7 7 0 01-9.9 0L35.2 257a6.8 6.8 0 010-9.7l20.1-19.7a7 7 0 019.9 0l72.5 70.9a1.8 1.8 0 002.5 0l72.5-70.9a7 7 0 019.9 0l72.5 70.9a1.8 1.8 0 002.5 0l72.5-70.9a7 7 0 019.9 0z' fill='%23fff'/%3E%3C/svg%3E";

/** Reown / AppKit logo as inline SVG data URI — actual Reown brand mark:
 *  pill-with-dot + rounded-rect-with-slash, white on #202020 */
const REOWN_ICON_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 480'%3E%3Crect width='480' height='480' rx='96' fill='%23202020'/%3E%3Cg transform='translate(59.5,126) scale(6)'%3E%3Cpath d='M0 10.29C0 4.61 4.61 0 10.29 0c5.68 0 10.29 4.61 10.29 10.29v17.42c0 5.68-4.61 10.29-10.29 10.29C4.61 38 0 33.39 0 27.71V10.29z' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M9.18 21.52v2.23h2.23v-2.23H9.18z' fill='%23202020'/%3E%3Crect x='22.17' width='38' height='38' rx='11.08' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M43.04 11.35l-5.65 15.3h1.9l5.65-15.3h-1.9z' fill='%23202020'/%3E%3C/g%3E%3C/svg%3E";

/** Social / auth provider icon data URIs */
const AUTH_PROVIDER_ICONS: Record<string, string> = {
  google:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath fill='%23FFC107' d='M43.6 20.1H42V20H24v8h11.3C33.9 33.1 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z'/%3E%3Cpath fill='%23FF3D00' d='M6.3 14.7l6.6 4.8C14.3 15.5 18.8 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z'/%3E%3Cpath fill='%234CAF50' d='M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.4 0-9.9-3.6-11.3-8.6l-6.5 5C9.5 39.6 16.2 44 24 44z'/%3E%3Cpath fill='%231976D2' d='M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C37 39.1 44 34 44 24c0-1.3-.1-2.7-.4-3.9z'/%3E%3C/svg%3E",
  discord:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%235865F2'/%3E%3Cpath d='M32.3 16.2a22.7 22.7 0 00-5.6-1.7l-.2.5a21 21 0 00-4.9 0l-.3-.5a22.6 22.6 0 00-5.6 1.7A23.3 23.3 0 0012 32.5a23 23 0 006.8 3.4l.5-.7 1-1.5a14.8 14.8 0 01-2.4-1.1l.6-.5a16.2 16.2 0 0013.8 0l.6.5a14.9 14.9 0 01-2.4 1.1l1 1.5.5.7A23 23 0 0039 32.5a23.3 23.3 0 00-6.7-16.3zM19.5 29.6c-1.4 0-2.6-1.3-2.6-2.9s1.2-2.9 2.6-2.9 2.6 1.3 2.6 2.9-1.1 2.9-2.6 2.9zm9 0c-1.4 0-2.6-1.3-2.6-2.9s1.2-2.9 2.6-2.9 2.6 1.3 2.6 2.9-1.1 2.9-2.6 2.9z' fill='%23fff'/%3E%3C/svg%3E",
  github:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%23181717'/%3E%3Cpath d='M24 6a18 18 0 00-5.7 35.1c.9.2 1.2-.4 1.2-.8v-3.2c-5 1.1-6-2.1-6-2.1a4.7 4.7 0 00-2-2.6c-1.6-1.1.1-1.1.1-1.1a3.7 3.7 0 012.7 1.8 3.8 3.8 0 005.2 1.5 3.8 3.8 0 011.1-2.4c-4-.5-8.1-2-8.1-8.8a6.9 6.9 0 011.8-4.8 6.4 6.4 0 01.2-4.7s1.5-.5 5 1.8a17.2 17.2 0 019 0c3.4-2.3 5-1.8 5-1.8a6.4 6.4 0 01.2 4.7 6.9 6.9 0 011.8 4.8c0 6.9-4.2 8.3-8.2 8.8a4.2 4.2 0 011.2 3.3v5c0 .4.3 1 1.2.8A18 18 0 0024 6z' fill='%23fff'/%3E%3C/svg%3E",
  apple:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%23000'/%3E%3Cpath d='M33.3 25.2c0-3.2 2.6-4.7 2.7-4.8a5.9 5.9 0 00-4.6-2.5c-2-.2-3.8 1.2-4.8 1.2s-2.5-1.1-4.1-1.1a6.1 6.1 0 00-5.1 3.1c-2.2 3.8-.6 9.4 1.5 12.5 1 1.5 2.3 3.2 3.9 3.1 1.5-.1 2.1-1 4-1s2.4 1 4 1 2.7-1.5 3.8-3a13.2 13.2 0 001.7-3.5 5.6 5.6 0 01-3-5zm-3.3-9.3a5.7 5.7 0 001.3-4.1 5.8 5.8 0 00-3.8 2 5.4 5.4 0 00-1.3 3.9 4.8 4.8 0 003.8-1.8z' fill='%23fff'/%3E%3C/svg%3E",
  x:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%23000'/%3E%3Cpath d='M28.9 21.2L37.6 11h-2.1l-7.5 8.8L21.5 11H13l9.1 13.3L13 35h2.1l8-9.3 6.4 9.3H38l-9.1-13.8zm-2.8 3.3l-.9-1.3L16 12.5h3.2l6 8.6.9 1.3 7.8 11.2h-3.2l-6.4-9.1z' fill='%23fff'/%3E%3C/svg%3E",
  farcaster:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%238A63D2'/%3E%3Cpath d='M14 14h20v2l-2 2v12h-2v-2l-2-2h-2l-2 2v2h-2v-2l-2 2h-2l-2-2v2h-2V18l-2-2v-2z' fill='%23fff'/%3E%3C/svg%3E",
  email:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%23607D8B'/%3E%3Cpath d='M10 16l14 9 14-9v-2H10v2zm0 4v14h28V20L24 29 10 20z' fill='%23fff'/%3E%3C/svg%3E",
  facebook:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%231877F2'/%3E%3Cpath d='M29.5 25.5l.8-5h-4.8v-3.2c0-1.4.7-2.8 2.9-2.8h2.2v-4.3s-2-.3-4-.3c-4.1 0-6.7 2.5-6.7 6.9v3.7H15v5h4.9V40h6.1V25.5h3.5z' fill='%23fff'/%3E%3C/svg%3E",
};

/** Pretty label for auth provider */
function authProviderLabel(provider: string): string {
  const map: Record<string, string> = {
    google: "Google",
    discord: "Discord",
    github: "GitHub",
    apple: "Apple",
    x: "X (Twitter)",
    farcaster: "Farcaster",
    email: "Email",
    facebook: "Facebook",
  };
  return map[provider] ?? provider;
}

function preferredAuthProvider(saved?: string, live?: string, socialEmail?: string): string | undefined {
  const normalize = (value?: string) => value?.trim().toLowerCase();
  const savedNorm = normalize(saved);
  const liveNorm = normalize(live);

  // Prefer a specific social provider (google, discord, etc.) over generic 'email'
  if (savedNorm && savedNorm !== 'email') return savedNorm;
  if (liveNorm && liveNorm !== 'email') return liveNorm;

  // When AppKit only reports 'email', try to infer the real provider from socialEmail domain
  const emailDomain = socialEmail?.trim().toLowerCase().split('@')[1];
  if (emailDomain) {
    if (emailDomain === 'gmail.com' || emailDomain.endsWith('.google.com')) return 'google';
    if (emailDomain === 'icloud.com' || emailDomain === 'me.com' || emailDomain === 'mac.com') return 'apple';
    if (emailDomain === 'users.noreply.github.com') return 'github';
  }

  // Last resort: return 'email' so the card at least shows "via Email" badge
  if (savedNorm === 'email' || liveNorm === 'email') return 'email';
  return undefined;
}

function authIdentityKey(provider?: string, socialEmail?: string, socialName?: string): string | null {
  const providerPart = provider?.trim().toLowerCase();
  const emailPart = socialEmail?.trim().toLowerCase();
  const namePart = socialName?.trim().toLowerCase();
  if (!providerPart && !emailPart && !namePart) return null;
  return `${providerPart ?? ''}|${emailPart ?? ''}|${namePart ?? ''}`;
}

/**
 * Resolve a static icon URL for a connector by name/id.
 * Prefers the connector's own `icon` (EIP-6963 data URI) when passed.
 * Falls back to known static paths or inline data URIs.
 */
function connectorIconUrl(nameOrId: string, eip6963Icon?: string): string {
  if (eip6963Icon) return eip6963Icon;
  const key = nameOrId.toLowerCase();
  if (key.includes("metamask")) return "/metamask/metamask.webp";
  if (key.includes("coinbase")) return "/wallets/coinbase.webp";
  if (key.includes("walletconnect")) return WC_ICON_DATA_URI;
  if (key.includes("auth") || key.includes("appkit")) return REOWN_ICON_DATA_URI;
  return "/wallets/wallet-generic.jpg";
}

/** Tiny inline wallet icon — 14×14 rounded square */
function WalletIcon({ src, alt, size = 14 }: { src: string; alt: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-sm shrink-0 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  ConnectWalletButton — opens AppKit modal to Connect view           */
/* ------------------------------------------------------------------ */

/**
 * Opens the AppKit modal directly to the Connect view.
 *
 * Uses ModalController from @reown/appkit-controllers with { view: 'Connect' }
 * so that even when already connected the modal opens to the connector picker
 * (not the Account view). This gives access to all options: social logins
 * (Google, Apple, Discord, GitHub, X), email, QR scanning, browser extensions
 * (MetaMask, Coinbase, etc.), 300+ WalletConnect wallets.
 */
function ConnectWalletButton({
  hasWallets,
  onBeforeOpen,
  previousAuthProvider,
  onRestore,
}: {
  hasWallets: boolean;
  onBeforeOpen?: () => Promise<void>;
  previousAuthProvider?: string;
  onRestore?: () => void;
}) {
  const handleOpen = async () => {
    // Disconnect any active AUTH session first so all social providers
    // are available in the modal (AppKit grays them out otherwise).
    let disconnectedProvider: string | undefined;
    if (onBeforeOpen) {
      try {
        await onBeforeOpen();
        disconnectedProvider = previousAuthProvider;
      } catch { /* ok */ }
    }

    // Open the Connect modal
    ModalController.open({ view: 'Connect' });

    // If we disconnected an AUTH session, watch for modal close.
    // If the modal closes without establishing a new AUTH connection,
    // reconnect the previous provider automatically.
    if (disconnectedProvider) {
      const VALID_SOCIALS = ['google', 'discord', 'github', 'apple', 'facebook', 'x'] as const;
      const provider = disconnectedProvider.toLowerCase();
      const isSocial = VALID_SOCIALS.includes(provider as any);

      const unsubscribe = ModalController.subscribeKey('open', async (isOpen) => {
        if (isOpen) return; // modal just opened, wait for close
        unsubscribe();

        // Small delay to let any new connection settle
        await new Promise((r) => setTimeout(r, 600));

        // Check if a new AUTH connection was made
        try {
          const { getConnections } = await import('wagmi/actions');
          const { wagmiConfig } = await import('@/components/crypto-related/AppKitInit');
          const conns = getConnections(wagmiConfig);
          const hasAuth = conns.some(
            (c) => c.connector.type === 'AUTH' || c.connector.id === 'auth',
          );
          if (hasAuth) return; // user connected something new — no restore needed
        } catch { /* ok */ }

        // No new AUTH connection — restore the previous one
        if (isSocial) {
          try {
            const { ConnectorControllerUtil } = await import('@reown/appkit-controllers');
            await ConnectorControllerUtil.connectSocial({
              social: provider as (typeof VALID_SOCIALS)[number],
              closeModalOnConnect: true,
            });
          } catch {
            // If direct reconnect fails, fall back to reopening modal
            try { ModalController.open({ view: 'Connect' }); } catch { /* ok */ }
          }
        }
        if (onRestore) onRestore();
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="w-full flex items-center gap-2 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 hover:border-sky-500/50 dark:hover:border-emerald-500/50 transition-colors"
    >
      <WalletIcon src={REOWN_ICON_DATA_URI} alt="Reown" />
      <span className="truncate flex-1 text-left">Reown · Social · Email · 520+ wallets</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  DirectConnectors — native wagmi buttons (MetaMask, Coinbase etc.)  */
/* ------------------------------------------------------------------ */

/** Map connector type to a friendly "via" source label */
function connectorSource(type: string, name?: string): string {
  const map: Record<string, string> = {
    injected: "Extension",
    announced: "Extension",
    AUTH: "AppKit",
    LOCAL_RPC: "Local RPC",
    walletConnect: "WalletConnect",
    coinbaseWalletSDK: "Coinbase SDK",
  };
  return map[type] ?? (name || type);
}

/**
 * Direct connector buttons — uses wagmi's native connect() which truly
 * supports multi-wallet (each connector adds a parallel connection).
 *
 * Two rows:
 *   1. Browser extensions (MetaMask, Coinbase, Brave, Rabby, etc.)
 *   2. WalletConnect (opens QR — supports Ledger Live, Safe, Trust, 300+ wallets)
 *
 * IMPORTANT: After connecting a new wallet, AppKit's AUTH connector may
 * detect it's no longer active and auto-disconnect. We use the same
 * reconnect pattern as handleSetActive: snapshot connectors before,
 * reconnect any that vanish after.
 */
function DirectConnectors({
  connectedIds,
  connectedConnectorNames,
  onAfterConnect,
}: {
  connectedIds: Set<string>;
  /** Friendly names of already-connected connectors — used to show "in use" */
  connectedConnectorNames: Set<string>;
  onAfterConnect?: () => void;
}) {
  const { connectAsync, connectors } = useConnect();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // ── Browser extension / EIP-6963 connectors ──
  // SKIP: generic "injected" (window.ethereum conflicts), AppKit auth, WalletConnect
  const extensionWallets = connectors.filter((c) => {
    if (c.name === "Auth" || c.type === "AUTH") return false;
    if (c.id === "walletConnect") return false;
    if (c.id === "injected" && c.name === "Injected") return false;
    return c.type === "injected" || c.id === "metaMask" || c.id === "coinbaseWalletSDK";
  });

  // Check if Coinbase Wallet browser extension registered via EIP-6963.
  // When present, prefer it over the coinbaseWalletSDK connector which
  // defaults to Smart Wallet (popup at keys.coinbase.com) and may not
  // trigger the local extension to unlock.
  const hasEip6963Coinbase = extensionWallets.some(
    (c) =>
      c.type === "injected" &&
      c.id !== "coinbaseWalletSDK" &&
      (c.id.includes("coinbase") || c.name.toLowerCase().includes("coinbase")),
  );

  // Dedupe by id, skip already-connected, prefer EIP-6963 Coinbase over SDK
  const seen = new Set<string>();
  const uniqueExtensions = extensionWallets.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    if (connectedIds.has(c.uid) || connectedIds.has(c.id)) return false;
    // If the real browser extension is available, skip the SDK connector
    // (it uses Smart Wallet popup which doesn't trigger the extension)
    if (hasEip6963Coinbase && c.id === "coinbaseWalletSDK") return false;
    return true;
  });

  // ── WalletConnect connector (QR / deep-link — Ledger, Safe, Trust, etc.) ──
  const wcConnector = connectors.find(
    (c) => c.id === "walletConnect" && !connectedIds.has(c.uid) && !connectedIds.has(c.id),
  );

  /**
   * Connect a new wallet while preserving existing connections.
   */
  const handleConnect = async (connector: (typeof connectors)[number]) => {
    setConnecting(connector.uid);
    setConnectError(null);
    try {
      log.debug(`Connecting ${connector.name} (id=${connector.id}, type=${connector.type})`);
      await connectAsync({ connector });
      log.info(`Connected ${connector.name}`);
      setTimeout(() => {
        onAfterConnect?.();
        setConnecting(null);
      }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      log.warn(`Connection failed for ${connector.name}`, msg);
      // User-rejected is expected, don't show as error
      if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User closed")) {
        setConnectError(null);
      } else {
        setConnectError(`${connector.name}: ${msg.slice(0, 120)}`);
      }
      setConnecting(null);
    }
  };

  const hasExtensions = uniqueExtensions.length > 0;
  const hasWc = !!wcConnector;
  if (!hasExtensions && !hasWc) return null;

  return (
    <div className="space-y-1">
      {/* Browser extensions — vertical list with descriptive labels */}
      {hasExtensions && (
        <div className="space-y-1">
          {uniqueExtensions.map((c) => {
            const label = connectorLabel(c.name);
            const inUse = connectedConnectorNames.has(label);
            return (
              <button
                key={c.uid}
                type="button"
                disabled={connecting !== null || inUse}
                onClick={() => handleConnect(c)}
                className={`w-full flex items-center gap-2 text-[10px] font-medium px-3 py-1.5 rounded-lg border transition-colors truncate ${
                  inUse
                    ? "border-zinc-200/50 dark:border-zinc-700/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 hover:border-sky-500/50 dark:hover:border-emerald-500/50 disabled:opacity-50"
                }`}
              >
                {connecting === c.uid ? (
                  <span className="flex items-center gap-2 text-sky-500 dark:text-emerald-400">
                    <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                    <span>Connecting {label}…</span>
                  </span>
                ) : (
                  <>
                    <WalletIcon src={connectorIconUrl(c.id || c.name, c.icon)} alt={label} />
                    <span className="truncate flex-1 text-left">
                      {inUse ? `${label} · in use` : `${label} · Extension`}
                    </span>
                    {inUse && (
                      <span className="text-[8px] text-amber-500 dark:text-amber-400 shrink-0">connected</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* WalletConnect — multi-connector: QR, Ledger, Safe, 300+ wallets */}
      {hasWc && (
        <button
          type="button"
          disabled={connecting !== null}
          onClick={() => handleConnect(wcConnector)}
          className="w-full flex items-center gap-2 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-colors disabled:opacity-50"
        >
          {connecting === wcConnector.uid ? (
            <span className="flex items-center gap-2 text-blue-500 dark:text-blue-400">
              <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              <span>Opening WalletConnect…</span>
            </span>
          ) : (
            <>
              <WalletIcon src={WC_ICON_DATA_URI} alt="WalletConnect" />
              <span className="truncate flex-1 text-left">WalletConnect · QR · Ledger · Safe</span>
            </>
          )}
        </button>
      )}

      {/* Connection error feedback */}
      {connectError && (
        <p className="text-[9px] text-red-500 dark:text-red-400 px-1 truncate" title={connectError}>
          {connectError}
        </p>
      )}
    </div>
  );
}

/**
 * Single "Connect a wallet" button that expands to reveal all connection
 * options: browser extensions, WalletConnect, and Reown/AppKit (social/email).
 * Shows which connectors are already in use to avoid confusion.
 */
function ConnectSection({
  connectedIds,
  connectedConnectorNames,
  hasWallets,
  onAfterConnect,
  onBeforeOpenAppKit,
  previousAuthProvider,
  onRestoreAppKit,
  showLocalRpcOption,
  localRpcBusy,
  localRpcError,
  localRpcNotice,
  localRpcSnapshots,
  localRpcAddedKeys,
  activeEvmAddress,
  onAddLocalRpcWallet,
  onRunLocalRpcAction,
  onActivateRpcAccount,
}: {
  connectedIds: Set<string>;
  /** Set of friendly names of already-connected connectors (e.g. "MetaMask", "Coinbase") */
  connectedConnectorNames: Set<string>;
  hasWallets: boolean;
  onAfterConnect?: () => void;
  onBeforeOpenAppKit?: () => Promise<void>;
  previousAuthProvider?: string;
  onRestoreAppKit?: () => void;
  showLocalRpcOption?: boolean;
  localRpcBusy?: boolean;
  localRpcError?: string | null;
  localRpcNotice?: string | null;
  localRpcSnapshots?: Record<number, string | number | null>;
  localRpcAddedKeys?: string[];
  activeEvmAddress?: string | null;
  onAddLocalRpcWallet?: (opts?: { chainId?: number; addAll?: boolean; address?: string }) => Promise<void>;
  onRunLocalRpcAction?: (opts: {
    action: LocalRpcAction;
    chainId: number;
    seconds?: number;
    fromAddress?: string;
    targetAddress?: string;
    amountEth?: string;
  }) => Promise<void>;
  onActivateRpcAccount?: (address: string, chainId: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium px-3 py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 hover:border-sky-500/50 dark:hover:border-emerald-500/50 transition-colors"
      >
        <span>+ Connect a wallet</span>
        <FiChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expandable options */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-1 pt-1">
              {/* Native wagmi connectors (extensions + WalletConnect) */}
              <DirectConnectors
                connectedIds={connectedIds}
                connectedConnectorNames={connectedConnectorNames}
                onAfterConnect={onAfterConnect}
              />

              {/* Reown / AppKit — social, email, more wallets */}
              <ConnectWalletButton
                hasWallets={hasWallets}
                previousAuthProvider={previousAuthProvider}
                onRestore={onRestoreAppKit}
                onBeforeOpen={onBeforeOpenAppKit}
              />

              {/* Local dev RPC accounts + tools (Anvil/Ganache) */}
              {showLocalRpcOption && onAddLocalRpcWallet && onRunLocalRpcAction && (
                <LocalDevTools
                  busy={!!localRpcBusy}
                  error={localRpcError}
                  notice={localRpcNotice}
                  snapshots={localRpcSnapshots ?? {}}
                  addedKeys={new Set(localRpcAddedKeys ?? [])}
                  activeEvmAddress={activeEvmAddress}
                  onAddWallet={onAddLocalRpcWallet}
                  onRunAction={onRunLocalRpcAction}
                  onActivateRpcAccount={onActivateRpcAccount}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DevChainStatus — real-time reachability indicator for local chains  */
/* ------------------------------------------------------------------ */

type ChainStatus = 'checking' | 'online' | 'offline';

function DevChainStatusIndicator() {
  const [chains, setChains] = useState<Record<number, ChainStatus>>({
    31337: 'checking',
    1337: 'checking',
  });

  const checkChain = useCallback(async (chainId: number, rpcUrl: string): Promise<ChainStatus> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        if (json?.result) return 'online';
      }
      return 'offline';
    } catch {
      return 'offline';
    }
  }, []);

  const checkAll = useCallback(async () => {
    setChains({ 31337: 'checking', 1337: 'checking' });
    const [anvil, ganache] = await Promise.all([
      checkChain(31337, process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'),
      checkChain(1337, process.env.NEXT_PUBLIC_GANACHE_RPC_URL ?? 'http://127.0.0.1:7545'),
    ]);
    setChains({ 31337: anvil, 1337: ganache });
  }, [checkChain]);

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 15000); // Re-check every 15s
    return () => clearInterval(interval);
  }, [checkAll]);

  const statusDot = (s: ChainStatus) => {
    if (s === 'checking') return 'bg-zinc-500 animate-pulse';
    if (s === 'online') return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
    return 'bg-red-500/60';
  };

  const statusText = (s: ChainStatus) => {
    if (s === 'checking') return 'Checking…';
    if (s === 'online') return 'Online';
    return 'Offline';
  };

  const anyOnline = chains[31337] === 'online' || chains[1337] === 'online';

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
          Dev Chains
        </span>
        <button
          type="button"
          onClick={checkAll}
          className="p-0.5 rounded hover:bg-zinc-700/40 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Refresh chain status"
        >
          <FiRefreshCw className="h-2.5 w-2.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {([
          { id: 31337, name: 'Anvil', port: '8545' },
          { id: 1337, name: 'Ganache', port: '7545' },
        ] as const).map((c) => (
          <div
            key={c.id}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors ${
              chains[c.id] === 'online'
                ? 'bg-emerald-500/5 text-emerald-400'
                : 'bg-zinc-800/40 text-zinc-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(chains[c.id])}`} />
            <span className="font-medium">{c.name}</span>
            <span className="text-[8px] opacity-60">:{c.port}</span>
          </div>
        ))}
      </div>
      {!anyOnline && (
        <p className="text-[9px] text-zinc-500 leading-relaxed">
          Start a local chain: <code className="text-zinc-400">npx ganache</code> or <code className="text-zinc-400">anvil</code>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Web3EnablePrompt — shown when web3 mode is disabled                */
/* ------------------------------------------------------------------ */
function Web3EnablePrompt() {
  const [enabling, setEnabling] = useState(false);
  const [done, setDone] = useState(false);
  const [authError, setAuthError] = useState(false);

  const handleEnable = async () => {
    setEnabling(true);
    setAuthError(false);
    try {
      const res = await fetch('/api/settings/web3-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      if (res.status === 401 || res.status === 403) {
        setAuthError(true);
        setEnabling(false);
        return;
      }
      if (res.ok) {
        // Sync to localStorage for immediate UI effect
        try { localStorage.setItem('veggastare:web3ModeEnabled', 'true'); } catch { /* ok */ }
        setDone(true);
        // Reload to refresh session token (web3ModeEnabled flows through JWT)
        setTimeout(() => window.location.reload(), 600);
      }
    } catch { /* ignore */ }
    setEnabling(false);
  };

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
        <p className="text-[11px] text-emerald-400 font-medium">Web3 enabled! Refreshing…</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-2">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
        Web3 is currently disabled. Enable it to connect wallets, trade tokens, and accept crypto payments.
      </p>
      {authError && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
          Session expired — please sign in again to enable Web3.
        </p>
      )}
      <button
        type="button"
        onClick={handleEnable}
        disabled={enabling}
        className="w-full rounded-lg bg-sky-500 dark:bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-600 dark:hover:bg-emerald-500 transition-colors disabled:opacity-50"
      >
        {enabling ? 'Enabling…' : 'Enable Web3'}
      </button>
      <Link
        href="/settings?section=wallet"
        className="block text-center text-[10px] text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 transition-colors"
      >
        or go to Settings →
      </Link>
    </div>
  );
}

function LocalDevTools({
  busy,
  error,
  notice,
  snapshots,
  addedKeys,
  activeEvmAddress,
  onAddWallet,
  onRunAction,
  onActivateRpcAccount,
}: {
  busy: boolean;
  error?: string | null;
  notice?: string | null;
  snapshots: Record<number, string | number | null>;
  addedKeys: Set<string>;
  activeEvmAddress?: string | null;
  onAddWallet: (opts?: { chainId?: number; addAll?: boolean; address?: string }) => Promise<void>;
  onRunAction: (opts: {
    action: LocalRpcAction;
    chainId: number;
    seconds?: number;
    fromAddress?: string;
    targetAddress?: string;
    amountEth?: string;
  }) => Promise<void>;
  onActivateRpcAccount?: (address: string, chainId: number) => void;
}) {
  const [selectedChainId, setSelectedChainId] = useState<number>(31337);
  const [secondsInput, setSecondsInput] = useState("3600");
  const [availableAccounts, setAvailableAccounts] = useState<LocalRpcAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [balanceAddress, setBalanceAddress] = useState("");
  const [balanceEth, setBalanceEth] = useState("100");
  const [sendFromAddress, setSendFromAddress] = useState("");
  const [sendTargetAddress, setSendTargetAddress] = useState("");
  const [sendAmountEth, setSendAmountEth] = useState("1");
  const [localDevExpanded, setLocalDevExpanded] = useState(false);
  const [sendingTx, setSendingTx] = useState(false);

  const selectedChainName = localChainName(selectedChainId) ?? `Chain ${selectedChainId}`;
  const selectedAccounts = availableAccounts.filter((account) => account.chainId === selectedChainId);

  useEffect(() => {
    if (!balanceAddress && activeEvmAddress) {
      setBalanceAddress(activeEvmAddress);
    }
  }, [activeEvmAddress, balanceAddress]);

  useEffect(() => {
    if (!sendTargetAddress && activeEvmAddress) {
      setSendTargetAddress(activeEvmAddress);
    }
  }, [activeEvmAddress, sendTargetAddress]);

  useEffect(() => {
    let alive = true;
    setLoadingAccounts(true);
    fetchLocalRpcAccounts()
      .then((accounts) => {
        if (!alive) return;
        setAvailableAccounts(accounts);
      })
      .catch(() => {
        if (!alive) return;
        setAvailableAccounts([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoadingAccounts(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedChainId, busy, notice]);

  useEffect(() => {
    if (selectedAccounts.length === 0) {
      setSendFromAddress("");
      return;
    }
    const hasCurrent = sendFromAddress
      ? selectedAccounts.some((account) => account.address.toLowerCase() === sendFromAddress.toLowerCase())
      : false;
    if (!hasCurrent) {
      setSendFromAddress(selectedAccounts[0].address);
    }
  }, [selectedAccounts, sendFromAddress]);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 space-y-2">
      <button
        type="button"
        onClick={() => setLocalDevExpanded((p) => !p)}
        className="flex items-center justify-between gap-1.5 px-1 w-full hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-1.5">
          <FiTerminal className="h-3.5 w-3.5 text-sky-500 dark:text-emerald-400" />
          <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">Local Dev Chains</span>
          {selectedAccounts.length > 0 && (
            <span className="text-[8px] text-zinc-500 dark:text-zinc-400">
              ({selectedAccounts.length})
            </span>
          )}
        </div>
        <FiChevronDown className={`h-3 w-3 text-zinc-500 transition-transform ${localDevExpanded ? "rotate-180" : ""}`} />
      </button>

      {localDevExpanded && (
      <><div className="px-1">
        <select
          value={selectedChainId}
          onChange={(event) => setSelectedChainId(Number(event.target.value))}
          className="w-full appearance-none rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300"
        >
          {LOCAL_RPC_SOURCES.map((source) => (
            <option key={source.chainId} value={source.chainId}>
              {source.chainName} ({source.rpcUrl})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAddWallet({ chainId: selectedChainId, addAll: false })}
          className="flex items-center justify-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-sky-500 dark:hover:text-emerald-400 disabled:opacity-50"
        >
          <FiPlusCircle className="h-3 w-3" /> Add first
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAddWallet({ chainId: selectedChainId, addAll: true })}
          className="flex items-center justify-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-sky-500 dark:hover:text-emerald-400 disabled:opacity-50"
        >
          <FiPlusCircle className="h-3 w-3" /> Add all
        </button>
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-1.5 space-y-1">
        <p className="text-[9px] text-zinc-500 dark:text-zinc-400">
          Available Accounts · {selectedChainName}
        </p>
        {loadingAccounts ? (
          <p className="text-[9px] text-zinc-400 dark:text-zinc-500">Loading local RPC accounts…</p>
        ) : selectedAccounts.length === 0 ? (
          <p className="text-[9px] text-zinc-400 dark:text-zinc-500">No accounts detected. Start the local node first.</p>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {selectedAccounts.slice(0, 10).map((account) => {
              const addedKey = `${account.chainId}:${account.address.toLowerCase()}`;
              const isAdded = addedKeys.has(addedKey);
              const isActive =
                !!activeEvmAddress && activeEvmAddress.toLowerCase() === account.address.toLowerCase();

              return (
                <div
                  key={addedKey}
                  className={`flex items-center justify-between gap-1 rounded-md border px-1.5 py-1 ${
                    isActive
                      ? "border-orange-500/60 bg-orange-500/10 dark:border-orange-500/50 dark:bg-orange-500/10"
                      : isAdded
                        ? "border-orange-400/40 dark:border-orange-500/30 bg-orange-500/5"
                        : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-[9px] font-mono truncate ${isActive ? "text-orange-400" : isAdded ? "text-orange-300/80" : "text-zinc-600 dark:text-zinc-300"}`}>
                      {account.address}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[8px] ${isActive ? "text-orange-400" : isAdded ? "text-orange-400/60" : "text-zinc-400 dark:text-zinc-500"}`}>
                        {isActive ? "⚡ Active" : isAdded ? "✔ In wallet list" : "Not added"}
                      </p>
                      {account.balanceEth && (
                        <p className="text-[8px] font-medium text-orange-400 dark:text-orange-400">
                          {account.balanceEth} ETH
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Activate button — only for added (not yet active) accounts */}
                    {isAdded && !isActive && onActivateRpcAccount && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onActivateRpcAccount(account.address, account.chainId)}
                        className="rounded-md border border-orange-500/50 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 disabled:opacity-50 transition-colors"
                        title="Set this account as the active wallet — inventory will show this wallet's tokens"
                      >
                        Activate
                      </button>
                    )}
                    {/* Add / Active badge */}
                    <button
                      type="button"
                      disabled={busy || isActive || isAdded}
                      onClick={() =>
                        void onAddWallet({
                          chainId: account.chainId,
                          addAll: false,
                          address: account.address,
                        })
                      }
                      className={`rounded-md border px-1.5 py-0.5 text-[9px] disabled:opacity-50 ${
                        isActive
                          ? "border-orange-500/40 text-orange-400 cursor-default"
                          : isAdded
                            ? "border-orange-500/30 text-orange-400/50 cursor-default"
                            : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400"
                      }`}
                      title={isActive ? "This account is currently active" : isAdded ? "Already in your wallet list" : "Add this account to your wallet list"}
                    >
                      {isActive ? "Active" : isAdded ? "Added" : "Add"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRunAction({ action: "mine", chainId: selectedChainId })}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-50 transition-colors"
          title="Mine a new block on the local chain — triggers pending transactions and block-dependent logic"
        >
          <FiRefreshCw className="inline h-2.5 w-2.5 mr-1" /> Mine 1 block
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-0.5">Send ETH between accounts</p>
        <select
          value={sendFromAddress}
          onChange={(event) => setSendFromAddress(event.target.value)}
          className="w-full appearance-none rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300"
          title="Select the source account to send from"
        >
          {selectedAccounts.map((account) => (
            <option key={`from-${account.chainId}-${account.address.toLowerCase()}`} value={account.address}>
              {account.address}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-[1fr_92px] gap-1 items-center">
          <input
            value={sendTargetAddress}
            onChange={(event) => setSendTargetAddress(event.target.value)}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500/40"
            placeholder="0x45Ce…8C99"
            title="Recipient address — paste a 0x address from the accounts above or any wallet"
          />
          <input
            value={sendAmountEth}
            onChange={(event) => setSendAmountEth(event.target.value)}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 text-right focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500/40"
            placeholder="e.g. 1.5"
            title="Amount in ETH to send (e.g. 0.5, 1, 100)"
            type="text"
            inputMode="decimal"
          />
        </div>
        <button
          type="button"
          disabled={busy || sendingTx || !sendFromAddress || !sendTargetAddress || !sendAmountEth}
          onClick={async () => {
            setSendingTx(true);
            try {
              await onRunAction({
                action: "send-from-account",
                chainId: selectedChainId,
                fromAddress: sendFromAddress,
                targetAddress: sendTargetAddress,
                amountEth: sendAmountEth,
              });
              // Success: reset amount, show toast
              const prevAmount = sendAmountEth;
              setSendAmountEth("1");
              toast.success(
                `Sent ${prevAmount} ETH from ${sendFromAddress.slice(0, 6)}…${sendFromAddress.slice(-4)} to ${sendTargetAddress.slice(0, 6)}…${sendTargetAddress.slice(-4)}`,
                { duration: 5000 },
              );
            } catch {
              // Error is already handled by onRunAction (sets localRpcError)
            } finally {
              setSendingTx(false);
            }
          }}
          className={`w-full rounded-md border px-2 py-1.5 text-[10px] font-medium transition-all disabled:opacity-50 ${
            sendingTx
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400 animate-pulse"
              : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400 hover:border-orange-500/40"
          }`}
          title="Send ETH via local RPC — no wallet approval needed for dev accounts"
        >
          {sendingTx ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-orange-400 border-t-transparent" />
              Sending…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1"><FiSend className="h-2.5 w-2.5" /> Send test transfer</span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-1 items-center">
        <input
          value={balanceEth}
          onChange={(event) => setBalanceEth(event.target.value)}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 focus:ring-1 focus:ring-orange-500/40"
          placeholder="e.g. 100 (ETH)"
          title="Amount in ETH to set as the wallet's balance"
        />
        <button
          type="button"
          disabled={busy || !activeEvmAddress}
          onClick={() => {
            if (!activeEvmAddress) return;
            void onRunAction({
              action: "set-balance",
              chainId: selectedChainId,
              targetAddress: activeEvmAddress,
              amountEth: balanceEth,
            });
          }}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-50 transition-colors"
          title={activeEvmAddress ? `Instantly set ${activeEvmAddress.slice(0, 6)}…${activeEvmAddress.slice(-4)} balance to ${balanceEth} ETH (no tx needed)` : "Connect an active EVM wallet first"}
        >
          Fund active wallet
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-1 items-center">
        <input
          value={secondsInput}
          onChange={(event) => setSecondsInput(event.target.value)}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 focus:ring-1 focus:ring-orange-500/40"
          placeholder="e.g. 3600 (1 hour)"
          title="Number of seconds to fast-forward the chain's clock"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRunAction({ action: "increase-time", chainId: selectedChainId, seconds: Number(secondsInput) || 0 })}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-50 transition-colors"
          title="Fast-forward the local chain clock by the specified seconds — useful for testing time-locked contracts"
        >
          <FiClock className="inline h-2.5 w-2.5 mr-1" /> +Time
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRunAction({ action: "snapshot", chainId: selectedChainId })}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-50 transition-colors"
          title="Save the current chain state — you can revert back to this point later"
        >
          Snapshot
        </button>
        <button
          type="button"
          disabled={busy || snapshots[selectedChainId] == null}
          onClick={() => void onRunAction({ action: "revert", chainId: selectedChainId })}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-50 transition-colors"
          title={snapshots[selectedChainId] != null ? "Revert the chain to the last snapshot — undoes all transactions since then" : "Take a snapshot first before reverting"}
        >
          Revert snapshot
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-0.5">Set arbitrary balance</p>
        <input
          value={balanceAddress}
          onChange={(event) => setBalanceAddress(event.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 focus:ring-1 focus:ring-orange-500/40"
          placeholder="0x… (target address)"
          title="The address whose balance will be overwritten — defaults to your active wallet"
        />
        <div className="grid grid-cols-[1fr_auto] gap-1 items-center">
          <input
            value={balanceEth}
            onChange={(event) => setBalanceEth(event.target.value)}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 focus:ring-1 focus:ring-orange-500/40"
            placeholder="e.g. 100 (ETH)"
            title="New balance in ETH — overwrites the current balance entirely"
          />
          <button
            type="button"
            disabled={busy || !balanceAddress}
            onClick={() => void onRunAction({ action: "set-balance", chainId: selectedChainId, targetAddress: balanceAddress, amountEth: balanceEth })}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:text-orange-400 dark:hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-50 transition-colors"
            title={`Overwrite the balance of ${balanceAddress || 'target address'} on ${selectedChainName} — anvil_setBalance / hardhat_setBalance`}
          >
            Set balance
          </button>
        </div>
      </div>

      {(error || notice) && (
        <p className={`px-1 text-[9px] ${error ? "text-red-500 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
          {error ?? notice}
        </p>
      )}
      </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WaitingDots — animated "Waiting." → "Waiting.." → "Waiting..."     */
/* ------------------------------------------------------------------ */

function WaitingDots({ prefix = "Waiting" }: { prefix?: string }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      <span>{prefix}</span>
      <span className="inline-block w-[3ch] text-left whitespace-pre">{".".repeat(dots).padEnd(3, " ")}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  VerifyActionRow — inline verification flow with animated states    */
/* ------------------------------------------------------------------ */

function VerifyActionRow({
  step,
  error,
  onVerify,
  onReset,
  nextTierCta,
}: {
  step: VerifyStep;
  error: string | null;
  onVerify: () => void;
  onReset: () => void;
  nextTierCta?: string;
}) {
  // After success, show the next tier CTA (e.g. "Grab a buff for $5 donation →")
  if (step === "success") {
    return (
      <div className="text-center space-y-1">
        <span className="text-[9px] font-semibold text-sky-600 dark:text-emerald-400">
          ✓ Verified
        </span>
        {nextTierCta && nextTierCta !== "Max tier reached" && (
          <button
            type="button"
            onClick={onReset}
            className="block w-full text-[9px] text-sky-500 dark:text-emerald-400 hover:underline"
          >
            {nextTierCta}
          </button>
        )}
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="text-center space-y-0.5">
        <span className="text-[9px] text-red-500 dark:text-red-400 block">
          {error ?? "Failed"}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[9px] text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step === "preparing") {
    return (
      <div className="text-center flex items-center justify-center gap-1.5">
        <span className="text-[9px] text-sky-500 dark:text-emerald-400 font-medium">
          <WaitingDots prefix="Preparing request" />
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[9px] text-zinc-400 hover:text-red-400 transition-colors"
          title="Cancel"
        >
          ✕
        </button>
      </div>
    );
  }

  if (step === "in-wallet") {
    return (
      <div className="text-center flex items-center justify-center gap-1.5">
        <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium animate-pulse">
          Waiting for wallet signature…
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[9px] text-zinc-400 hover:text-red-400 transition-colors"
          title="Cancel"
        >
          ✕
        </button>
      </div>
    );
  }

  if (step === "waiting") {
    return (
      <div className="text-center">
        <span className="text-[9px] text-sky-500 dark:text-emerald-400 font-medium">
          <WaitingDots prefix="Validating signature" />
        </span>
      </div>
    );
  }

  // idle — show CTA
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onVerify}
        className="text-[9px] text-sky-500 dark:text-emerald-400 hover:underline transition-colors"
      >
        Verify with free signature →
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DonateActionRow — inline donation flow with animated states        */
/* ------------------------------------------------------------------ */

function DonateActionRow({
  step,
  error,
  ctaText,
  onDonate,
  onReset,
}: {
  step: DonateStep;
  error: string | null;
  ctaText: string;
  onDonate: () => void;
  onReset: () => void;
}) {
  if (step === "success") {
    return (
      <div className="text-center">
        <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
          ✓ Donation recorded!
        </span>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="text-center space-y-0.5">
        <span className="text-[9px] text-red-500 dark:text-red-400 block">
          {error ?? "Failed"}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[9px] text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step === "sending") {
    return (
      <div className="text-center flex items-center justify-center gap-1.5">
        <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium animate-pulse">
          Confirm in wallet…
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[9px] text-zinc-400 hover:text-red-400 transition-colors"
          title="Cancel"
        >
          ✕
        </button>
      </div>
    );
  }

  if (step === "confirming") {
    return (
      <div className="text-center">
        <span className="text-[9px] text-sky-500 dark:text-emerald-400 font-medium">
          <WaitingDots prefix="On-chain" />
        </span>
      </div>
    );
  }

  if (step === "recording") {
    return (
      <div className="text-center">
        <span className="text-[9px] text-sky-500 dark:text-emerald-400 font-medium">
          <WaitingDots prefix="Recording" />
        </span>
      </div>
    );
  }

  // idle — show donate CTA
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onDonate}
        className="text-[9px] text-amber-500 dark:text-amber-400 hover:underline transition-colors"
      >
        {ctaText}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TierBadge — shows current wallet buff tier                         */
/* ------------------------------------------------------------------ */

function TierBadge({ tier }: { tier: WalletBuffTier }) {
  const def = getTierDef(tier);
  const colors = tierColorClasses(tier);
  if (tier === "CONNECTED") return null; // No badge for unverified

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider px-1 py-px rounded font-semibold shrink-0 ${colors.bg} ${colors.text}`}
    >
      <span className="text-[7px]">{def.badge}</span>
      {def.label}
    </span>
  );
}
/*  WalletRow — active indicator, set-active, expand, verify inline    */
/* ------------------------------------------------------------------ */

function WalletRow({
  label,
  customLabel,
  family,
  address,
  isLive,
  isActive,
  isDefault,
  verified,
  donationTotalUsd,
  dbWalletId,
  donateStep,
  donateError,
  onDonate,
  onDonateReset,
  chainName,
  chainId,
  chains,
  onSwitchChain,
  switchPending,
  onDisconnect,
  canDisconnect,
  onVerified,
  onSetActive,
  onTransfer,
  onRename,
  connectorName,
  connectorType,
  connectorUid,
  connectorIcon,
  authProvider,
  socialName,
  socialEmail,
  userName,
  summaryNativeBalance,
  summaryTokenCount,
  summaryPortfolioValue,
}: {
  label: string;
  customLabel?: string;
  family: string;
  address: string;
  isLive?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
  verified?: boolean;
  donationTotalUsd?: number;
  dbWalletId?: string;
  donateStep?: DonateStep;
  donateError?: string | null;
  onDonate?: () => void;
  onDonateReset?: () => void;
  chainName?: string;
  chainId?: number;
  chains?: { id: number; name: string }[];
  onSwitchChain?: (chainId: number) => void;
  switchPending?: boolean;
  onDisconnect?: () => void;
  canDisconnect?: boolean;
  onVerified?: () => void;
  onSetActive?: () => void;
  onTransfer?: () => void;
  onRename?: (newName: string) => void;
  connectorName?: string;
  connectorType?: string;
  connectorUid?: string;
  connectorIcon?: string;
  authProvider?: string;
  socialName?: string;
  socialEmail?: string;
  userName?: string | null;
  summaryNativeBalance?: string;
  summaryTokenCount?: number;
  summaryPortfolioValue?: string;
}) {
  const [netOpen, setNetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(customLabel ?? '');

  // Resolve ENS name for EVM addresses (free read call, mainnet)
  const { data: ensName } = useEnsName({
    address: family === "EVM" ? (address as `0x${string}`) : undefined,
    chainId: 1,
  });

  // Resolve Coinbase Basename (CB.ID) on Base chain (chain 8453)
  // CB.ID names like v3gga.cb.id use ENS infrastructure on Base
  const { data: baseName } = useEnsName({
    address: family === "EVM" ? (address as `0x${string}`) : undefined,
    chainId: 8453,
  });

  // Use whichever name resolved (prefer ENS mainnet, fallback to Base)
  const resolvedName = ensName || baseName;

  // Inline signature verification flow — pass connectorUid so the CORRECT wallet extension opens
  const { step: verifyStep, error: verifyError, verify, reset: verifyReset } = useWalletVerify({
    address: family === "EVM" ? address : undefined,
    chainId: family === "EVM" ? chainId : undefined,
    connectorUid: isLive ? connectorUid : undefined,
    authProvider,
    socialEmail,
    onSuccess: onVerified,
  });

  // Resolve wallet buff tier
  const walletTier = resolveWalletTier(!!verified, donationTotalUsd ?? 0);
  const nextTier = getNextTier(walletTier);

  // Build display name: customLabel → connector name → DB label → fallback
  // AUTH wallets always show "Reown" — social username is shown below the name.
  const isAuthWallet = connectorType === 'AUTH' || connectorName === 'Auth';
  const normalizedAuthProvider = authProvider?.trim().toLowerCase();
  const authProviderName = isAuthWallet && normalizedAuthProvider
    ? authProviderLabel(normalizedAuthProvider)
    : null;

  const baseDisplayName = isAuthWallet
    ? 'Reown'
    : connectorName
      ? connectorLabel(connectorName)
      : label || "Wallet";
  // LOCAL_RPC always shows "Local RPC" as title — custom label goes to subtitle
  const displayName = connectorType === 'LOCAL_RPC' ? baseDisplayName : (customLabel || baseDisplayName);

  // Build "via" source label — non-AUTH connectors only
  const viaLabel = !isAuthWallet && connectorType && connectorType !== 'LOCAL_RPC'
    ? connectorSource(connectorType, connectorName)
    : null;
  const viaIconSrc = viaLabel ? connectorIconUrl(connectorName ?? family, connectorIcon) : null;
  const sourceMethodLabel = isAuthWallet
    ? authProviderName
    : viaLabel;
  const sourceIconSrc = isAuthWallet && normalizedAuthProvider && AUTH_PROVIDER_ICONS[normalizedAuthProvider]
    ? AUTH_PROVIDER_ICONS[normalizedAuthProvider]
    : viaIconSrc;

  return (
    <div
      className={`group/row relative rounded-lg border transition-colors ${
        isActive
          ? connectorType === 'LOCAL_RPC'
            ? "border-orange-500/50 dark:border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/15"
            : "border-sky-500/50 dark:border-emerald-500/50 bg-sky-50/50 dark:bg-emerald-950/20"
          : isLive
              ? "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60"
              : "border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-900/45"
      }`}
    >
      {/* Active badge — absolute top-right corner */}
      {isActive && (
        <div className="absolute -top-1.5 right-2 flex items-center gap-1">
          {connectorType === 'LOCAL_RPC' && (
            <span className="flex items-center gap-0.5 px-1.5 py-px rounded text-[8px] font-bold uppercase tracking-wider text-white bg-orange-500">
              <FiTerminal className="h-2.5 w-2.5" />
              &gt;_RPC
            </span>
          )}
          <span className={`flex items-center gap-0.5 px-1.5 py-px rounded text-[8px] font-bold uppercase tracking-wider text-white ${
            connectorType === 'LOCAL_RPC'
              ? "bg-emerald-500"
              : "bg-sky-500 dark:bg-emerald-500"
          }`}>
            <FiPower className="h-2.5 w-2.5 drop-shadow-[0_0_4px_currentColor]" />
            Active
          </span>
        </div>
      )}

      {/* Set-active / reconnect button — unified for all non-active wallets */}
      {!isActive && onSetActive && (
        <div className="absolute -top-1.5 right-2 flex items-center gap-1">
          {connectorType === 'LOCAL_RPC' && (
            <span className="flex items-center gap-0.5 px-1.5 py-px rounded text-[8px] font-bold uppercase tracking-wider text-white bg-orange-500">
              <FiTerminal className="h-2.5 w-2.5" />
              &gt;_RPC
            </span>
          )}
          <button
            type="button"
            onClick={onSetActive}
            className={`flex items-center gap-0.5 px-1.5 py-px rounded text-[8px] font-medium uppercase tracking-wider transition-colors cursor-pointer ${
              isLive
                ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-sky-500 dark:hover:bg-emerald-500 hover:text-white"
                : "bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-sky-500 dark:hover:bg-emerald-500 hover:text-white"
            }`}
            title={connectorType === 'LOCAL_RPC' ? "Local dev wallet — operates via direct RPC calls" : isLive ? "Switch to this wallet" : "Reconnect and activate"}
          >
            {connectorType === 'LOCAL_RPC' ? (
              <><FiTerminal className="h-2.5 w-2.5" /> Activate</>
            ) : (
              <><FiPower className="h-2.5 w-2.5" /> Activate</>
            )}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        {/* Wallet brand icon — AUTH wallets get Reown + auth provider overlay */}
        {isAuthWallet && normalizedAuthProvider ? (
          <div className="relative shrink-0" style={{ width: 22, height: 22 }}>
            <WalletIcon src={REOWN_ICON_DATA_URI} alt="Reown" size={22} />
            {AUTH_PROVIDER_ICONS[normalizedAuthProvider] && (
              <div className="absolute -bottom-1 -right-1 rounded-full border border-white dark:border-zinc-900 bg-white dark:bg-zinc-900" style={{ padding: 1 }}>
                <WalletIcon src={AUTH_PROVIDER_ICONS[normalizedAuthProvider]} alt={authProviderLabel(normalizedAuthProvider)} size={11} />
              </div>
            )}
          </div>
        ) : connectorIcon || connectorName ? (
          <WalletIcon
            src={connectorIconUrl(connectorName ?? '', connectorIcon)}
            alt={connectorLabel(connectorName ?? family)}
            size={18}
          />
        ) : (
          <span
            className="text-sm shrink-0"
            style={{ color: chainColor(family) }}
            title={family}
          >
            {chainIcon(family)}
          </span>
        )}

        {/* Info column */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Title + via source + badge */}
          <div className="flex items-center gap-1">
            <span
              className="inline-flex items-center gap-1 shrink-0"
              title={`${displayName}${sourceMethodLabel ? ` (via ${sourceMethodLabel})` : ""}${label && label !== displayName ? ` — ${label}` : ""}`}
            >
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shrink-0">
                {displayName}
              </span>
              {sourceMethodLabel && (
                <span className="inline-flex items-center gap-0.5 text-[8px] text-zinc-400 dark:text-zinc-500 shrink-0 whitespace-nowrap">
                  <span>via</span>
                  {sourceIconSrc && <WalletIcon src={sourceIconSrc} alt={sourceMethodLabel} size={10} />}
                  <span>{sourceMethodLabel}</span>
                </span>
              )}
            </span>
            {isDefault && (
              <span className="text-[8px] uppercase tracking-wider px-1 py-px rounded bg-sky-500/10 dark:bg-emerald-500/10 text-sky-600 dark:text-emerald-400 font-semibold shrink-0">
                Primary
              </span>
            )}
            <span className="flex-1" />
            {walletTier !== "CONNECTED" ? (
              <TierBadge tier={walletTier} />
            ) : isLive ? (
              <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider px-1 py-px rounded bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 font-semibold shrink-0 whitespace-nowrap">
                <FiShield className="h-2 w-2 opacity-60" />
                Unverified
              </span>
            ) : null}
          </div>

          {/* Row 2: Subtitle — contextual per wallet type */}
          {/* ENS / CB.ID */}
          {resolvedName && (
            <span
              className="text-[10px] font-medium text-sky-600 dark:text-emerald-400 block truncate"
              title={ensName ? `ENS: ${ensName}` : `CB.ID: ${baseName}`}
            >
              {resolvedName}
            </span>
          )}
          {/* AUTH wallets: user display name + email */}
          {isAuthWallet && (userName || socialName || socialEmail) && (
            <span
              className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate"
              title={[userName, socialName, socialEmail].filter(Boolean).join(' · ')}
            >
              {(() => {
                const displayUserName = userName || socialName;
                if (displayUserName && socialEmail && displayUserName.toLowerCase() !== socialEmail.toLowerCase())
                  return `${displayUserName} · ${socialEmail}`;
                return displayUserName || socialEmail;
              })()}
            </span>
          )}

          {/* Inline rename — available for ALL wallet types on hover */}
          {onRename && (
            <span className="flex items-center gap-1">
              {renaming ? (
                <span className="flex items-center gap-0.5">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRename?.(renameValue);
                        setRenaming(false);
                      } else if (e.key === 'Escape') {
                        setRenameValue(customLabel ?? '');
                        setRenaming(false);
                      }
                    }}
                    maxLength={40}
                    placeholder={label || "Wallet name"}
                    className={`w-24 rounded border bg-white dark:bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 outline-none ${
                      connectorType === 'LOCAL_RPC'
                        ? "border-orange-400 dark:border-orange-500"
                        : "border-sky-400 dark:border-emerald-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => { onRename?.(renameValue); setRenaming(false); }}
                    className={`p-0.5 rounded ${
                      connectorType === 'LOCAL_RPC'
                        ? "hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-500 dark:text-orange-400"
                        : "hover:bg-sky-100 dark:hover:bg-emerald-900/40 text-sky-500 dark:text-emerald-400"
                    }`}
                    title="Save"
                  >
                    <FiCheck className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRenameValue(customLabel ?? ''); setRenaming(false); }}
                    className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400"
                    title="Cancel"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </span>
              ) : customLabel ? (
                <>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                    {customLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setRenameValue(customLabel ?? ''); setRenaming(true); }}
                    className={`p-0.5 rounded opacity-0 group-hover/row:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 transition-opacity ${
                      connectorType === 'LOCAL_RPC' ? "hover:text-orange-400" : "hover:text-sky-500 dark:hover:text-emerald-400"
                    }`}
                    title="Rename wallet"
                  >
                    <FiEdit2 className="h-2.5 w-2.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { setRenameValue(''); setRenaming(true); }}
                  className={`p-0.5 rounded opacity-0 group-hover/row:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 transition-opacity ${
                    connectorType === 'LOCAL_RPC' ? "hover:text-orange-400" : "hover:text-sky-500 dark:hover:text-emerald-400"
                  }`}
                  title="Name this wallet"
                >
                  <FiEdit2 className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          )}

          {/* Browser / extension wallets: DB label as subtitle when no custom name set */}
          {!customLabel && !isAuthWallet && connectorType !== 'LOCAL_RPC' && label && label !== displayName && !resolvedName && (
            <span
              className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate"
              title={label}
            >
              {label}
            </span>
          )}
          {/* Address + copy + inline actions */}
          <span className="flex items-center gap-1">
            <span
              className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate"
              title={address}
            >
              {trimAddress(address)}
            </span>
            <CopyChip text={address} label="Copy address" size="xs" />

            {/* Transfer / Fund button */}
            {onTransfer && (((isActive && isLive && family === "EVM") || connectorType === 'LOCAL_RPC') || (!isActive && family === "EVM")) && (
              <button
                type="button"
                onClick={onTransfer}
                className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium transition-colors shrink-0 ${
                  isActive
                    ? connectorType === 'LOCAL_RPC'
                      ? "text-orange-400 hover:bg-orange-950/30"
                      : "text-sky-600 dark:text-emerald-400 hover:bg-sky-50 dark:hover:bg-emerald-950/30"
                    : "text-zinc-500 hover:text-amber-400 hover:bg-amber-950/20"
                }`}
                title={
                  isActive
                    ? connectorType === 'LOCAL_RPC' ? "Transfer via Local RPC" : "Transfer to another linked wallet"
                    : "Fund this wallet from the active wallet"
                }
              >
                <FiSend className="h-2.5 w-2.5" />
                {isActive ? "Transfer" : "Fund"}
              </button>
            )}

            {/* Network switcher */}
            {isLive && isActive && family === "EVM" && chains && chains.length > 1 && onSwitchChain && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setNetOpen((o) => !o)}
                  className="rounded px-1 py-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-[9px] flex items-center gap-0.5 text-zinc-500 dark:text-zinc-400"
                  title="Switch network"
                >
                  <span className="max-w-16 truncate">{chainName ?? "Network"}</span>
                  <FiChevronDown className={`h-2.5 w-2.5 transition-transform ${netOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {netOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 z-50 min-w-32.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1"
                    >
                      {chains.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={switchPending}
                          onClick={() => {
                            if (c.id !== chainId) onSwitchChain(c.id);
                            setNetOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                            c.id === chainId
                              ? "text-sky-600 dark:text-emerald-400 font-medium bg-sky-50 dark:bg-emerald-950/30"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          } ${switchPending ? "opacity-50 cursor-wait" : ""}`}
                        >
                          {isLocalChain(c.id) && <span className="font-mono font-bold text-amber-500 dark:text-amber-400 mr-1">&gt;_RPC</span>}
                          {c.name}
                          {c.id === chainId ? " ✓" : ""}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Expand/collapse */}
            {isLive && family === "EVM" && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
                title={expanded ? "Collapse" : "Show wallet details"}
              >
                <FiChevronDown className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </span>
          {isActive && summaryNativeBalance && (
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block truncate">
              {summaryNativeBalance}
              {typeof summaryTokenCount === "number" && ` · ${summaryTokenCount} token${summaryTokenCount === 1 ? "" : "s"}`}
              {summaryPortfolioValue ? ` · ${summaryPortfolioValue}` : ""}
            </span>
          )}
          {!isActive && connectorType === 'LOCAL_RPC' && summaryNativeBalance && (
            <span className="text-[10px] text-orange-400/80 dark:text-orange-400/70 block truncate">
              {summaryNativeBalance}
              {typeof summaryTokenCount === "number" && ` · ${summaryTokenCount} token${summaryTokenCount === 1 ? "" : "s"}`}
            </span>
          )}
        </div>

      </div>

      {/* Combined: chain info (left) + verify/tier CTA (right) */}
      {((isActive && chainName) || (isLive && family === "EVM")) && (
        <div className="flex items-center px-3 pb-1.5 -mt-0.5 gap-2">
          {isActive && chainName && (
            <span className={`text-[9px] shrink-0 inline-flex items-center gap-1 ${
              isLocalChain(chainId) ? "text-amber-500 dark:text-amber-400 font-medium" : "text-zinc-400 dark:text-zinc-500"
            }`}>
              {isLocalChain(chainId) && <span className="font-mono font-bold">&gt;_RPC</span>}
              on {chainName} (ID: {chainId})
            </span>
          )}
          {isLive && family === "EVM" && (
            <div className="ml-auto shrink-0">
              {!verified ? (
                <VerifyActionRow
                  step={verifyStep}
                  error={verifyError}
                  onVerify={verify}
                  onReset={verifyReset}
                  nextTierCta={nextTier?.nextCta}
                />
              ) : walletTier === "PATRON_1M" ? (
                <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                  🐋 Max tier
                </span>
              ) : nextTier && nextTier.nextCta !== "Max tier reached" && onDonate ? (
                <DonateActionRow
                  step={donateStep ?? "idle"}
                  error={donateError ?? null}
                  ctaText={getTierDef(walletTier).nextCta}
                  onDonate={onDonate}
                  onReset={onDonateReset ?? (() => {})}
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Expandable: AppKit widget + Disconnect (all live EVM wallets) */}
      <AnimatePresence>
        {expanded && isLive && family === "EVM" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              {/* Balance display for active wallet — custom instead of <w3m-account-button>
                  which shows a broken "appkitgooglemethod..." name for social logins */}
              {isActive && summaryNativeBalance && (
                <div className="flex items-center justify-center gap-1.5">
                  {sourceIconSrc && <WalletIcon src={sourceIconSrc} alt={sourceMethodLabel ?? 'wallet'} size={14} />}
                  <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                    {displayName}{sourceMethodLabel ? ` (${sourceMethodLabel})` : ''}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {summaryNativeBalance}
                  </span>
                </div>
              )}

              {!isActive && chainName && (
                <div className="text-center">
                  <span className={`text-[9px] inline-flex items-center gap-1 ${
                    isLocalChain(chainId) ? "text-amber-500 dark:text-amber-400 font-medium" : "text-zinc-400 dark:text-zinc-500"
                  }`}>
                    {isLocalChain(chainId) && <span className="font-mono font-bold">&gt;_RPC</span>}
                    on {chainName} (ID: {chainId})
                  </span>
                </div>
              )}

              {/* Disconnect button — inside expanded area */}
              {canDisconnect && onDisconnect && (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-[10px] text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <FiLogOut className="h-3 w-3" />
                  Disconnect wallet
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove button for disconnected wallets (always visible, no expand needed) */}
      {!isLive && onDisconnect && (
        <div className="px-3 pb-2 pt-0.5">
          <button
            type="button"
            onClick={onDisconnect}
            className="flex items-center justify-center gap-1.5 w-full py-1 rounded-md text-[9px] text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <FiLogOut className="h-2.5 w-2.5" />
            Remove from list
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SidebarWalletPanel                                                 */
/* ------------------------------------------------------------------ */

export default function SidebarWalletPanel({
  isLoggedIn,
  web3Enabled,
  onClose,
  userName,
}: {
  isLoggedIn: boolean;
  web3Enabled: boolean;
  onClose: () => void;
  userName?: string | null;
}) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const evmChainId = useChainId();
  const evmChains = useChains();
  const { switchChain, status: switchStatus } = useSwitchChain();
  const { disconnectAsync } = useDisconnect();
  const { switchAccountAsync } = useSwitchAccount();

  // AppKit embedded wallet info — gives us the auth provider + social username/email
  // IMPORTANT: This only returns info for the CURRENTLY ACTIVE AppKit wallet.
  // For multi-auth wallets (e.g. Google + Discord), we save this per-wallet in the registry.
  let appKitAuthProvider: string | undefined;
  let appKitSocialName: string | undefined;
  let appKitSocialEmail: string | undefined;
  let appKitActiveAddress: string | undefined;
  try {
    const appKitAccount = useAppKitAccount();
    let rawAuthProvider: string | undefined = appKitAccount?.embeddedWalletInfo?.authProvider;
    // BUG WORKAROUND (AppKit 1.8.x): embeddedWalletInfo.authProvider returns
    // "email" even for Google/Discord social logins because accountState.socialProvider
    // is never set for non-Telegram flows. The ACTUAL provider is stored in
    // localStorage at '@appkit/connected_social' by ConnectorControllerUtil.connectSocial().
    if (!rawAuthProvider || rawAuthProvider === 'email') {
      try {
        const storedSocial = typeof window !== 'undefined'
          ? localStorage.getItem('@appkit/connected_social')
          : null;
        if (storedSocial && storedSocial !== 'email') {
          rawAuthProvider = storedSocial;
        }
      } catch { /* SSR or storage blocked */ }
    }
    appKitAuthProvider = rawAuthProvider;
    appKitSocialName = appKitAccount?.embeddedWalletInfo?.user?.username ?? undefined;
    appKitSocialEmail = appKitAccount?.embeddedWalletInfo?.user?.email ?? undefined;
    appKitActiveAddress = appKitAccount?.address?.toLowerCase();
  } catch {
    // AppKit provider may not be mounted
  }

  // All active wagmi connections (supports multi-wallet)
  const connections = useConnections();

  // Solana wallet state (safe even if provider not available)
  let solAddress: string | null = null;
  let solConnected = false;
  let solDisconnect: (() => void) | null = null;
  try {
    const sol = useSolanaWallet();
    solAddress = sol.publicKey?.toBase58() ?? null;
    solConnected = sol.connected;
    solDisconnect = sol.disconnect;
  } catch {
    // Solana provider may not be mounted
  }

  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);
  const [loading, setLoading] = useState(false);

  // Donation hook — shared across all wallet rows
  const { step: donateStep, error: donateError, txHash: donateTxHash, donate: execDonate, reset: donateReset } = useDonate({
    onSuccess: () => {
      // Refetch linked wallets to show updated donationTotalUsd
      setTimeout(() => fetchLinked(), 500);
    },
  });
  // Track which wallet is currently donating (by DB wallet ID)
  const [donatingWalletId, setDonatingWalletId] = useState<string | null>(null);

  // Active wallet override — used to make LOCAL_RPC wallets drive the inventory
  const { override: activeOverride, setOverride, clearOverride } = useActiveWalletOverride();

  const { step: transferStep, error: transferError, txHash: transferTxHash, transfer: execTransfer, reset: resetTransfer } = useWalletTransfer();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSourceAddress, setTransferSourceAddress] = useState<string | null>(null);
  const [transferDestinationAddress, setTransferDestinationAddress] = useState<string>("");
  const [transferInput, setTransferInput] = useState<string>("");
  const [transferHistory, setTransferHistory] = useState<TransferReceipt[]>([]);
  const [localRpcBusy, setLocalRpcBusy] = useState(false);
  const [localRpcError, setLocalRpcError] = useState<string | null>(null);
  const [localRpcNotice, setLocalRpcNotice] = useState<string | null>(null);
  const [localRpcSnapshots, setLocalRpcSnapshots] = useState<Record<number, string | number | null>>({});
  // Balance cache for LOCAL_RPC wallets (keyed by lowercase address)
  const [localRpcWalletBalances, setLocalRpcWalletBalances] = useState<Record<string, string>>({});
  const pendingTransferRef = useRef<{
    sourceAddress: string;
    destinationAddress: string;
    amountNative: string;
    amountNok: number;
    chainId: number | null;
  } | null>(null);

  // Pricing context — used to compute native amounts from USD for donations
  let nativeUsdPrice = 0;
  let nativeSymbol = "ETH";
  let pricingRates: Record<string, { usd: number }> = {};
  try {
    const pricing = usePricing();
    pricingRates = pricing.rates ?? {};
    nativeUsdPrice = pricing.rates?.[pricing.nativeSymbol]?.usd ?? 0;
    nativeSymbol = pricing.nativeSymbol ?? "ETH";
  } catch {
    // PricingContext may not be mounted
  }

  const { tokens: activeTokens } = useTokenBalances();

  const { data: activeWalletNativeBalance } = useBalance({
    address: evmAddress,
    chainId: evmChainId,
    query: {
      enabled: Boolean(evmConnected && evmAddress),
    },
  });

  const activeNativeAmount = activeWalletNativeBalance
    ? Number(formatUnits(activeWalletNativeBalance.value, activeWalletNativeBalance.decimals))
    : 0;
  const activeTokenCount = activeTokens.filter((token) => !token.isNative).length;
  const trackedPortfolioUsd = activeTokens.reduce((sum, token) => {
    const rate = pricingRates[token.symbol]?.usd;
    if (!rate) return sum;
    const amount = Number(formatUnits(token.rawBalance, token.decimals));
    if (!Number.isFinite(amount)) return sum;
    return sum + amount * rate;
  }, 0);
  const nokPerUsd = pricingRates.NOK?.usd;
  const activeSummaryValue =
    trackedPortfolioUsd > 0
      ? nokPerUsd
        ? `≈ ${(trackedPortfolioUsd / nokPerUsd).toFixed(2)} kr`
        : `≈ $${trackedPortfolioUsd.toFixed(2)}`
      : undefined;
  // When LOCAL_RPC override is active, derive native balance from activeTokens
  // (which already respects the override) instead of wagmi's useBalance.
  const activeSummaryNative = activeOverride
    ? (() => {
        const native = activeTokens.find((t) => t.isNative);
        if (!native) return undefined;
        const amount = Number(formatUnits(native.rawBalance, native.decimals));
        return Number.isFinite(amount) ? `${amount.toFixed(4)} ${native.symbol}` : undefined;
      })()
    : activeWalletNativeBalance && Number.isFinite(activeNativeAmount)
      ? `${activeNativeAmount.toFixed(4)} ${activeWalletNativeBalance.symbol}`
      : undefined;

  // Force re-render counter — incremented when registry is mutated outside
  // the natural connections-change render cycle (e.g. explicit disconnect).
  const [, forceRegistryUpdate] = useState(0);
  const localRpcFeatureEnabled =
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_CHAINS === "true" ||
    process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
    process.env.NODE_ENV === "development";

  // Persistent wallet registry — survives AppKit AUTH auto-disconnects.
  // Entries grow on connect, removed only on explicit disconnect.
  // Hydrated from sessionStorage so it also survives page reloads / OAuth redirects.
  const walletRegistryRef = useRef(new Map<string, WalletRegistryEntry>());
  const registryRestoredRef = useRef(false);

  // Restore registry from sessionStorage on first mount
  if (!registryRestoredRef.current) {
    registryRestoredRef.current = true;
    const stored = restoreRegistryFromStorage();
    for (const [key, entry] of stored) {
      if (!walletRegistryRef.current.has(key)) {
        walletRegistryRef.current.set(key, entry);
      }
    }
  }

  // Full app logout should reset transient wallet state so stale cards
  // do not leak into a fresh sign-in session.
  // IMPORTANT: We use a ref for connections to avoid re-triggering the
  // cleanup on every connection change (which would disconnect wallets
  // the instant they connected if web3Enabled was ever momentarily false).
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const prevLoggedInRef = useRef(isLoggedIn);
  const prevWeb3EnabledRef = useRef(web3Enabled);
  useEffect(() => {
    // Only run cleanup when isLoggedIn or web3Enabled ACTUALLY changes to false
    const wasActive = prevLoggedInRef.current && prevWeb3EnabledRef.current;
    const isActive = isLoggedIn && web3Enabled;
    prevLoggedInRef.current = isLoggedIn;
    prevWeb3EnabledRef.current = web3Enabled;

    // If still active, or was never active (initial mount with false), skip
    if (isActive) return;
    if (!wasActive && !isActive) return;

    // User logged out or disabled web3 — clean up
    if (walletRegistryRef.current.size === 0 && !activeOverride && connectionsRef.current.length === 0) return;

    walletRegistryRef.current.clear();
    saveRegistryToStorage(walletRegistryRef.current);
    setLinkedWallets([]);
    clearOverride();
    forceRegistryUpdate((value) => value + 1);

    // Disconnect all wagmi connections so wallets don't persist after sign-out
    for (const conn of connectionsRef.current) {
      disconnectAsync({ connector: conn.connector }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, web3Enabled]);

  const fetchLinked = useCallback(async () => {
    log.debug(`fetchLinked — isLoggedIn=${isLoggedIn}, web3Enabled=${web3Enabled}`);
    if (!isLoggedIn || !web3Enabled) {
      setLinkedWallets([]);
      log.debug('fetchLinked skipped — not logged in or web3 disabled');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/wallets/evm");
      if (res.ok) {
        const json = await res.json();
        const wallets = Array.isArray(json?.wallets) ? json.wallets : [];
        log.debug(`fetchLinked got ${wallets.length} linked wallets`);
        setLinkedWallets(wallets);
      } else {
        log.warn('fetchLinked non-ok response', res.status);
        setLinkedWallets([]);
      }
    } catch (err) {
      log.warn('fetchLinked error', err);
      // silent
    } finally {
      setLoading(false);
      log.debug('fetchLinked finished');
    }
  }, [isLoggedIn, web3Enabled]);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("veggat:wallet-transfers");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setTransferHistory(parsed.slice(0, 20));
      }
    } catch {
      // ignore malformed local data
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  Mount-time auto-reconnect — when the registry has entries from a
  //  previous navigation/render but wagmi has 0 connections, attempt
  //  to restore sessions from cookie storage. Skips AUTH connectors
  //  because their Magic.link session expires and causes 401 errors.
  // ═══════════════════════════════════════════════════════════════════
  const mountReconnectDoneRef = useRef(false);
  useEffect(() => {
    if (mountReconnectDoneRef.current) return;
    // Wait a tick for wagmi to hydrate from cookies
    const timer = setTimeout(async () => {
      if (mountReconnectDoneRef.current) return;
      mountReconnectDoneRef.current = true;
      // If wagmi already has connections, nothing to do
      if (connections.length > 0) return;
      // If registry is empty, nothing to restore
      if (walletRegistryRef.current.size === 0) return;

      try {
        const { reconnect: wagmiReconnect, getConnectors } = await import('wagmi/actions');
        const { wagmiConfig: cfg } = await import('@/components/crypto-related/AppKitInit');
        const allConnectors = getConnectors(cfg);

        // Collect non-AUTH connector IDs from registry
        const targetIds = new Set<string>();
        for (const [, entry] of walletRegistryRef.current) {
          // Skip AUTH — Magic.link session likely expired
          if (entry.connectorType === 'AUTH') continue;
          if (entry.connectorId) targetIds.add(entry.connectorId);
        }

        // Find matching wagmi connectors and attempt reconnect
        const targets = allConnectors.filter(
          (c) => targetIds.has(c.id) && c.type !== 'AUTH',
        );
        if (targets.length > 0) {
          await wagmiReconnect(cfg, { connectors: targets });
        }
      } catch {
        // Mount reconnect failed — connectors may have expired
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  Connection tracking (no auto-reconnect)
  //  AppKit enforces single-active-wallet by disconnecting the previous
  //  connector when a new one becomes active. Do NOT auto-reconnect —
  //  it causes a cascade that drops all connections to 0.
  //  The registry keeps grey cards visible; user clicks Activate to switch.
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  Wallet Registry — persistent across auto-disconnects
  //
  //  When AppKit's AUTH connector loses the "active" slot it silently
  //  disconnects itself. Without a registry the card vanishes instantly.
  //  The registry keeps every wallet ever connected this session so it
  //  stays visible as a grey/inactive card with a copyable address.
  //  Entries are only removed on EXPLICIT disconnect (user clicks button).
  // ═══════════════════════════════════════════════════════════════════

  // Sync live connections → registry (grow-only, runs each render)
  // Also updates UIDs when connectors re-announce (EIP-6963 can change UIDs)
  // For AUTH wallets, we save the auth provider + social info at connect time
  // so each wallet remembers which social method created it (Google vs Discord etc.)
  for (const conn of connections) {
    const connUid = conn.connector.uid;
    const connId = conn.connector.id;
    const isAuthConnector = conn.connector.type === 'AUTH' || conn.connector.name === 'Auth';
    const activeInConn = conn.accounts.find(
      (a) => a.toLowerCase() === evmAddress?.toLowerCase(),
    );
    const account = activeInConn ?? conn.accounts[0];
    if (!account) continue;
    const addrLower = account.toLowerCase();
    const regKey = `${connUid}::${addrLower}`;

    // For AUTH connectors: save provider info ONLY if this address is the
    // currently active AppKit address (that's the only one AppKit gives data for).
    // For non-active AUTH addresses, keep the previously saved data.
    const isCurrentAppKit = isAuthConnector && addrLower === appKitActiveAddress;

    // Check if we already have an entry for this address+connectorId but with a stale UID
    const existingEntry = [...walletRegistryRef.current.entries()].find(
      ([k, e]) =>
        e.address.toLowerCase() === addrLower &&
        e.connectorId === connId &&
        k !== regKey,
    );
    if (existingEntry) {
      // UID drifted — re-key the entry with the new UID
      walletRegistryRef.current.delete(existingEntry[0]);
      walletRegistryRef.current.set(regKey, {
        ...existingEntry[1],
        key: regKey,
        connectorUid: connUid,
        connectorName: conn.connector.name,
        connectorType: conn.connector.type,
        connectorIcon: (conn.connector as any).icon ?? existingEntry[1].connectorIcon,
        // Update auth/social info only if this is the currently active AppKit address
        // Don't overwrite a specific social provider with generic "email"
        ...(isCurrentAppKit ? (() => {
          const KNOWN_SOCIALS = ['google', 'discord', 'github', 'apple', 'facebook', 'x', 'farcaster'];
          const existingIsSpecific = existingEntry[1].authProvider && KNOWN_SOCIALS.includes(existingEntry[1].authProvider);
          const newIsGeneric = appKitAuthProvider === 'email';
          return {
            authProvider: (existingIsSpecific && newIsGeneric) ? existingEntry[1].authProvider : (appKitAuthProvider ?? existingEntry[1].authProvider),
            socialName: appKitSocialName ?? existingEntry[1].socialName,
            socialEmail: appKitSocialEmail ?? existingEntry[1].socialEmail,
          };
        })() : {}),
      });
    } else if (!walletRegistryRef.current.has(regKey)) {
      walletRegistryRef.current.set(regKey, {
        key: regKey,
        label: connectorLabel(conn.connector.name),
        family: "EVM",
        address: account,
        connectorName: conn.connector.name,
        connectorType: conn.connector.type,
        connectorUid: connUid,
        connectorId: connId,
        connectorIcon: (conn.connector as any).icon,
        // Save auth provider + social info at connection time for AUTH wallets
        ...(isCurrentAppKit ? {
          authProvider: appKitAuthProvider,
          socialName: appKitSocialName,
          socialEmail: appKitSocialEmail,
        } : {}),
        addedAt: Date.now(),
      });
    } else if (isCurrentAppKit) {
      // Entry already exists AND this is the active AppKit address — update social data
      // (user might have reconnected or social session refreshed)
      const entry = walletRegistryRef.current.get(regKey)!;
      // Don't overwrite a specific social provider (google/discord/etc.) with generic "email".
      // AppKit sometimes reports authProvider as "email" after reconnecting via social OAuth.
      const KNOWN_SOCIALS = ['google', 'discord', 'github', 'apple', 'facebook', 'x', 'farcaster'];
      const existingIsSpecific = entry.authProvider && KNOWN_SOCIALS.includes(entry.authProvider);
      const newIsGeneric = appKitAuthProvider === 'email';
      if (appKitAuthProvider && !(existingIsSpecific && newIsGeneric)) {
        entry.authProvider = appKitAuthProvider;
      }
      if (appKitSocialName) entry.socialName = appKitSocialName;
      if (appKitSocialEmail) entry.socialEmail = appKitSocialEmail;
    }
  }

  // Persist registry to sessionStorage after every sync
  saveRegistryToStorage(walletRegistryRef.current);

  // Build display list combining DB wallets + registry
  type DisplayWallet = {
    key: string;
    /** DB wallet ID (cuid) — only set for DB-linked wallets */
    dbWalletId?: string;
    label: string;
    /** User-defined custom label (from registry) */
    customLabel?: string;
    family: string;
    address: string;
    isLive: boolean;
    isActive: boolean;
    isDefault: boolean;
    verified: boolean;
    donationTotalUsd: number;
    chainName?: string;
    chainId?: number;
    connectorName?: string;
    connectorType?: string;
    connectorUid?: string;
    connectorIcon?: string;
    authProvider?: string;
    socialName?: string;
    socialEmail?: string;
    canDisconnect: boolean;
  };

  const displayWallets: DisplayWallet[] = [];

  // ─── 1. DB-linked wallets ────────────────────────────────────────
  const linkedAddresses = new Set<string>();
  const registryKeysUsedByLinked = new Set<string>();
  for (const w of linkedWallets) {
    linkedAddresses.add(w.address.toLowerCase());
    const liveConn = connections.find((c) =>
      c.accounts.some((a) => a.toLowerCase() === w.address.toLowerCase()),
    );
    if (liveConn) {
      registryKeysUsedByLinked.add(
        `${liveConn.connector.uid}::${w.address.toLowerCase()}`,
      );
    }
    // Also mark any registry entry that shares this address (regardless of UID)
    for (const [rk, re] of walletRegistryRef.current) {
      if (re.address.toLowerCase() === w.address.toLowerCase()) {
        registryKeysUsedByLinked.add(rk);
      }
    }
    // Also try matching by address if UID-based match failed
    const liveByAddr = !liveConn
      ? connections.find((c) =>
          c.accounts.some(
            (a) => a.toLowerCase() === w.address.toLowerCase(),
          ),
        )
      : undefined;
    const effectiveLiveConn = liveConn ?? liveByAddr;
    const isLive =
      (w.family === "EVM" && evmConnected && effectiveLiveConn !== undefined) ||
      (w.family === "SOLANA" &&
        solConnected &&
        solAddress?.toLowerCase() === w.address.toLowerCase());
    // Active = override takes priority: if a LOCAL_RPC override is set,
    // ONLY that address is active. Otherwise fall back to wagmi.
    const isActiveWallet = activeOverride
      ? activeOverride.address?.toLowerCase() === w.address.toLowerCase()
      : w.family === "EVM" &&
        evmConnected &&
        evmAddress?.toLowerCase() === w.address.toLowerCase();
    const chain =
      w.family === "EVM"
        ? evmChains.find((c) => c.id === evmChainId)
        : undefined;

    // Look up saved per-wallet auth info from registry (preferred — saved at connect time)
    // For non-live wallets: also search registry by address alone (UID may have changed)
    const regEntry = effectiveLiveConn
      ? walletRegistryRef.current.get(`${effectiveLiveConn.connector.uid}::${w.address.toLowerCase()}`)
      : undefined;
    // Fallback: search registry by address when no live connection (stale AUTH sessions)
    const regEntryByAddr = !regEntry
      ? [...walletRegistryRef.current.values()].find(
          (e) => e.address.toLowerCase() === w.address.toLowerCase(),
        )
      : undefined;
    const effectiveRegEntry = regEntry ?? regEntryByAddr;
    const isAuthConn = effectiveLiveConn?.connector.type === 'AUTH';
    // For non-live wallets, check if registry OR DB says it was an AUTH connector
    const wasAuthConn = !isAuthConn && (
      effectiveRegEntry?.connectorType === 'AUTH' || w.connectorType === 'AUTH'
    );

    // Backfill dbWalletId into registry so rename handler can persist to DB
    if (effectiveRegEntry && !effectiveRegEntry.dbWalletId) {
      effectiveRegEntry.dbWalletId = w.id;
    }

    displayWallets.push({
      key: w.id,
      dbWalletId: w.id,
      label: w.label,
      customLabel: effectiveRegEntry?.customLabel,
      family: w.family,
      address: w.address,
      isLive,
      isActive: !!isActiveWallet,
      isDefault: w.isDefault,
      verified: !!w.verifiedAt,
      donationTotalUsd: w.donationTotalUsd ?? 0,
      chainName: chain?.name,
      chainId: w.family === "EVM" ? evmChainId : undefined,
      connectorName: effectiveLiveConn?.connector.name ?? effectiveRegEntry?.connectorName,
      connectorType: effectiveLiveConn?.connector.type ?? effectiveRegEntry?.connectorType ?? w.connectorType,
      connectorUid: effectiveLiveConn?.connector.uid ?? effectiveRegEntry?.connectorUid,
      connectorIcon: (effectiveLiveConn?.connector as any)?.icon ?? effectiveRegEntry?.connectorIcon,
      // Show auth provider info even when NOT live — DB + registry preserve it.
      // Priority: live AppKit > registry (saved at connect time) > DB (persisted)
      authProvider: (isAuthConn || wasAuthConn)
        ? preferredAuthProvider(
            effectiveRegEntry?.authProvider ?? w.authProvider,
            isAuthConn ? appKitAuthProvider : undefined,
            effectiveRegEntry?.socialEmail ?? w.socialEmail ?? (isAuthConn ? appKitSocialEmail : undefined),
          )
        : undefined,
      socialName: (isAuthConn || wasAuthConn)
        ? (effectiveRegEntry?.socialName ?? (isAuthConn ? appKitSocialName : undefined))
        : undefined,
      socialEmail: (isAuthConn || wasAuthConn)
        ? (effectiveRegEntry?.socialEmail ?? w.socialEmail ?? (isAuthConn ? appKitSocialEmail : undefined))
        : undefined,
      canDisconnect: !!effectiveLiveConn,
    });
  }

  // ─── 2. Registry entries (persists across auto-disconnects) ──────
  // Iterate in addedAt order so the first-connected wallet stays at top.
  const registryEntries = [...walletRegistryRef.current.entries()].sort(
    ([, a], [, b]) => a.addedAt - b.addedAt,
  );
  log.debug(`registry=${registryEntries.length}, linked=${linkedWallets.length}, conn=${connections.length}`);
  for (const [regKey, entry] of registryEntries) {
    // Already shown via DB-linked loop → skip
    if (registryKeysUsedByLinked.has(regKey)) continue;
    // Same address from the same connector already shown via linked → skip
    if (linkedAddresses.has(entry.address.toLowerCase())) {
      const sameConnLinked = linkedWallets.some(
        (w) =>
          w.address.toLowerCase() === entry.address.toLowerCase() &&
          connections.find(
            (c) =>
              c.connector.uid === entry.connectorUid &&
              c.accounts.some(
                (a) => a.toLowerCase() === w.address.toLowerCase(),
              ),
          ),
      );
      if (sameConnLinked) continue;
    }

    // Check current live status — match by UID + address.
    // For AUTH wallets, UID alone isn't enough because Google and Discord
    // share the same AUTH connector but have different addresses.
    const entryAddrLower = entry.address.toLowerCase();
    const isAuthEntry = entry.connectorType === 'AUTH';
    const liveConn = connections.find(
      (c) =>
        // UID match — but for AUTH connectors, also require address match
        (c.connector.uid === entry.connectorUid &&
          (!isAuthEntry || c.accounts.some((a) => a.toLowerCase() === entryAddrLower))) ||
        // ID + address match
        (c.connector.id === entry.connectorId &&
          c.accounts.some((a) => a.toLowerCase() === entryAddrLower)),
    );
    // Also check if ANY connection owns this address (handles UID drift)
    const liveByAddr = !liveConn
      ? connections.find((c) =>
          c.accounts.some(
            (a) => a.toLowerCase() === entry.address.toLowerCase(),
          ),
        )
      : undefined;
    const effectiveLive = liveConn ?? liveByAddr;
    const isLive = !!effectiveLive;
    // Active = override takes priority: if a LOCAL_RPC override is set,
    // ONLY that address is active. Otherwise fall back to wagmi.
    const isActiveWallet = activeOverride
      ? activeOverride.address?.toLowerCase() === entry.address.toLowerCase()
      : evmConnected &&
        evmAddress?.toLowerCase() === entry.address.toLowerCase();
    const chain = evmChains.find((c) => c.id === evmChainId);
    const entryLocalChainId = entry.connectorType === "LOCAL_RPC"
      ? Number(entry.connectorUid.split(":")[1] ?? entry.connectorId.split(":")[1] ?? 0) || undefined
      : undefined;
    const entryLocalChainName = localChainName(entryLocalChainId);

    // Update registry UID if we found the connection by address fallback
    if (liveByAddr && !liveConn) {
      entry.connectorUid = liveByAddr.connector.uid;
      entry.connectorName = liveByAddr.connector.name;
      entry.connectorType = liveByAddr.connector.type;
    }

    displayWallets.push({
      key: regKey,
      label: entry.label,
      customLabel: entry.customLabel,
      family: entry.family,
      address: entry.address,
      isLive,
      isActive: !!isActiveWallet,
      isDefault: false,
      verified: false,
      donationTotalUsd: 0,
      chainName: isLive ? chain?.name : entryLocalChainName,
      chainId: isLive ? evmChainId : entryLocalChainId,
      connectorName: effectiveLive?.connector.name ?? entry.connectorName,
      connectorType: effectiveLive?.connector.type ?? entry.connectorType,
      connectorUid: effectiveLive?.connector.uid ?? entry.connectorUid,
      connectorIcon: (effectiveLive?.connector as any)?.icon ?? entry.connectorIcon,
      // Use registry-saved per-wallet auth info (saved at connect time)
      authProvider: (effectiveLive?.connector.type ?? entry.connectorType) === 'AUTH'
        ? preferredAuthProvider(entry.authProvider, isActiveWallet ? appKitAuthProvider : undefined, entry.socialEmail)
        : undefined,
      socialName: (effectiveLive?.connector.type ?? entry.connectorType) === 'AUTH' ? entry.socialName : undefined,
      socialEmail: (effectiveLive?.connector.type ?? entry.connectorType) === 'AUTH' ? entry.socialEmail : undefined,
      canDisconnect: isLive,
    });
  }

  // ─── 3. Live Solana (not linked) ────────────────────────────────
  if (
    solConnected &&
    solAddress &&
    !linkedAddresses.has(solAddress.toLowerCase())
  ) {
    displayWallets.push({
      key: `live-sol-${solAddress}`,
      label: "Solana (not linked)",
      family: "SOLANA",
      address: solAddress,
      isLive: true,
      isActive: false,
      isDefault: false,
      verified: false,
      donationTotalUsd: 0,
      canDisconnect: true,
    });
  }

  // ─── Safety net: force active wallet if wagmi says connected ─────
  // Even if connections array is empty (AppKit quirk), if useAccount()
  // reports an address, find and promote that wallet in the display list.
  if (!activeOverride && evmConnected && evmAddress) {
    const activeAddrLower = evmAddress.toLowerCase();
    let idx = displayWallets.findIndex(
      (w) => w.address.toLowerCase() === activeAddrLower,
    );
    if (idx >= 0) {
      displayWallets[idx].isActive = true;
      displayWallets[idx].isLive = true;

      // ── Stale drift cleanup ──────────────────────────────────
      // When an AUTH wallet is active at address A, but the DB still has
      // an old record at address B (address drift from Reown embedded wallets),
      // both may appear as separate cards. Remove the stale one.
      const activated = displayWallets[idx];
      const isActivatedAuth = activated.connectorType === 'AUTH';
      if (isActivatedAuth) {
        for (let i = displayWallets.length - 1; i >= 0; i--) {
          if (i === idx) continue;
          const w = displayWallets[i];
          if (w.address.toLowerCase() === activeAddrLower) continue; // same address → handled by dedup

          // Case 1: Same social email = confirmed same identity, different address
          if (activated.socialEmail && w.socialEmail
            && activated.socialEmail.toLowerCase() === w.socialEmail.toLowerCase()
            && w.address.toLowerCase() !== activeAddrLower) {
            // Inherit DB info (dbWalletId, verified, donations) from the stale entry
            if (w.dbWalletId && !activated.dbWalletId) displayWallets[idx].dbWalletId = w.dbWalletId;
            if (w.verified) displayWallets[idx].verified = true;
            if (w.isDefault) displayWallets[idx].isDefault = true;
            if (w.donationTotalUsd > displayWallets[idx].donationTotalUsd) {
              displayWallets[idx].donationTotalUsd = w.donationTotalUsd;
            }
            displayWallets.splice(i, 1);
            if (i < idx) idx--;
            log.info(`Removed stale drift card ${trimAddress(w.address)} — same email as active ${trimAddress(evmAddress)}`);

            // Backfill DB if stale entry was a DB wallet
            if (w.dbWalletId) {
              fetch('/api/wallets/evm/backfill-meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  walletId: w.dbWalletId,
                  connectorType: 'AUTH',
                  authProvider: activated.authProvider ?? appKitAuthProvider,
                  socialEmail: activated.socialEmail ?? appKitSocialEmail,
                }),
              }).catch((err) => log.warn('Backfill metadata failed:', err));
            }
            continue;
          }

          // Case 2: Old untyped DB wallet — no connectorType, not live, not verified.
          // This catches pre-update records where we have no metadata to match by.
          // Only safe when the old address has no active connection claiming it.
          if (w.dbWalletId && !w.connectorType && !w.isLive && !w.verified) {
            const claimedByOtherConn = connections.some((c) =>
              c.connector.type !== 'AUTH' &&
              c.accounts.some((a) => a.toLowerCase() === w.address.toLowerCase()),
            );
            if (!claimedByOtherConn) {
              if (w.dbWalletId && !activated.dbWalletId) displayWallets[idx].dbWalletId = w.dbWalletId;
              displayWallets.splice(i, 1);
              if (i < idx) idx--;
              log.info(`Removed old untyped wallet ${trimAddress(w.address)} — likely drifted AUTH`);

              if (w.dbWalletId) {
                fetch('/api/wallets/evm/backfill-meta', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    walletId: w.dbWalletId,
                    connectorType: 'AUTH',
                    authProvider: activated.authProvider ?? appKitAuthProvider,
                    socialEmail: activated.socialEmail ?? appKitSocialEmail,
                  }),
                }).catch((err) => log.warn('Backfill metadata failed:', err));
              }
              continue;
            }
          }
        }
      }
    } else {
      // Check if this is an AUTH address that drifted from a DB-linked wallet.
      // Reown embedded wallets can generate different addresses for the same
      // social identity across sessions. Instead of adding a ghost 5th card,
      // find the existing AUTH entry for this social identity and update it.
      const activeConn = connections.find((c) =>
        c.accounts.some((a) => a.toLowerCase() === activeAddrLower),
      );
      const isAuthActive = activeConn?.connector.type === 'AUTH';
      let merged = false;

      if (isAuthActive && appKitSocialEmail) {
        // Look for a DB-linked AUTH wallet with the same social email
        // but a stale/different address (address drift from Reown)
        let staleIdx = displayWallets.findIndex(
          (w) =>
            w.connectorType === 'AUTH' &&
            w.address.toLowerCase() !== activeAddrLower &&
            w.socialEmail?.toLowerCase() === appKitSocialEmail?.toLowerCase(),
        );

        // Try 2: Old DB wallets created BEFORE we added connectorType/socialEmail.
        // These have connectorType === undefined. When the active AUTH address
        // doesn't match any display wallet and no socialEmail match was found,
        // look for unverified DB wallets with unknown type. If exactly ONE
        // candidate fits, it's almost certainly the same AUTH wallet that drifted.
        if (staleIdx < 0) {
          const candidates = displayWallets
            .map((w, i) => ({ w, i }))
            .filter(({ w }) =>
              w.dbWalletId &&                                     // Must be DB-linked
              !w.connectorType &&                                 // Unknown type (old record)
              w.family === 'EVM' &&                               // Same family
              w.address.toLowerCase() !== activeAddrLower &&      // Different address (drift)
              // Exclude wallets that are currently live via a non-AUTH connector
              // (e.g. MetaMask) — those are clearly NOT the drifted AUTH wallet
              !connections.some((c) =>
                c.connector.type !== 'AUTH' &&
                c.accounts.some((a) => a.toLowerCase() === w.address.toLowerCase()),
              ),
            );
          if (candidates.length === 1) {
            staleIdx = candidates[0].i;
            log.info(`Safety net: matched old untyped wallet ${trimAddress(candidates[0].w.address)} to active AUTH identity`);
          }
        }

        if (staleIdx >= 0) {
          // Merge: update the stale entry's address + make it active
          const stale = displayWallets[staleIdx];
          displayWallets[staleIdx] = {
            ...stale,
            address: evmAddress,
            isLive: true,
            isActive: true,
            connectorName: activeConn?.connector.name ?? stale.connectorName,
            connectorType: activeConn?.connector.type ?? stale.connectorType,
            connectorUid: activeConn?.connector.uid ?? stale.connectorUid,
            connectorIcon: (activeConn?.connector as any)?.icon ?? stale.connectorIcon,
            authProvider: preferredAuthProvider(stale.authProvider, appKitAuthProvider, appKitSocialEmail ?? stale.socialEmail),
            socialName: appKitSocialName ?? stale.socialName,
            socialEmail: appKitSocialEmail ?? stale.socialEmail,
          };
          merged = true;
          log.info(`Merged drifted AUTH address ${trimAddress(evmAddress)} into existing wallet (was ${trimAddress(stale.address)})`);

          // Fire-and-forget: backfill the DB record with correct metadata
          // so subsequent sessions don't hit the same drift issue.
          if (stale.dbWalletId) {
            fetch('/api/wallets/evm/backfill-meta', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletId: stale.dbWalletId,
                connectorType: 'AUTH',
                authProvider: appKitAuthProvider,
                socialEmail: appKitSocialEmail,
              }),
            }).catch((err) => log.warn('Backfill metadata failed:', err));
          }
        }
      }

      if (!merged) {
        // Truly new active address — add as live entry
        const chain = evmChains.find((c) => c.id === evmChainId);
        displayWallets.push({
          key: `active-${activeAddrLower}`,
          label: activeConn
            ? connectorLabel(activeConn.connector.name)
            : "Wallet",
          family: "EVM",
          address: evmAddress,
          isLive: true,
          isActive: true,
          isDefault: false,
          verified: false,
          donationTotalUsd: 0,
          chainName: chain?.name,
          chainId: evmChainId,
          connectorName: activeConn?.connector.name,
          connectorType: activeConn?.connector.type,
          connectorUid: activeConn?.connector.uid,
          connectorIcon: (activeConn?.connector as any)?.icon,
          authProvider: isAuthActive ? preferredAuthProvider(undefined, appKitAuthProvider, appKitSocialEmail) : undefined,
          socialName: isAuthActive ? appKitSocialName : undefined,
          socialEmail: isAuthActive ? appKitSocialEmail : undefined,
          canDisconnect: !!activeConn,
        });
      }
    }
  }

  // ─── Secondary safety net: if connections exist but nothing is active ───
  // This handles the case where useAccount() doesn't report an address
  // but wagmi still has live connections (e.g. after AUTH auto-disconnect).
  if (!activeOverride && !displayWallets.some((w) => w.isActive) && connections.length > 0) {
    const firstConn = connections[0];
    const firstAddr = firstConn.accounts[0]?.toLowerCase();
    if (firstAddr) {
      const idx = displayWallets.findIndex(
        (w) => w.address.toLowerCase() === firstAddr,
      );
      if (idx >= 0) {
        displayWallets[idx].isActive = true;
        displayWallets[idx].isLive = true;
        // Secondary safety net: force-mark first connection as active
      }
    }
  }

  // ─── Dedupe: collapse entries sharing the same address ──────────
  // When MetaMask is connected via extension AND via AppKit, or when a
  // registry ghost duplicates a live card, prefer the live/active entry.
  // IMPORTANT: Always dedupe by address first. AUTH identity keys are an
  // additional layer but must never bypass address-based deduplication.
  // This prevents ghost cards when Reown generates different addresses
  // for the same social identity (address drift).
  const deduped: DisplayWallet[] = [];
  const seenAddresses = new Map<string, number>(); // dedupeKey → index in deduped
  const seenRawAddresses = new Map<string, number>(); // plain addr → index (secondary dedup)
  for (const w of displayWallets) {
    const addrKey = w.address.toLowerCase();
    const identityKey =
      w.connectorType === 'AUTH'
        ? authIdentityKey(w.authProvider, w.socialEmail, w.socialName)
        : null;
    const localKey =
      w.connectorType === "LOCAL_RPC" && w.chainId != null
        ? localRpcEntryKey(w.chainId, w.address)
        : null;
    const dedupeKey = identityKey
      ? `auth:${identityKey}`
      : localKey
        ? `local:${localKey}`
        : `addr:${addrKey}`;
    // Check BOTH identity-based key AND raw address to prevent duplicates
    const existingIdx = seenAddresses.get(dedupeKey) ?? seenRawAddresses.get(addrKey);
    if (existingIdx !== undefined) {
      const existing = deduped[existingIdx];
      // Keep the "better" entry: active > live > grey, has dbWalletId > not, extension > AUTH
      const wScore = (w.isActive ? 8 : 0) + (w.isLive ? 4 : 0) + (w.dbWalletId ? 2 : 0) + (w.connectorType !== 'AUTH' ? 1 : 0);
      const eScore = (existing.isActive ? 8 : 0) + (existing.isLive ? 4 : 0) + (existing.dbWalletId ? 2 : 0) + (existing.connectorType !== 'AUTH' ? 1 : 0);
      if (wScore > eScore) {
        // Replace with better entry, but inherit verified/default/db info
        deduped[existingIdx] = {
          ...w,
          dbWalletId: w.dbWalletId || existing.dbWalletId,
          verified: w.verified || existing.verified,
          isDefault: w.isDefault || existing.isDefault,
          donationTotalUsd: Math.max(w.donationTotalUsd, existing.donationTotalUsd),
          // Prefer specific auth provider over undefined
          authProvider: w.authProvider || existing.authProvider,
          socialName: w.socialName || existing.socialName,
          socialEmail: w.socialEmail || existing.socialEmail,
        };
      } else {
        // Keep existing, but inherit verified/default/live from duplicate
        deduped[existingIdx] = {
          ...existing,
          dbWalletId: existing.dbWalletId || w.dbWalletId,
          verified: existing.verified || w.verified,
          isDefault: existing.isDefault || w.isDefault,
          isLive: existing.isLive || w.isLive,
          isActive: existing.isActive || w.isActive,
          donationTotalUsd: Math.max(existing.donationTotalUsd, w.donationTotalUsd),
          authProvider: existing.authProvider || w.authProvider,
          socialName: existing.socialName || w.socialName,
          socialEmail: existing.socialEmail || w.socialEmail,
        };
      }
    } else {
      seenAddresses.set(dedupeKey, deduped.length);
      seenRawAddresses.set(addrKey, deduped.length);
      deduped.push(w);
    }
  }

  // Replace raw list with deduped
  displayWallets.length = 0;
  displayWallets.push(...deduped);

  // Hard guarantee: max ONE active wallet.
  const forcedActiveAddress = activeOverride?.address?.toLowerCase()
    ?? (evmConnected && evmAddress ? evmAddress.toLowerCase() : undefined);
  if (forcedActiveAddress) {
    let activated = false;
    for (const wallet of displayWallets) {
      const matches = wallet.address.toLowerCase() === forcedActiveAddress;
      wallet.isActive = !activated && matches;
      if (wallet.isActive) activated = true;
    }
  } else {
    let found = false;
    for (const wallet of displayWallets) {
      if (wallet.isActive && !found) {
        found = true;
      } else {
        wallet.isActive = false;
      }
    }
  }

  // No sort — wallets stay in connection order (addedAt).
  // Active wallet gets green styling but doesn't move.

  const hasAnyWallet = displayWallets.length > 0;
  const localRpcDisplayWallets = displayWallets.filter(
    (wallet) => wallet.family === "EVM" && wallet.connectorType === "LOCAL_RPC",
  );
  const localRpcAddedKeys = localRpcDisplayWallets.map((wallet) =>
    localRpcEntryKey(wallet.chainId, wallet.address),
  );

  // Fetch balances for LOCAL_RPC wallets so the orange card shows salary
  const localRpcAddrKey = localRpcDisplayWallets.map((w) => `${w.chainId}:${w.address.toLowerCase()}`).join(",");
  useEffect(() => {
    if (!localRpcAddrKey) return;
    let alive = true;
    const entries = localRpcAddrKey.split(",").map((k) => {
      const [cid, addr] = k.split(":");
      return { chainId: Number(cid), address: addr };
    });

    void (async () => {
      const balances: Record<string, string> = {};
      for (const entry of entries) {
        const source = findLocalRpcSource(entry.chainId);
        if (!source) continue;
        try {
          const hexBal = await callLocalRpc<string>(source.rpcUrl, "eth_getBalance", [entry.address, "latest"]);
          const wei = BigInt(hexBal);
          const ethFloat = Number(wei) / 1e18;
          balances[entry.address] = ethFloat > 999
            ? `${(ethFloat / 1000).toFixed(1)}k ETH`
            : `${ethFloat.toFixed(ethFloat < 0.01 ? 6 : 4)} ETH`;
        } catch { /* ignore */ }
      }
      if (alive) setLocalRpcWalletBalances(balances);
    })();

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRpcAddrKey]);

  const handleAddLocalRpcWallet = async (opts?: { chainId?: number; addAll?: boolean; address?: string }) => {
    if (localRpcBusy) return;
    setLocalRpcBusy(true);
    setLocalRpcError(null);
    setLocalRpcNotice(null);

    try {
      const rpcAccounts = await fetchLocalRpcAccounts();
      if (rpcAccounts.length === 0) {
        throw new Error("No local RPC accounts found. Start Anvil or Ganache first.");
      }

      const scopedAccounts = opts?.chainId
        ? rpcAccounts.filter((account) => account.chainId === opts.chainId)
        : rpcAccounts;

      if (scopedAccounts.length === 0) {
        throw new Error("No accounts found on the selected local chain.");
      }

      const existingLocalKeys = new Set(
        displayWallets
          .filter((wallet) => wallet.family === "EVM" && wallet.connectorType === "LOCAL_RPC")
          .map((wallet) => localRpcEntryKey(wallet.chainId, wallet.address)),
      );

      const requestedAddress = opts?.address?.toLowerCase();
      const addressScopedAccounts = requestedAddress
        ? scopedAccounts.filter((account) => account.address.toLowerCase() === requestedAddress)
        : scopedAccounts;

      const addCandidates = addressScopedAccounts.filter((account) =>
        !existingLocalKeys.has(localRpcEntryKey(account.chainId, account.address)),
      );

      if (addCandidates.length === 0) {
        throw new Error("All detected local RPC accounts are already in your wallet list.");
      }

      const accountsToAdd = opts?.addAll ? addCandidates : [addCandidates[0]];

      for (const account of accountsToAdd) {
        const regKey = `local-rpc:${account.chainId}:${account.address.toLowerCase()}`;
        walletRegistryRef.current.set(regKey, {
          key: regKey,
          label: "Local Dev",
          family: "EVM",
          address: account.address,
          connectorName: "Local RPC",
          connectorType: "LOCAL_RPC",
          connectorUid: `local-rpc:${account.chainId}`,
          connectorId: `local-rpc:${account.chainId}`,
          addedAt: Date.now(),
        });
      }

      saveRegistryToStorage(walletRegistryRef.current);
      forceRegistryUpdate((value) => value + 1);
      const chainLabel = opts?.chainId ? localChainName(opts.chainId) ?? "Local chain" : "Local chains";
      setLocalRpcNotice(
        opts?.addAll
          ? `Added ${accountsToAdd.length} account(s) from ${chainLabel}.`
          : `Added ${accountsToAdd[0].address.slice(0, 6)}…${accountsToAdd[0].address.slice(-4)} from ${chainLabel}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add local RPC wallet";
      setLocalRpcError(message);
    } finally {
      setLocalRpcBusy(false);
    }
  };

  const runLocalRpcAction = async (opts: {
    action: LocalRpcAction;
    chainId: number;
    seconds?: number;
    fromAddress?: string;
    targetAddress?: string;
    amountEth?: string;
  }) => {
    if (localRpcBusy) return;
    setLocalRpcBusy(true);
    setLocalRpcError(null);
    setLocalRpcNotice(null);

    const source = findLocalRpcSource(opts.chainId);
    if (!source) {
      setLocalRpcBusy(false);
      setLocalRpcError("Selected local chain is not configured.");
      return;
    }

    try {
      if (opts.action === "mine") {
        await callLocalRpc(source.rpcUrl, "evm_mine", []);
        setLocalRpcNotice(`Mined 1 block on ${source.chainName}.`);
        return;
      }

      if (opts.action === "increase-time") {
        const seconds = Math.max(0, Math.floor(opts.seconds ?? 0));
        if (seconds <= 0) {
          throw new Error("Enter a valid number of seconds.");
        }
        await callLocalRpc(source.rpcUrl, "evm_increaseTime", [seconds]);
        await callLocalRpc(source.rpcUrl, "evm_mine", []);
        setLocalRpcNotice(`Increased time by ${seconds}s on ${source.chainName}.`);
        return;
      }

      if (opts.action === "snapshot") {
        const snapshotId = await callLocalRpc<string | number>(source.rpcUrl, "evm_snapshot", []);
        setLocalRpcSnapshots((prev) => ({ ...prev, [opts.chainId]: snapshotId }));
        setLocalRpcNotice(`Snapshot created on ${source.chainName} (${String(snapshotId)}).`);
        return;
      }

      if (opts.action === "revert") {
        const snapshotId = localRpcSnapshots[opts.chainId];
        if (snapshotId == null) {
          throw new Error("Create a snapshot first before reverting.");
        }
        const ok = await callLocalRpc<boolean>(source.rpcUrl, "evm_revert", [snapshotId]);
        if (!ok) {
          throw new Error("Snapshot revert failed.");
        }
        setLocalRpcNotice(`Reverted ${source.chainName} to snapshot ${String(snapshotId)}.`);
        return;
      }

      if (opts.action === "set-balance") {
        const targetAddress = opts.targetAddress?.trim() as `0x${string}` | undefined;
        const amountHex = toHexWeiFromEth(opts.amountEth ?? "");
        if (!targetAddress || !isAddress(targetAddress)) {
          throw new Error("Enter a valid target address.");
        }
        if (!amountHex) {
          throw new Error("Enter a valid positive amount.");
        }

        const candidateMethods = ["anvil_setBalance", "hardhat_setBalance", "evm_setAccountBalance"];
        let lastError: unknown;

        for (const method of candidateMethods) {
          try {
            await callLocalRpc(source.rpcUrl, method, [targetAddress, amountHex]);
            setLocalRpcNotice(`Set balance for ${targetAddress.slice(0, 6)}…${targetAddress.slice(-4)} on ${source.chainName}.`);
            return;
          } catch (error) {
            lastError = error;
          }
        }

        if (lastError instanceof Error) throw lastError;
        throw new Error("Failed to set account balance on selected local chain.");
      }

      if (opts.action === "send-from-account") {
        const fromAddress = opts.fromAddress?.trim() as `0x${string}` | undefined;
        const targetAddress = opts.targetAddress?.trim() as `0x${string}` | undefined;
        const amountHex = toHexWeiFromEth(opts.amountEth ?? "");
        if (!fromAddress || !isAddress(fromAddress)) {
          throw new Error("Select a valid source account.");
        }
        if (!targetAddress || !isAddress(targetAddress)) {
          throw new Error("Enter a valid recipient address.");
        }
        if (fromAddress.toLowerCase() === targetAddress.toLowerCase()) {
          throw new Error("Source and destination must be different accounts.");
        }
        if (!amountHex) {
          throw new Error("Enter a valid positive transfer amount.");
        }
        // OWASP: Sanity-check amount (max 100K ETH for local chains)
        const amountNum = parseFloat(opts.amountEth ?? "0");
        if (isNaN(amountNum) || amountNum <= 0 || amountNum > 100_000) {
          throw new Error("Amount must be between 0 and 100,000 ETH.");
        }

        await callLocalRpc(source.rpcUrl, "eth_sendTransaction", [
          {
            from: fromAddress,
            to: targetAddress,
            value: amountHex,
          },
        ]);
        // Clear balance cache so wallets refresh
        setLocalRpcWalletBalances({});
        setLocalRpcNotice(
          `Sent ${opts.amountEth ?? "0"} from ${fromAddress.slice(0, 6)}…${fromAddress.slice(-4)} to ${targetAddress.slice(0, 6)}…${targetAddress.slice(-4)} on ${source.chainName}.`,
        );
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local RPC action failed";
      setLocalRpcError(message);
      toast.error(message);
      throw error; // re-throw so callers can detect failure
    } finally {
      setLocalRpcBusy(false);
    }
  };

  const transferSourceWallet = transferSourceAddress
    ? displayWallets.find((wallet) => wallet.address.toLowerCase() === transferSourceAddress.toLowerCase())
    : null;

  const transferSourceIsAuth = Boolean(
    transferSourceWallet &&
      (transferSourceWallet.connectorType === "AUTH" || transferSourceWallet.connectorName === "Auth"),
  );
  const normalizedTransferSourceProvider = transferSourceWallet?.authProvider?.trim().toLowerCase();
  const transferSourceProviderName =
    transferSourceIsAuth && normalizedTransferSourceProvider
      ? authProviderLabel(normalizedTransferSourceProvider)
      : null;
  const transferSourceLabel = transferSourceWallet
    ? transferSourceIsAuth
      ? transferSourceProviderName
        ? `Reown via ${transferSourceProviderName}`
        : "Reown"
      : transferSourceWallet.connectorName
        ? connectorLabel(transferSourceWallet.connectorName)
        : transferSourceWallet.label
    : "Wallet";

  const { data: sourceNativeBalance } = useBalance({
    address: transferSourceAddress ? (transferSourceAddress as `0x${string}`) : undefined,
    chainId: transferSourceWallet?.chainId ?? evmChainId,
    query: {
      enabled: Boolean(transferOpen && transferSourceAddress),
    },
  });

  const { data: transferFeeData } = useFeeData({
    chainId: transferSourceWallet?.chainId ?? evmChainId,
    query: {
      enabled: Boolean(transferOpen),
    },
  });

  const normalizedTransferInput = transferInput.trim().toLowerCase();
  const isNokInput = normalizedTransferInput.includes("kr") || normalizedTransferInput.includes("nok");
  const numericInput = Number(normalizedTransferInput.replace(/[^\d.,-]/g, "").replace(",", "."));
  const parsedNativeAmount = Number.isFinite(numericInput)
    ? (isNokInput ? (nativeUsdPrice > 0 ? numericInput / nativeUsdPrice : 0) : numericInput)
    : 0;
  const parsedNokAmount = isNokInput
    ? (Number.isFinite(numericInput) ? numericInput : 0)
    : parsedNativeAmount * nativeUsdPrice;

  const estimatedFeeNative = transferFeeData?.gasPrice ? Number(formatUnits(transferFeeData.gasPrice * BigInt(21000), 18)) : 0;
  const estimatedFeeNok = estimatedFeeNative * nativeUsdPrice;
  const sourceBalanceNative = sourceNativeBalance ? Number(formatUnits(sourceNativeBalance.value, sourceNativeBalance.decimals)) : 0;
  const maxTransferNative = Math.max(0, sourceBalanceNative - estimatedFeeNative);
  const hasInsufficientFunds = parsedNativeAmount > 0 && parsedNativeAmount + estimatedFeeNative > sourceBalanceNative;

  const normalizedTransferDestinationAddress = transferDestinationAddress.trim();
  const hasTransferDestination = normalizedTransferDestinationAddress.length > 0;
  const isManualDestinationValid = !hasTransferDestination || isAddress(normalizedTransferDestinationAddress as `0x${string}`);

  const sameAddress = transferSourceAddress && hasTransferDestination
    ? normalizedTransferDestinationAddress.toLowerCase() === transferSourceAddress.toLowerCase()
    : false;

  const isCompatibleDestinationChain = (sourceChainId?: number, destinationChainId?: number) => {
    if (sourceChainId == null) return true;
    if (destinationChainId == null) return true;
    return destinationChainId === sourceChainId;
  };

  const transferDestinations = transferSourceAddress
    ? displayWallets.filter(
        (wallet) =>
          wallet.family === "EVM" &&
          isCompatibleDestinationChain(transferSourceWallet?.chainId, wallet.chainId) &&
          wallet.address.toLowerCase() !== transferSourceAddress.toLowerCase(),
      )
    : [];

  const incompatibleDestinationsCount = transferSourceAddress
    ? displayWallets.filter(
        (wallet) =>
          wallet.family === "EVM" &&
          wallet.address.toLowerCase() !== transferSourceAddress.toLowerCase() &&
          transferSourceWallet?.chainId != null &&
          wallet.chainId != null &&
          wallet.chainId !== transferSourceWallet.chainId,
      ).length
    : 0;

  const openTransferFlow = (sourceAddress: string) => {
    const sourceWallet = displayWallets.find(
      (wallet) => wallet.address.toLowerCase() === sourceAddress.toLowerCase(),
    );
    const destinations = displayWallets.filter(
      (wallet) =>
        wallet.family === "EVM" &&
        wallet.address.toLowerCase() !== sourceAddress.toLowerCase() &&
        isCompatibleDestinationChain(sourceWallet?.chainId, wallet.chainId),
    );
    resetTransfer();
    setTransferInput("");
    setTransferSourceAddress(sourceAddress);
    setTransferDestinationAddress(destinations[0]?.address ?? "");
    setTransferOpen(true);
  };

  const closeTransferFlow = () => {
    setTransferOpen(false);
    setTransferInput("");
    setTransferSourceAddress(null);
    setTransferDestinationAddress("");
    resetTransfer();
  };

  const handleSendTransfer = async () => {
    const normalizedAmount = parsedNativeAmount.toString();
    if (!Number.isFinite(parsedNativeAmount) || parsedNativeAmount <= 0) return;
    if (!hasTransferDestination || !isManualDestinationValid) return;

    pendingTransferRef.current = {
      sourceAddress: transferSourceAddress ?? "",
      destinationAddress: normalizedTransferDestinationAddress,
      amountNative: normalizedAmount,
      amountNok: parsedNokAmount,
      chainId: transferSourceWallet?.chainId ?? evmChainId,
    };

    // LOCAL_RPC wallets: send via direct RPC call (no wagmi wallet needed)
    if (transferSourceWallet?.connectorType === 'LOCAL_RPC') {
      const sourceChainId = transferSourceWallet.chainId;
      const source = sourceChainId != null ? findLocalRpcSource(sourceChainId) : undefined;
      if (!source) {
        setLocalRpcError("Cannot find local RPC source for this wallet");
        return;
      }
      try {
        const amountHex = toHexWeiFromEth(normalizedAmount);
        if (!amountHex) {
          setLocalRpcError("Invalid transfer amount");
          return;
        }
        await callLocalRpc(source.rpcUrl, "eth_sendTransaction", [
          {
            from: transferSourceAddress as `0x${string}`,
            to: normalizedTransferDestinationAddress as `0x${string}`,
            value: amountHex,
          },
        ]);
        // Record receipt manually for LOCAL_RPC
        const receipt: TransferReceipt = {
          id: `${Date.now()}-rpc`,
          sourceAddress: transferSourceAddress ?? "",
          destinationAddress: normalizedTransferDestinationAddress,
          amountNative: normalizedAmount,
          amountNok: parsedNokAmount,
          nativeSymbol,
          txHash: "local-rpc",
          chainId: sourceChainId ?? null,
          createdAt: Date.now(),
        };
        setTransferHistory((prev) => [receipt, ...prev].slice(0, 20));
        // Record as LOCAL trade in the unified trade history
        recordTransferTrade({
          mode: "LOCAL",
          sourceAddress: transferSourceAddress ?? "",
          destinationAddress: normalizedTransferDestinationAddress,
          amountNative: normalizedAmount,
          chainId: sourceChainId ?? null,
          txHash: "local-rpc",
        });
        // Refresh RPC balances
        setLocalRpcWalletBalances({});
        closeTransferFlow();
        toast.success(`Sent ${normalizedAmount} ETH via Local RPC`);
      } catch (err) {
        setLocalRpcError(err instanceof Error ? err.message : "RPC transfer failed");
      }
      return;
    }

    await execTransfer({
      destinationAddress: normalizedTransferDestinationAddress as `0x${string}`,
      amountNative: normalizedAmount,
    });
  };

  /** Fire-and-forget POST to /api/trades/record for SELF / LOCAL transfers. */
  const recordTransferTrade = useCallback(
    (opts: {
      mode: "SELF" | "LOCAL";
      sourceAddress: string;
      destinationAddress: string;
      amountNative: string;
      chainId: number | null;
      txHash?: string;
    }) => {
      const rawAmount = parseEther(opts.amountNative).toString();
      const usd = nativeUsdPrice > 0 ? Number(opts.amountNative) * nativeUsdPrice : undefined;
      fetch("/api/trades/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: opts.mode,
          sellToken: nativeSymbol,
          sellTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          sellAmount: rawAmount,
          sellDisplayAmt: opts.amountNative,
          sellDecimals: 18,
          sellChainId: opts.chainId ?? 1,
          buyToken: nativeSymbol,
          buyTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          buyAmount: rawAmount,
          buyDisplayAmt: opts.amountNative,
          buyDecimals: 18,
          buyChainId: opts.chainId ?? 1,
          priceUsd: usd,
          txHash: opts.txHash,
          walletAddress: opts.sourceAddress,
          environment: opts.mode === "LOCAL" ? "TESTNET" : "MAINNET",
          metadata: {
            from: opts.sourceAddress,
            to: opts.destinationAddress,
            type: "wallet-transfer",
          },
        }),
      }).catch((err) => console.warn("[trade-record] SELF/LOCAL record failed:", err));
    },
    [nativeSymbol, nativeUsdPrice],
  );

  useEffect(() => {
    if (transferStep !== "success" || !transferTxHash || !pendingTransferRef.current) return;
    const pending = pendingTransferRef.current;
    const receipt: TransferReceipt = {
      id: `${Date.now()}-${transferTxHash}`,
      sourceAddress: pending.sourceAddress,
      destinationAddress: pending.destinationAddress,
      amountNative: pending.amountNative,
      amountNok: pending.amountNok,
      nativeSymbol,
      txHash: transferTxHash,
      chainId: pending.chainId,
      createdAt: Date.now(),
    };
    setTransferHistory((prev) => {
      const next = [receipt, ...prev].slice(0, 20);
      try {
        localStorage.setItem("veggat:wallet-transfers", JSON.stringify(next));
      } catch {
        // storage may be unavailable
      }
      return next;
    });
    // Record as SELF trade in the unified trade history
    recordTransferTrade({
      mode: "SELF",
      sourceAddress: pending.sourceAddress,
      destinationAddress: pending.destinationAddress,
      amountNative: pending.amountNative,
      chainId: pending.chainId,
      txHash: transferTxHash,
    });
    pendingTransferRef.current = null;
  }, [transferStep, transferTxHash, nativeSymbol, recordTransferTrade]);

  // Track already-connected connector IDs so DirectConnectors hides them
  const connectedConnectorIds = new Set<string>();
  const connectedConnectorNames = new Set<string>();
  for (const conn of connections) {
    connectedConnectorIds.add(conn.connector.uid);
    connectedConnectorIds.add(conn.connector.id);
    connectedConnectorNames.add(connectorLabel(conn.connector.name));
  }

  const handleDisconnect = async (w: DisplayWallet) => {
    // Remove from persistent registry so the card disappears
    for (const [key, entry] of walletRegistryRef.current) {
      if (
        entry.address.toLowerCase() === w.address.toLowerCase() &&
        entry.connectorName === w.connectorName
      ) {
        walletRegistryRef.current.delete(key);
      }
    }
    saveRegistryToStorage(walletRegistryRef.current);
    forceRegistryUpdate((v) => v + 1);

    try {
      if (w.family === "SOLANA" && solDisconnect) {
        await solDisconnect();
      } else if (w.family === "EVM") {
        // Find the connector for this wallet and disconnect it
        const conn = connections.find((c) =>
          c.accounts.some(
            (a) => a.toLowerCase() === w.address.toLowerCase(),
          ),
        );
        if (conn) {
          await disconnectAsync({ connector: conn.connector });
        } else {
          await disconnectAsync();
        }
      }
    } catch {
      // swallow
    }
  };

  /**
   * Switch the active wagmi account to this wallet.
   * If the wallet is in connections, uses switchAccountAsync.
   * If not (registry-only), finds its connector and reconnects it.
   *
   * For injected/EIP-6963 wallets (MetaMask, Coinbase), we must disconnect
   * the current injected wallet first — otherwise wagmiConnect just returns
   * the same provider that's already active.
   *
   * NOTE: Switching wallets NEVER touches the NextAuth web2 session.
   * The user stays logged in regardless of which wallet is active.
   */
  const handleSetActive = async (w: DisplayWallet) => {
    if (w.isActive || w.family !== "EVM") return;

    // LOCAL_RPC wallets: Just set the active wallet override — NO MetaMask/Coinbase prompt!
    // Local RPC is "paper money" that uses direct JSON-RPC calls, not real wallet connectors.
    // The override tells use-token-balances to fetch from the local RPC URL
    // instead of through wagmi's injected providers.
    if (w.connectorType === 'LOCAL_RPC') {
      setLocalRpcBusy(true);
      setLocalRpcError(null);
      setLocalRpcNotice(null);

      try {
        // Parse chainId from the registry key (local-rpc:chainId:address)
        const regEntry = [...walletRegistryRef.current.values()].find(
          (e) => e.address.toLowerCase() === w.address.toLowerCase() && e.connectorType === 'LOCAL_RPC',
        );
        const localChainId = regEntry
          ? Number(regEntry.connectorUid.split(':')[1] ?? regEntry.connectorId.split(':')[1] ?? 0)
          : (w.chainId ?? 31337);

        // Verify the local RPC is actually reachable before activating
        const source = LOCAL_RPC_SOURCES.find((s) => s.chainId === localChainId);
        const rpcUrl = source?.rpcUrl ?? `http://127.0.0.1:${localChainId === 1337 ? 7545 : 8545}`;

        try {
          await callLocalRpc<string>(rpcUrl, 'eth_chainId');
        } catch {
          throw new Error(
            `Local RPC at ${rpcUrl} is not reachable. Start Anvil (anvil) or Ganache (ganache-cli) first.`,
          );
        }

        // Set the override — this makes the wallet "active" without any
        // MetaMask/Coinbase popup. Balance reads go through direct RPC calls.
        setOverride({
          address: w.address,
          chainId: localChainId,
          rpcUrl,
          label: `${localChainName(localChainId) ?? 'Local'} Account`,
        });

        setLocalRpcNotice(
          `Activated ${trimAddress(w.address)} on ${localChainName(localChainId) ?? `Chain ${localChainId}`}. This is paper money — no real transactions.`,
        );
        toast.success(`Local RPC wallet activated on ${localChainName(localChainId) ?? `Chain ${localChainId}`}`);

        setTimeout(() => {
          forceRegistryUpdate((v) => v + 1);
          window.dispatchEvent(new Event("veggat:balanceInvalidate"));
        }, 300);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to activate local wallet';
        setLocalRpcError(msg);
      } finally {
        setLocalRpcBusy(false);
      }
      return;
    }

    // Activating a non-LOCAL_RPC wallet — clear any local override
    clearOverride();

    // Try finding in live connections first
    const conn = connections.find((c) =>
      c.accounts.some(
        (a) => a.toLowerCase() === w.address.toLowerCase(),
      ),
    );

    if (conn) {
      // Wallet is live — just switch
      const isAuthSwitch = conn.connector.type === 'AUTH' || conn.connector.id === 'auth';
      let switchSucceeded = false;
      try {
        await switchAccountAsync({ connector: conn.connector });
        switchSucceeded = true;
        if (isAuthSwitch) {
          toast.success(`Switched to ${w.authProvider ? authProviderLabel(w.authProvider) : 'Reown'} wallet`);
        }
        setTimeout(() => fetchLinked(), 600);
      } catch (switchErr) {
        if (isAuthSwitch) {
          // AUTH switchAccount can fail if the social session expired.
          // Fall through to the reconnect path below.
          log.warn('AUTH switchAccount failed, session may be expired:', switchErr);
          toast.info('Wallet session expired — reconnecting…');
        } else {
          fetchLinked();
          return;
        }
      }
      // If switch worked (AUTH or not), we're done
      if (switchSucceeded) return;
      // AUTH switch failed → fall through to reconnect below
    }

    // Wallet NOT in connections — need to reconnect it
    try {
      const { connect: wagmiConnect, getConnectors } =
        await import('wagmi/actions');
      const { wagmiConfig } = await import('@/components/crypto-related/AppKitInit');

      // Find registry entry
      const regEntry = [...walletRegistryRef.current.values()].find(
        (e) => e.address.toLowerCase() === w.address.toLowerCase(),
      );

      // Find the target connector by registry info, connectorName, or ID
      const allConnectors = getConnectors(wagmiConfig);

      // Strict match: prefer exact UID, then ID+name, then name+type, then ID alone, then name alone
      const connector =
        allConnectors.find((c) => c.uid === (regEntry?.connectorUid ?? w.connectorUid)) ||
        allConnectors.find((c) => c.id === (regEntry?.connectorId ?? '') && c.name === w.connectorName) ||
        allConnectors.find((c) => c.name === w.connectorName && c.type === (w.connectorType ?? regEntry?.connectorType)) ||
        allConnectors.find((c) => c.id === (regEntry?.connectorId ?? '')) ||
        allConnectors.find((c) => c.name === w.connectorName);

      // For AUTH connectors, also try matching by type (they get new UIDs on re-init)
      const authConnector = !connector && (w.connectorType === 'AUTH' || regEntry?.connectorType === 'AUTH')
        ? allConnectors.find((c) => c.type === 'AUTH' || c.id === 'auth' || c.name === 'Auth')
        : undefined;
      const resolvedConnector = connector ?? authConnector;

      // ── AUTH / Social wallets: always use the AppKit modal ──────
      // wagmiConnect with AUTH connectors hangs when the social session
      // has expired — it neither resolves nor rejects. The only reliable
      // way to re-authenticate is through the AppKit UI.
      const isAuth = resolvedConnector?.type === 'AUTH'
        || w.connectorType === 'AUTH'
        || regEntry?.connectorType === 'AUTH';

      if (isAuth) {
        // Determine the target social provider from the registry / display wallet
        const VALID_SOCIALS = ['google', 'github', 'apple', 'facebook', 'x', 'discord'] as const;
        type SocialProvider = (typeof VALID_SOCIALS)[number];
        const targetProvider = (regEntry?.authProvider ?? w.authProvider ?? '').toLowerCase();
        const isSocial = VALID_SOCIALS.includes(targetProvider as SocialProvider);

        // ── Pre-open popup SYNCHRONOUSLY so the browser doesn't block it ──
        // Must happen in the same call-stack as the user click event.
        // We open to a blank loading page, then redirect to the OAuth URL after
        // doing the async disconnect.
        let socialPopup: Window | null = null;
        if (isSocial) {
          try {
            socialPopup = openCenteredPopup(
              'https://secure.walletconnect.org/loading',
              'popupWindow',
            );
          } catch { /* popup blocked by user settings */ }
        }

        // ── Disconnect the currently active AUTH session first ──────
        // AppKit only allows one social provider at a time.
        // IMPORTANT: Only disconnect if the target address is NOT on this
        // same connector — disconnecting kills ALL social sessions on the
        // shared AUTH connector.
        const currentAuthConn = connections.find(
          (c) => (c.connector.type === 'AUTH' || c.connector.id === 'auth')
            && c.accounts.some(
              (a) => a.toLowerCase() !== w.address.toLowerCase(),
            ),
        );
        // Check: does this same connector also hold our target address?
        const targetAlsoOnThisConn = currentAuthConn?.accounts.some(
          (a) => a.toLowerCase() === w.address.toLowerCase(),
        );
        if (currentAuthConn && !targetAlsoOnThisConn) {
          try {
            await disconnectAsync({ connector: currentAuthConn.connector });
          } catch { /* ok — may already be released */ }
          // Give AppKit time to tear down the social session
          await new Promise((r) => setTimeout(r, 400));
        }

        // ── If we know the provider, drive the OAuth flow directly ──────
        if (isSocial) {
          onClose();
          let directSuccess = false;
          try {
            const { ConnectorController, ConnectionController } =
              await import('@reown/appkit-controllers');
            const authConn = ConnectorController.getAuthConnector();
            if (!authConn) throw new Error('No auth connector');

            // Get the OAuth redirect URI for the target provider
            let uri: string;
            try {
              const result = await authConn.provider.getSocialRedirectUri({
                provider: targetProvider as SocialProvider,
              });
              uri = result.uri;
            } catch (uriErr) {
              log.warn(`getSocialRedirectUri failed for ${targetProvider}`, uriErr);
              throw new Error(`OAuth redirect not available for ${targetProvider}`);
            }

            // Redirect the pre-opened popup to the OAuth page
            if (socialPopup && !socialPopup.closed) {
              socialPopup.location.href = uri;
            } else {
              // Popup was blocked — try opening now (may still be blocked)
              socialPopup = openCenteredPopup(uri, 'popupWindow');
              if (!socialPopup || socialPopup.closed) {
                throw new Error('Popup blocked by browser');
              }
            }

            // Listen for the OAuth callback via postMessage
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Social connect timeout — try again'));
              }, 120_000); // 2 min timeout

              // Also detect if popup was closed by user without completing
              const pollClosed = setInterval(() => {
                if (socialPopup && socialPopup.closed) {
                  clearInterval(pollClosed);
                  clearTimeout(timeout);
                  window.removeEventListener('message', handler);
                  reject(new Error('Login popup closed'));
                }
              }, 1000);

              function handler(event: MessageEvent) {
                if (event.data?.resultUri && event.origin === 'https://secure.walletconnect.org') {
                  clearTimeout(timeout);
                  clearInterval(pollClosed);
                  window.removeEventListener('message', handler);
                  if (socialPopup && !socialPopup.closed) socialPopup.close();

                  // Complete the connection with the socialUri
                  ConnectionController.connectExternal(
                    {
                      id: authConn!.id,
                      type: authConn!.type,
                      socialUri: event.data.resultUri,
                    },
                    authConn!.chain ?? 'eip155',
                  ).then(() => resolve()).catch(reject);
                }
              }
              window.addEventListener('message', handler, false);
            });
            directSuccess = true;
          } catch (err) {
            // Close stale popup if still open
            if (socialPopup && !socialPopup.closed) socialPopup.close();

            const errMsg = err instanceof Error ? err.message : 'Connection failed';
            // User-closed popup is expected — don't show error
            if (errMsg.includes('popup closed')) {
              log.debug('Social popup closed by user');
              toast.info('Login cancelled');
            } else {
              // Fall back to modal for any other error
              log.warn(`Direct ${targetProvider} connect failed, opening modal`, err);
              toast.info(`Reconnecting via ${authProviderLabel(targetProvider)}…`);
              try {
                ModalController.open({ view: 'Connect' });
              } catch { /* ok */ }
            }
          }

          if (directSuccess) {
            toast.success(`Connected via ${authProviderLabel(targetProvider)}`);
          }

          setTimeout(() => {
            forceRegistryUpdate((v) => v + 1);
            fetchLinked();
          }, 600);
          return;
        }

        // ── Unknown provider — fall back to the AppKit modal ──────
        onClose();
        await new Promise((r) => setTimeout(r, 150));
        try {
          ModalController.open({ view: 'Connect' });
        } catch {
          try {
            const { ModalController: MC } = await import('@reown/appkit-controllers');
            MC.open({ view: 'Connect' });
          } catch { /* ok */ }
        }
        return;
      }

      if (!resolvedConnector) return;

      // For injected/EIP-6963 wallets: disconnect the currently active
      // injected wallet first, otherwise wagmiConnect returns the same provider.
      const currentInjectedConn = connections.find(
        (c) => (c.connector.type === 'injected' || c.connector.type === 'announced')
          && c.connector.uid !== resolvedConnector.uid
      );

      if (currentInjectedConn) {
        try {
          const { disconnect: wagmiDisconnect } = await import('wagmi/actions');
          await wagmiDisconnect(wagmiConfig, { connector: currentInjectedConn.connector });
        } catch {
          /* ok — might already be gone */
        }
        // Small delay to let the provider release
        await new Promise((r) => setTimeout(r, 200));
      }

      await wagmiConnect(wagmiConfig, { connector: resolvedConnector });

      // AppKit may disconnect the previous wallet — registry keeps it visible.
      setTimeout(() => {
        forceRegistryUpdate((v) => v + 1);
        fetchLinked();
      }, 600);
    } catch {
      forceRegistryUpdate((v) => v + 1);
    }
  };

  /**
   * Activate a LOCAL_RPC account from the Available Accounts list.
   * Sets the active wallet override so use-token-balances fetches for this address.
   */
  const handleActivateRpcAccount = useCallback((address: string, chainId: number) => {
    const source = LOCAL_RPC_SOURCES.find((s) => s.chainId === chainId);
    setOverride({
      address,
      chainId,
      rpcUrl: source?.rpcUrl ?? `http://127.0.0.1:${chainId === 1337 ? 7545 : 8545}`,
      label: `${localChainName(chainId) ?? 'Local'} Account`,
    });
    toast.success(`Activated ${address.slice(0, 6)}…${address.slice(-4)} on ${localChainName(chainId) ?? `Chain ${chainId}`}`);
    // Trigger a balance invalidation so useTokenBalances re-fetches immediately
    window.dispatchEvent(new Event("veggat:balanceInvalidate"));
  }, [setOverride]);

  /**
   * Rename a wallet — stores a user-defined customLabel in the registry.
   * For DB-linked wallets, also persists the label via PATCH API.
   * Works for any wallet type (injected, AUTH, LOCAL_RPC, etc.).
   */
  const handleRenameWallet = (address: string, newName: string) => {
    const trimmed = newName.trim().slice(0, 40);
    let dbWalletId: string | undefined;
    for (const [, entry] of walletRegistryRef.current) {
      if (entry.address.toLowerCase() === address.toLowerCase()) {
        entry.customLabel = trimmed || undefined;
        if (entry.dbWalletId) dbWalletId = entry.dbWalletId;
      }
    }
    saveRegistryToStorage(walletRegistryRef.current);
    forceRegistryUpdate((v) => v + 1);

    // Persist to DB for linked wallets (fire-and-forget, non-blocking)
    if (dbWalletId && trimmed) {
      fetch(`/api/wallets/evm/${dbWalletId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', label: trimmed }),
      }).catch(() => { /* silent — localStorage is source of truth for display */ });
    }
  };

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center gap-2 px-1 pb-2">
        <FiZap className="h-3.5 w-3.5 text-sky-500 dark:text-emerald-500 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Wallets
        </span>
        {hasAnyWallet && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
            {displayWallets.length}
          </span>
        )}
        {isLoggedIn && web3Enabled && (
          <Link
            href="/settings?section=wallet"
            onClick={onClose}
            className="ml-auto text-[10px] text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 transition-colors"
          >
            Manage →
          </Link>
        )}
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        {/* Wallet list */}
        <AnimatePresence initial={false}>
        {displayWallets.map((w) => (
          <motion.div
            key={w.key}
            layout
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{ opacity: 1, height: "auto", overflow: "visible" }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
          <WalletRow
            key={w.key}
            label={w.label}
            customLabel={w.customLabel}
            family={w.family}
            address={w.address}
            isLive={w.isLive}
            isActive={w.isActive}
            isDefault={w.isDefault}
            verified={w.verified}
            donationTotalUsd={w.donationTotalUsd}
            dbWalletId={w.dbWalletId}
            donateStep={donatingWalletId === w.dbWalletId ? donateStep : undefined}
            donateError={donatingWalletId === w.dbWalletId ? donateError : undefined}
            onDonate={
              w.dbWalletId && w.verified && w.isLive && w.isActive && nativeUsdPrice > 0
                ? () => {
                    // Compute the next tier's required donation
                    const info = getNextDonationInfo(true, w.donationTotalUsd);
                    if (!info) return;
                    setDonatingWalletId(w.dbWalletId!);
                    execDonate({
                      walletId: w.dbWalletId!,
                      address: w.address,
                      chainId: w.chainId ?? 1,
                      amountUsd: info.remainingUsd > 0 ? info.remainingUsd : info.nextMinUsd,
                      nativeUsdPrice,
                      tokenSymbol: nativeSymbol,
                      connectorUid: w.connectorUid,
                    });
                  }
                : undefined
            }
            onDonateReset={() => {
              setDonatingWalletId(null);
              donateReset();
            }}
            chainName={w.chainName}
            chainId={w.chainId}
            connectorName={w.connectorName}
            connectorType={w.connectorType}
            connectorUid={w.connectorUid}
            connectorIcon={w.connectorIcon}
            authProvider={w.authProvider}
            socialName={w.socialName}
            socialEmail={w.socialEmail}
            userName={userName}
            summaryNativeBalance={
              w.isActive
                ? activeSummaryNative
                : w.connectorType === 'LOCAL_RPC'
                  ? localRpcWalletBalances[w.address.toLowerCase()]
                  : undefined
            }
            summaryTokenCount={w.isActive ? activeTokenCount : undefined}
            summaryPortfolioValue={w.isActive ? activeSummaryValue : undefined}
            chains={
              w.family === "EVM"
                ? evmChains.map((c) => ({ id: c.id, name: c.name }))
                : undefined
            }
            onSwitchChain={
              w.family === "EVM" && w.isActive
                ? (id) => switchChain({ chainId: id })
                : undefined
            }
            switchPending={switchStatus === "pending"}
            onDisconnect={
              (w.canDisconnect || !w.isLive) ? () => handleDisconnect(w) : undefined
            }
            canDisconnect={w.canDisconnect || !w.isLive}
            onVerified={fetchLinked}
            onSetActive={
              !w.isActive && w.family === "EVM"
                ? () => handleSetActive(w)
                : undefined
            }
            onTransfer={
              // Active wallets: "Transfer" button. Inactive EVM wallets: "Fund" button.
              (w.isActive && w.isLive && w.family === "EVM") || w.connectorType === 'LOCAL_RPC' || (!w.isActive && w.family === "EVM")
                ? () => openTransferFlow(w.address)
                : undefined
            }
            onRename={(newName) => handleRenameWallet(w.address, newName)}
          />
          </motion.div>
        ))}
        </AnimatePresence>

        {/* Empty state */}
        {!hasAnyWallet && !loading && (
          <div className="text-center py-4 space-y-1.5">
            <span className="text-lg">🔗</span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Connect a wallet to get started
            </p>
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500">
              Extension, WalletConnect, or social login
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && !hasAnyWallet && (
          <div className="flex justify-center py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 dark:border-emerald-500 border-t-transparent" />
          </div>
        )}

        {/* Dev Chain Status — only in development */}
        {localRpcFeatureEnabled && <DevChainStatusIndicator />}

        {/* Connect wallets — collapsible section with all options */}
        {/* Gate behind web3Enabled — if disabled, show enable prompt */}
        {isLoggedIn && !web3Enabled ? (
          <Web3EnablePrompt />
        ) : (
        <div className="pt-1">
          <ConnectSection
            connectedIds={connectedConnectorIds}
            connectedConnectorNames={connectedConnectorNames}
            hasWallets={hasAnyWallet}
            onAfterConnect={fetchLinked}
            previousAuthProvider={appKitAuthProvider}
            showLocalRpcOption={localRpcFeatureEnabled}
            localRpcBusy={localRpcBusy}
            localRpcError={localRpcError}
            localRpcNotice={localRpcNotice}
            localRpcSnapshots={localRpcSnapshots}
            localRpcAddedKeys={localRpcAddedKeys}
            activeEvmAddress={activeOverride?.address ?? evmAddress ?? null}
            onAddLocalRpcWallet={handleAddLocalRpcWallet}
            onRunLocalRpcAction={runLocalRpcAction}
            onActivateRpcAccount={handleActivateRpcAccount}
            onRestoreAppKit={() => {
              setTimeout(() => {
                forceRegistryUpdate((v) => v + 1);
                fetchLinked();
              }, 600);
            }}
            onBeforeOpenAppKit={async () => {
              // Disconnect any active AUTH/social session so the modal
              // doesn't gray out other social providers.
              const authConn = connections.find(
                (c) => c.connector.type === 'AUTH' || c.connector.id === 'auth',
              );
              if (authConn) {
                try {
                  await disconnectAsync({ connector: authConn.connector });
                } catch { /* ok */ }
                await new Promise((r) => setTimeout(r, 400));
              }
            }}
          />
        </div>
        )}

        {/* Quick links */}
        {isLoggedIn && web3Enabled && (
          <>
          <Link
            href="/dashboard/trading"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-sky-500 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <FiExternalLink className="h-3 w-3" />
            Trading
          </Link>
          </>
        )}
      </div>

      <AnimatePresence>
        {transferOpen && transferSourceWallet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 p-3 sm:p-6"
            onClick={closeTransferFlow}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-auto mt-6 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="relative mt-0.5">
                    <WalletIcon
                      src={
                        transferSourceIsAuth
                          ? REOWN_ICON_DATA_URI
                          : connectorIconUrl(
                              transferSourceWallet.connectorName ?? transferSourceWallet.family,
                              transferSourceWallet.connectorIcon,
                            )
                      }
                      alt={transferSourceLabel}
                      size={20}
                    />
                    {transferSourceIsAuth &&
                      normalizedTransferSourceProvider &&
                      AUTH_PROVIDER_ICONS[normalizedTransferSourceProvider] && (
                        <div className="absolute -bottom-1 -right-1 rounded-full border border-white dark:border-zinc-900 bg-white dark:bg-zinc-900" style={{ padding: 1 }}>
                          <WalletIcon
                            src={AUTH_PROVIDER_ICONS[normalizedTransferSourceProvider]}
                            alt={transferSourceProviderName ?? "Provider"}
                            size={10}
                          />
                        </div>
                      )}
                  </div>
                  <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Transfer</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {transferSourceLabel} · {trimAddress(transferSourceWallet.address)}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Chain: {transferSourceWallet.chainName ?? nativeSymbol} ·{" "}
                    Balance: {sourceBalanceNative.toFixed(6)} {nativeSymbol}
                    {nativeUsdPrice > 0 ? ` (~${(sourceBalanceNative * nativeUsdPrice).toFixed(2)} kr)` : ""}
                  </p>
                </div>
                </div>
                <button
                  type="button"
                  onClick={closeTransferFlow}
                  className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Destination account</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {transferDestinations.map((wallet) => {
                      const selected = wallet.address.toLowerCase() === transferDestinationAddress.toLowerCase();
                      const isAuthDestination = wallet.connectorType === "AUTH" || wallet.connectorName === "Auth";
                      const normalizedDestinationProvider = wallet.authProvider?.trim().toLowerCase();
                      const destinationProvider =
                        isAuthDestination && normalizedDestinationProvider
                          ? authProviderLabel(normalizedDestinationProvider)
                          : null;
                      const destinationLabel = wallet.customLabel
                        ?? (isAuthDestination
                          ? (destinationProvider ? `Reown via ${destinationProvider}` : "Reown")
                          : wallet.connectorName
                            ? connectorLabel(wallet.connectorName)
                            : wallet.label);
                      return (
                        <button
                          key={wallet.key}
                          type="button"
                          onClick={() => setTransferDestinationAddress(wallet.address)}
                          className={`rounded-lg border p-2 text-left transition-colors ${
                            selected
                              ? "border-sky-500 bg-sky-50 dark:border-emerald-500 dark:bg-emerald-950/30"
                              : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <p className="truncate text-[11px] font-medium text-zinc-900 dark:text-zinc-100">{destinationLabel}</p>
                          <p className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{trimAddress(wallet.address)}</p>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={transferDestinationAddress}
                    onChange={(event) => setTransferDestinationAddress(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[11px] text-zinc-900 outline-none focus:border-sky-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-emerald-500"
                    placeholder="Or enter destination address (0x...)"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {!isManualDestinationValid && (
                    <p className="mt-1 text-[10px] text-red-500">Enter a valid EVM address (0x...).</p>
                  )}
                  {incompatibleDestinationsCount > 0 && (
                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                      {incompatibleDestinationsCount} linked wallet(s) hidden due to different network.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Amount ({nativeSymbol} or kr)</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={transferInput}
                    onChange={(event) => setTransferInput(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-emerald-500"
                    placeholder={`e.g. 0.05 ${nativeSymbol} or 100 kr`}
                  />
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    ≈ {parsedNokAmount > 0 ? `${parsedNokAmount.toFixed(2)} kr` : "0.00 kr"} · {parsedNativeAmount > 0 ? `${parsedNativeAmount.toFixed(8)} ${nativeSymbol}` : `0 ${nativeSymbol}`}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    {[25, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTransferInput((maxTransferNative * (pct / 100)).toFixed(8))}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        {pct}%
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTransferInput(maxTransferNative > 0 ? maxTransferNative.toFixed(8) : "")}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Max
                    </button>
                  </div>
                  <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <p>Estimated network fee: {estimatedFeeNative.toFixed(6)} {nativeSymbol}{nativeUsdPrice > 0 ? ` (~${estimatedFeeNok.toFixed(2)} kr)` : ""}</p>
                    <p>Total cost: {(parsedNativeAmount + estimatedFeeNative).toFixed(8)} {nativeSymbol}</p>
                  </div>
                </div>

                {sameAddress && (
                  <p className="text-[11px] text-red-500">Source and destination cannot be the same wallet.</p>
                )}
                {hasInsufficientFunds && (
                  <p className="text-[11px] text-red-500">Insufficient funds for transfer + gas fee.</p>
                )}

                {transferStep === "sending" && (
                  <p className="text-[11px] font-medium text-amber-500">Step 1/3 · Signing in wallet…</p>
                )}
                {transferStep === "confirming" && (
                  <div className="text-[11px] font-medium text-sky-500 dark:text-emerald-400">
                    <p>Step 2/3 · Broadcasted, waiting for confirmation…</p>
                    {transferTxHash && (
                      <p className="mt-0.5 font-mono text-[10px]">Tx: {trimAddress(transferTxHash, 10, 8)}</p>
                    )}
                  </div>
                )}
                {transferStep === "success" && (
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-[11px] dark:border-emerald-700 dark:bg-emerald-950/30">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">Step 3/3 · Transfer complete</p>
                    <p className="mt-0.5 text-emerald-700/90 dark:text-emerald-300/90">
                      {parsedNativeAmount.toFixed(8)} {nativeSymbol} sent
                    </p>
                    {transferTxHash && (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="font-mono text-emerald-700/90 dark:text-emerald-300/90">{trimAddress(transferTxHash, 10, 8)}</p>
                        {explorerTxUrl(transferSourceWallet.chainId ?? evmChainId, transferTxHash) && (
                          <a
                            href={explorerTxUrl(transferSourceWallet.chainId ?? evmChainId, transferTxHash) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] underline"
                          >
                            View on explorer
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {(transferError || transferStep === "error") && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-red-500">{transferError ?? "Transfer failed"}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const details = `from=${transferSourceAddress};to=${transferDestinationAddress};input=${transferInput};error=${transferError ?? "unknown"}`;
                        navigator.clipboard.writeText(details).catch(() => undefined);
                      }}
                      className="text-[10px] text-zinc-500 underline"
                    >
                      Copy details
                    </button>
                  </div>
                )}

                {transferHistory.length > 0 && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Recent transfers</p>
                    <div className="space-y-1">
                      {transferHistory.slice(0, 3).map((item) => (
                        <p key={item.id} className="text-[10px] text-zinc-600 dark:text-zinc-300">
                          {trimAddress(item.sourceAddress)} → {trimAddress(item.destinationAddress)} · {Number(item.amountNative).toFixed(6)} {item.nativeSymbol}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeTransferFlow}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    {transferStep === "success" ? "Done" : "Cancel"}
                  </button>
                  {transferStep === "success" && (
                    <button
                      type="button"
                      onClick={() => {
                        resetTransfer();
                        setTransferInput("");
                      }}
                      className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      Make another
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSendTransfer}
                    disabled={
                      transferStep === "sending" ||
                      transferStep === "confirming" ||
                      transferStep === "success" ||
                      !hasTransferDestination ||
                      !isManualDestinationValid ||
                      !transferInput ||
                      parsedNativeAmount <= 0 ||
                      sameAddress ||
                      hasInsufficientFunds
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600"
                  >
                    <FiSend className="h-3 w-3" />
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

