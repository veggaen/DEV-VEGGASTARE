/**
 * @fileOverview  Token icon resolution utilities.
 *               Uses Trust Wallet assets CDN as primary source (6000+ tokens),
 *               with inline SVG fallbacks for common tokens and generated letter icons.
 *
 *  Resolution chain:
 *    1. Trust Wallet CDN (real logos)
 *    2. Inline SVG by symbol (hardcoded common tokens)
 *    3. Generated coloured circle with first letter (any token)
 *
 * @stability     stable
 */

// ── Trust Wallet CDN ────────────────────────────────────────────────────────

const TW_CDN =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

/** Chain ID → Trust Wallet directory name */
const TW_CHAIN_NAMES: Record<number, string> = {
  1: "ethereum",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  56: "smartchain",
  43114: "avalanchec",
  250: "fantom",
  324: "zksync",
  59144: "linea",
};

/**
 * Get the Trust Wallet CDN logo URL for a token.
 * Returns undefined for unsupported chains.
 * Requires **checksummed** (EIP-55) addresses for reliable matching.
 */
export function getTrustWalletLogoUrl(
  address: string,
  chainId: number,
): string | undefined {
  const chain = TW_CHAIN_NAMES[chainId];
  if (!chain) return undefined;

  // Native token → chain info logo
  const isNative =
    !address ||
    address === "0x0" ||
    address.toLowerCase() ===
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  if (isNative) {
    return `${TW_CDN}/${chain}/info/logo.png`;
  }

  return `${TW_CDN}/${chain}/assets/${address}/logo.png`;
}

// ── Inline Fallback Logos ───────────────────────────────────────────────────

/** Reliable coloured-circle SVGs for common tokens — zero network, always render. */
export const TOKEN_LOGO_FALLBACKS: Record<string, string> = {
  ETH: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23627EEA'/%3E%3Cpath d='M16.5 4v8.9l7.5 3.3L16.5 4z' fill='%23fff' fill-opacity='.6'/%3E%3Cpath d='M16.5 4L9 16.2l7.5-3.3V4z' fill='%23fff'/%3E%3Cpath d='M16.5 21.9v6.1l7.5-10.4-7.5 4.3z' fill='%23fff' fill-opacity='.6'/%3E%3Cpath d='M16.5 28v-6.1L9 17.6l7.5 10.4z' fill='%23fff'/%3E%3Cpath d='M16.5 20.6l7.5-4.4-7.5-3.3v7.7z' fill='%23fff' fill-opacity='.2'/%3E%3Cpath d='M9 16.2l7.5 4.4v-7.7L9 16.2z' fill='%23fff' fill-opacity='.6'/%3E%3C/svg%3E",
  USDC: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232775CA'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='14' font-weight='bold' fill='white' font-family='Arial'%3E$%3C/text%3E%3C/svg%3E",
  USDT: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%2326A17B'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='14' font-weight='bold' fill='white' font-family='Arial'%3E₮%3C/text%3E%3C/svg%3E",
  DAI: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23F5AC37'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='12' font-weight='bold' fill='white' font-family='Arial'%3ED%3C/text%3E%3C/svg%3E",
  WBTC: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23F09242'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='12' font-weight='bold' fill='white' font-family='Arial'%3E₿%3C/text%3E%3C/svg%3E",
  LINK: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232A5ADA'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='10' font-weight='bold' fill='white' font-family='Arial'%3ELK%3C/text%3E%3C/svg%3E",
  UNI: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23FF007A'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='10' font-weight='bold' fill='white' font-family='Arial'%3EUNi%3C/text%3E%3C/svg%3E",
  HEX: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23FF00FF'/%3E%3Cpolygon points='16,6 24,11 24,21 16,26 8,21 8,11' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E",
  PLS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%2300CC00'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='10' font-weight='bold' fill='white' font-family='Arial'%3EPLS%3C/text%3E%3C/svg%3E",
  MATIC: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%238247E5'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='8' font-weight='bold' fill='white' font-family='Arial'%3EMAT%3C/text%3E%3C/svg%3E",
  BNB: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23F3BA2F'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='10' font-weight='bold' fill='white' font-family='Arial'%3EBNB%3C/text%3E%3C/svg%3E",
  AVAX: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23E84142'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='8' font-weight='bold' fill='white' font-family='Arial'%3EAVAX%3C/text%3E%3C/svg%3E",
  ARB: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%2328A0F0'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='8' font-weight='bold' fill='white' font-family='Arial'%3EARB%3C/text%3E%3C/svg%3E",
  OP: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23FF0420'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='10' font-weight='bold' fill='white' font-family='Arial'%3EOP%3C/text%3E%3C/svg%3E",
  WETH: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23627EEA'/%3E%3Cpath d='M16.5 4v8.9l7.5 3.3L16.5 4z' fill='%23fff' fill-opacity='.6'/%3E%3Cpath d='M16.5 4L9 16.2l7.5-3.3V4z' fill='%23fff'/%3E%3Cpath d='M16.5 21.9v6.1l7.5-10.4-7.5 4.3z' fill='%23fff' fill-opacity='.6'/%3E%3Cpath d='M16.5 28v-6.1L9 17.6l7.5 10.4z' fill='%23fff'/%3E%3C/svg%3E",
};

// ── Chain Explorer URLs ─────────────────────────────────────────────────────

/** Chain ID → block explorer base URL */
export const CHAIN_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  137: "https://polygonscan.com",
  42161: "https://arbiscan.io",
  10: "https://optimistic.etherscan.io",
  8453: "https://basescan.org",
  56: "https://bscscan.com",
  43114: "https://snowtrace.io",
  250: "https://ftmscan.com",
  59144: "https://lineascan.build",
  534352: "https://scrollscan.com",
  324: "https://explorer.zksync.io",
};

/** Get the explorer URL for a transaction hash. */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const base = CHAIN_EXPLORERS[chainId] ?? "https://etherscan.io";
  return `${base}/tx/${txHash}`;
}

// ── Generated Fallback ──────────────────────────────────────────────────────

const PALETTE = [
  "#627EEA", "#2775CA", "#26A17B", "#F5AC37", "#FF007A",
  "#2A5ADA", "#F09242", "#8247E5", "#FF0420", "#0052FF",
  "#E84142", "#F3BA2F", "#00CC00", "#28A0F0",
];

/**
 * Generate a coloured circle with the first letter of the symbol.
 * Used as the ultimate fallback when no logo is found.
 */
export function generateLetterIcon(symbol: string): string {
  const hash = symbol
    .toUpperCase()
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = PALETTE[hash % PALETTE.length];
  const letter = symbol.charAt(0).toUpperCase();

  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='${encodeURIComponent(color)}'/%3E%3Ctext x='16' y='21' text-anchor='middle' font-size='14' font-weight='bold' fill='white' font-family='Arial'%3E${encodeURIComponent(letter)}%3C/text%3E%3C/svg%3E`;
}
