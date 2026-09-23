"use client";

/**
 * AppKit (Reown) initialization — provides the polished wallet connection modal
 * with QR codes for mobile, social logins, and multiple wallet support.
 *
 * This is separate from the wagmi config so we can initialize the modal once.
 */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { createLogger } from '@/lib/logger';

const log = createLogger('AppKit');
import type { AppKit } from '@reown/appkit/react';
import { mainnet, sepolia, base, baseSepolia } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { cookieStorage, createStorage, injected } from '@wagmi/core';
import { getDappOrigin } from './dapp-origin';
import { WEB3_PROJECT_ID } from '@/lib/web3-config';

const pulsechain = {
  id: 369,
  name: 'PulseChain',
  nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
};

const anvilLocal = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Local RPC', url: process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? 'http://127.0.0.1:8545' },
  },
};

const ganacheLocal = {
  id: 1337,
  name: 'Ganache Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_GANACHE_RPC_URL ?? 'http://127.0.0.1:7545'] },
  },
  blockExplorers: {
    default: { name: 'Local RPC', url: process.env.NEXT_PUBLIC_GANACHE_RPC_URL ?? 'http://127.0.0.1:7545' },
  },
};

// Determine if running in test mode (development with testnets)
const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true' ||
  process.env.NODE_ENV === 'development';

// Explicit opt-in for local RPC chains outside test mode
const enableLocalChains =
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_CHAINS === 'true' || isTestMode;

// Project ID — prefer Reown AppKit (social login + WC), fall back to WalletConnect-only
const projectId = WEB3_PROJECT_ID;

// Site metadata. `url` must match the page's runtime origin or WalletConnect
// warns of a mismatch, so resolve it lazily (window.location.origin) at the
// createAppKit() call site — see getDappOrigin / ./dapp-origin.
function buildMetadata() {
  const origin = getDappOrigin();
  return {
    name: 'VeggaStare',
    description: 'VeggaStare - Social marketplace platform',
    url: origin,
    icons: [`${origin}/veggastare-icon.png`],
  };
}

// Network list for AppKit — testnets first in test mode
const localNetworks = [anvilLocal as AppKitNetwork, ganacheLocal as AppKitNetwork];

const networks: [AppKitNetwork, ...AppKitNetwork[]] = isTestMode
  ? [
      sepolia,           // Ethereum testnet (primary for dev)
      baseSepolia,       // Base testnet
    ...(enableLocalChains ? localNetworks : []),
      mainnet,           // Keep mainnet available for later testing
      base,
      // PulseChain (custom)
      {
        id: pulsechain.id,
        name: pulsechain.name,
        nativeCurrency: pulsechain.nativeCurrency,
        rpcUrls: {
          default: { http: ['https://rpc.pulsechain.com'] },
        },
        blockExplorers: {
          default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
        },
      },
    ]
  : [
      mainnet,
      sepolia,
      base,
      baseSepolia,
      ...(enableLocalChains ? localNetworks : []),
      // PulseChain (custom)
      {
        id: pulsechain.id,
        name: pulsechain.name,
        nativeCurrency: pulsechain.nativeCurrency,
        rpcUrls: {
          default: { http: ['https://rpc.pulsechain.com'] },
        },
        blockExplorers: {
          default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
        },
      },
    ];

// Default network based on mode
const defaultNetwork = isTestMode ? sepolia : mainnet;

// Create wagmi adapter for AppKit
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
  // Direct extension connections remain available without starting AppKit.
  connectors: [injected({ shimDisconnect: true })],
  storage: createStorage({ storage: cookieStorage }),
});

// Export the wagmi config for WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// Share an in-flight initialization across reconnect and explicit open actions.
// Never put a Suspense/lazy provider around the page to defer this side effect.
declare global {
  var __veggatAppKitPromise: Promise<AppKit> | undefined;
}

/** @fileOverview Start optional wallet services on opt-in or explicit interaction. @stability evolving */
export function ensureAppKit(): Promise<AppKit> {
  if (typeof window === 'undefined' || !projectId) return Promise.reject(new Error('WalletConnect is not configured'));
  if (globalThis.__veggatAppKitPromise) return globalThis.__veggatAppKitPromise;
  globalThis.__veggatAppKitPromise = (async () => {
    const { createAppKit } = await import('@reown/appkit/react');
    const appKit = createAppKit({
      adapters: [wagmiAdapter],
      projectId,
      networks,
      defaultNetwork,
      metadata: buildMetadata(),
      features: {
        email: true, // Enable email login
        socials: ['google', 'x', 'github', 'discord', 'apple'],
        emailShowWallets: true,
        analytics: false, // Disabled — pulse.walletconnect returns 403
      },
      allWallets: 'SHOW',
      // The stable wagmi config already supplies the direct injected connector.
      enableInjected: false,
      themeMode: 'dark', // or 'light' or 'system'
      // Suppress 403 noise: don't check allowed origins against Reown API
      allowUnsupportedChain: true,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        appKit.ready(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet services took too long to start')), 15_000); }),
      ]);
    } finally { clearTimeout(timer); }
    const source = process.env.NEXT_PUBLIC_APPKIT_PROJECT_ID ? 'Reown' : 'WalletConnect';
    log.info(`Initialized (${isTestMode ? 'TEST' : 'PROD'}, ${source})`);
    return appKit;
  })().catch(error => {
    globalThis.__veggatAppKitPromise = undefined;
    throw error;
  });
  return globalThis.__veggatAppKitPromise;
}

export async function openAppKitWallet() {
  const appKit = await ensureAppKit();
  await appKit.open({ view: 'Connect' });
}

/** Previously opted-in accounts can restore; visitors/shop/AI users do not. */
export function AppKitInitializer() {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === 'loading' || !projectId) return;
    let optedIn = session?.user?.web3ModeEnabled === true;
    try { optedIn ||= localStorage.getItem('veggastare:web3ModeEnabled') === 'true'; } catch { /* Storage is optional. */ }
    if (optedIn) void ensureAppKit().catch(() => {
      // Keep the marketplace usable. Explicit wallet actions offer a retry and
      // a direct-extension fallback instead of an unhandled page exception.
      log.warn('Wallet auto-restore unavailable; explicit connection can retry');
    });
  }, [status, session?.user?.web3ModeEnabled]);

  return null;
}
