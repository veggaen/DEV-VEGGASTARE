/**
 * @fileOverview  Wallet address book — localStorage-based nickname storage
 *                for wallet addresses, with search/autocomplete support.
 * @stability     experimental
 */

import { useState, useCallback, useMemo, useSyncExternalStore } from "react";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface AddressBookEntry {
  /** Wallet address (lowercase, canonical) */
  address: string;
  /** User-defined nickname */
  nickname: string;
  /** Chain IDs this address has been seen on */
  chainIds: number[];
  /** ISO timestamp of when entry was created */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────
// Storage
// ────────────────────────────────────────────────────────────

const STORAGE_KEY = "veggat_wallet_address_book";

/** External store listeners for useSyncExternalStore */
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function readEntries(): AddressBookEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AddressBookEntry[];
  } catch {
    return [];
  }
}

function writeEntries(entries: AddressBookEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    emitChange();
  } catch {
    /* localStorage unavailable */
  }
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

export function useWalletAddressBook() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const entries: AddressBookEntry[] = useMemo(() => {
    try {
      return JSON.parse(raw) as AddressBookEntry[];
    } catch {
      return [];
    }
  }, [raw]);

  /** Get nickname for an address (case-insensitive) */
  const getNickname = useCallback(
    (address: string): string | null => {
      const lower = address.toLowerCase();
      return entries.find((e) => e.address === lower)?.nickname ?? null;
    },
    [entries],
  );

  /** Get entry by address */
  const getEntry = useCallback(
    (address: string): AddressBookEntry | null => {
      const lower = address.toLowerCase();
      return entries.find((e) => e.address === lower) ?? null;
    },
    [entries],
  );

  /** Set or update nickname for an address */
  const setNickname = useCallback(
    (address: string, nickname: string, chainId?: number) => {
      const lower = address.toLowerCase();
      const all = readEntries();
      const existing = all.find((e) => e.address === lower);
      const now = new Date().toISOString();

      if (existing) {
        existing.nickname = nickname.trim();
        existing.updatedAt = now;
        if (chainId && !existing.chainIds.includes(chainId)) {
          existing.chainIds.push(chainId);
        }
      } else {
        all.push({
          address: lower,
          nickname: nickname.trim(),
          chainIds: chainId ? [chainId] : [],
          createdAt: now,
          updatedAt: now,
        });
      }

      writeEntries(all);
    },
    [],
  );

  /** Remove an entry */
  const removeEntry = useCallback((address: string) => {
    const lower = address.toLowerCase();
    const all = readEntries().filter((e) => e.address !== lower);
    writeEntries(all);
  }, []);

  /** Search entries by nickname or address prefix */
  const search = useCallback(
    (query: string, limit = 10): AddressBookEntry[] => {
      if (!query.trim()) return entries.slice(0, limit);
      const q = query.toLowerCase().trim();
      return entries
        .filter(
          (e) =>
            e.nickname.toLowerCase().includes(q) ||
            e.address.includes(q),
        )
        .slice(0, limit);
    },
    [entries],
  );

  /** Display label: nickname if available, otherwise truncated address */
  const getDisplayName = useCallback(
    (address: string, headLen = 6, tailLen = 4): string => {
      const nickname = getNickname(address);
      if (nickname) return nickname;
      if (address.length <= headLen + tailLen + 2) return address;
      return `${address.slice(0, headLen)}…${address.slice(-tailLen)}`;
    },
    [getNickname],
  );

  return {
    entries,
    getNickname,
    getEntry,
    getDisplayName,
    setNickname,
    removeEntry,
    search,
  };
}
