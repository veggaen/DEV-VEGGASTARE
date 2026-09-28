/** @fileOverview Wallet display reconciliation without identity guesses or writes. @stability evolving */
export type WalletDisplayState = {
  family: string; address: string; isActive: boolean; isLive: boolean;
  isDefault: boolean; verified: boolean; donationTotalUsd: number;
  dbWalletId?: string; connectorType?: string;
};

/** Only EVM addresses are case-insensitive. A provider/email is never a key. */
export function walletAddressKey(family: string, address: string) {
  return `${family}:${family === 'EVM' ? address.toLowerCase() : address}`;
}

/** Preserve connection order and server proof for the exact same address only.
 * This only builds UI data: it cannot verify ownership or persist metadata. */
export function reconcileWalletDisplay<T extends WalletDisplayState>(wallets: readonly T[], activeEvmAddress?: string): T[] {
  const rows = new Map<string, T>();
  const rank = (wallet: T) => (wallet.isActive ? 8 : 0) + (wallet.isLive ? 4 : 0) + (wallet.dbWalletId ? 2 : 0) + (wallet.connectorType !== 'AUTH' ? 1 : 0);
  for (const wallet of wallets) {
    const key = walletAddressKey(wallet.family, wallet.address);
    const previous = rows.get(key);
    if (!previous) { rows.set(key, { ...wallet }); continue; }
    const preferred = rank(wallet) > rank(previous) ? wallet : previous;
    const other = preferred === wallet ? previous : wallet;
    rows.set(key, { ...other, ...preferred,
      dbWalletId: preferred.dbWalletId ?? other.dbWalletId,
      verified: previous.verified || wallet.verified,
      isDefault: previous.isDefault || wallet.isDefault,
      isLive: previous.isLive || wallet.isLive,
      isActive: previous.isActive || wallet.isActive,
      donationTotalUsd: Math.max(previous.donationTotalUsd, wallet.donationTotalUsd),
    });
  }
  let selected = false;
  return [...rows.values()].map(wallet => {
    const matches = activeEvmAddress
      ? wallet.family === 'EVM' && walletAddressKey('EVM', wallet.address) === walletAddressKey('EVM', activeEvmAddress)
      : wallet.isActive;
    const isActive = !selected && matches;
    selected ||= isActive;
    return { ...wallet, isActive };
  });
}
