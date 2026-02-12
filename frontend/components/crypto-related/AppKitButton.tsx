"use client";

/**
 * AppKitButton — Simple wrapper for AppKit's native wallet button.
 * 
 * Provides a polished wallet connection experience with:
 * - QR codes for mobile wallets
 * - Social logins (Google, X, GitHub, etc.)
 * - Multiple wallet support
 * - Dark/light theme support
 */

import React from 'react';

interface AppKitButtonProps {
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional: only show balance when connected */
  balance?: 'show' | 'hide';
  /** Custom class for the wrapper */
  className?: string;
}

export default function AppKitButton({ size = 'md', balance = 'show', className }: AppKitButtonProps) {
  return (
    <div className={className}>
      <w3m-button
        size={size}
        balance={balance}
      />
    </div>
  );
}

/**
 * AppKitConnectButton — Alternative that just shows Connect button (no account display)
 */
export function AppKitConnectButton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <w3m-connect-button />
    </div>
  );
}

/**
 * AppKitAccountButton — Shows connected account info
 */
export function AppKitAccountButton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <w3m-account-button />
    </div>
  );
}

/**
 * AppKitNetworkButton — Shows network switcher
 */
export function AppKitNetworkButton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <w3m-network-button />
    </div>
  );
}
