"use client";

/**
 * AppKit (Reown) initialization — provides the polished wallet connection modal
 * with QR codes for mobile, social logins, and multiple wallet support.
 *
 * This is separate from the wagmi config so we can initialize the modal once.
 */

import { useEffect, useRef } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('AppKit');
import { createAppKit } from '@reown/appkit/react';
import { mainnet, sepolia, base, baseSepolia } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { cookieStorage, createStorage } from '@wagmi/core';
import { getDappOrigin } from './dapp-origin';

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
const projectId = process.env.NEXT_PUBLIC_APPKIT_PROJECT_ID ??
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID ?? '';

const appKitAnalyticsEnabled = process.env.NEXT_PUBLIC_APPKIT_ANALYTICS === 'true';

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
  storage: createStorage({ storage: cookieStorage }),
});

// Export the wagmi config for WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// Singleton guard for AppKit initialization (persist across Fast Refresh)
declare global {
   
  var __veggastareAppKitInitialized: boolean | undefined;
}

/**
 * AppKitInitializer — must be rendered inside WagmiProvider.
 * Initializes the AppKit modal once on the client.
 */
export function AppKitInitializer() {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || globalThis.__veggastareAppKitInitialized || !projectId) return;
    initRef.current = true;
    globalThis.__veggastareAppKitInitialized = true;

    createAppKit({
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
      themeMode: 'dark', // or 'light' or 'system'
      // Suppress 403 noise: don't check allowed origins against Reown API
      allowUnsupportedChain: true,
    });

    const source = process.env.NEXT_PUBLIC_APPKIT_PROJECT_ID ? 'Reown' : 'WalletConnect';
    log.info(`Initialized (${isTestMode ? 'TEST' : 'PROD'}, ${source})`);
  }, []);

  return null;
}
