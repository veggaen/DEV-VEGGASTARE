"use client";

/**
 * AppKit (Reown) initialization — provides the polished wallet connection modal
 * with QR codes for mobile, social logins, and multiple wallet support.
 *
 * This is separate from the wagmi config so we can initialize the modal once.
 */

import { useEffect, useRef } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { mainnet, sepolia, base, baseSepolia } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { cookieStorage, createStorage } from '@wagmi/core';

const pulsechain = {
  id: 369,
  name: 'PulseChain',
  nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
};

// Determine if running in test mode (development with testnets)
const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true' ||
  process.env.NODE_ENV === 'development';

// Project ID from WalletConnect / Reown Cloud
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID ?? '';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.veggat.com';
const appKitAnalyticsEnabled = process.env.NEXT_PUBLIC_APPKIT_ANALYTICS === 'true';

// Site metadata
const metadata = {
  name: 'VeggaStare',
  description: 'VeggaStare - Social marketplace platform',
  url: siteUrl,
  icons: [`${siteUrl}/veggastare-icon.png`],
};

// Network list for AppKit — testnets first in test mode
const networks: [AppKitNetwork, ...AppKitNetwork[]] = isTestMode
  ? [
      sepolia,           // Ethereum testnet (primary for dev)
      baseSepolia,       // Base testnet
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
      metadata,
      features: {
        email: true, // Enable email login
        socials: ['google', 'x', 'github', 'discord', 'apple'],
        emailShowWallets: true,
        analytics: appKitAnalyticsEnabled,
      },
      allWallets: 'SHOW',
      themeMode: 'dark', // or 'light' or 'system'
    });

    console.log(
      `[AppKitInit] Initialized (${isTestMode ? 'TEST MODE - Sepolia default' : 'PROD - Mainnet default'})`,
      projectId.slice(0, 8) + '...'
    );
  }, []);

  return null;
}
