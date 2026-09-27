/**
 * @fileOverview  The markets the paper terminal can chart and trade. Shared by
 *                client and server: symbol metadata, the Binance pair used for
 *                candles/tickers and the CoinGecko id used as a fallback.
 *                Everything here is quoted in USD (USDT pairs on Binance).
 * @stability     experimental
 */

export type Market = {
  symbol: string;
  name: string;
  /** Brand colour for the market list dot / chart legend. */
  color: string;
  decimals: number;
  chainId: number;
  address: string;
  /** Binance spot pair; null when the asset is not listed there. */
  pair: string | null;
  /** CoinGecko coin id (fallback candles + tickers, and the paper price feed). */
  cgId: string | null;
  stable?: boolean;
};

export const MARKETS: Market[] = [
  { symbol: "BTC", name: "Bitcoin", color: "#F7931A", decimals: 8, chainId: 1, address: "0x0", pair: "BTCUSDT", cgId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", color: "#627EEA", decimals: 18, chainId: 1, address: "0x0", pair: "ETHUSDT", cgId: "ethereum" },
  { symbol: "SOL", name: "Solana", color: "#9945FF", decimals: 9, chainId: 1, address: "0x0", pair: "SOLUSDT", cgId: "solana" },
  { symbol: "XRP", name: "XRP", color: "#23292F", decimals: 6, chainId: 1, address: "0x0", pair: "XRPUSDT", cgId: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", color: "#C2A633", decimals: 8, chainId: 1, address: "0x0", pair: "DOGEUSDT", cgId: "dogecoin" },
  { symbol: "ADA", name: "Cardano", color: "#0033AD", decimals: 6, chainId: 1, address: "0x0", pair: "ADAUSDT", cgId: "cardano" },
  { symbol: "AVAX", name: "Avalanche", color: "#E84142", decimals: 18, chainId: 1, address: "0x0", pair: "AVAXUSDT", cgId: "avalanche-2" },
  { symbol: "LINK", name: "Chainlink", color: "#2A5ADA", decimals: 18, chainId: 1, address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", pair: "LINKUSDT", cgId: "chainlink" },
  { symbol: "DOT", name: "Polkadot", color: "#E6007A", decimals: 10, chainId: 1, address: "0x0", pair: "DOTUSDT", cgId: "polkadot" },
  { symbol: "UNI", name: "Uniswap", color: "#FF007A", decimals: 18, chainId: 1, address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", pair: "UNIUSDT", cgId: "uniswap" },
  { symbol: "AAVE", name: "Aave", color: "#B6509E", decimals: 18, chainId: 1, address: "0x0", pair: "AAVEUSDT", cgId: "aave" },
  { symbol: "ARB", name: "Arbitrum", color: "#28A0F0", decimals: 18, chainId: 42161, address: "0x0", pair: "ARBUSDT", cgId: "arbitrum" },
  { symbol: "OP", name: "Optimism", color: "#FF0420", decimals: 18, chainId: 10, address: "0x0", pair: "OPUSDT", cgId: "optimism" },
  { symbol: "MATIC", name: "Polygon", color: "#8247E5", decimals: 18, chainId: 137, address: "0x0", pair: "POLUSDT", cgId: "matic-network" },
  { symbol: "ATOM", name: "Cosmos", color: "#2E3148", decimals: 6, chainId: 1, address: "0x0", pair: "ATOMUSDT", cgId: "cosmos" },
  { symbol: "NEAR", name: "NEAR Protocol", color: "#00C1DE", decimals: 24, chainId: 1, address: "0x0", pair: "NEARUSDT", cgId: "near" },
  { symbol: "SUI", name: "Sui", color: "#4DA2FF", decimals: 9, chainId: 1, address: "0x0", pair: "SUIUSDT", cgId: "sui" },
  { symbol: "APT", name: "Aptos", color: "#06C8A4", decimals: 8, chainId: 1, address: "0x0", pair: "APTUSDT", cgId: "aptos" },
  { symbol: "INJ", name: "Injective", color: "#00F2FE", decimals: 18, chainId: 1, address: "0x0", pair: "INJUSDT", cgId: "injective-protocol" },
  { symbol: "TIA", name: "Celestia", color: "#7B2FBE", decimals: 6, chainId: 1, address: "0x0", pair: "TIAUSDT", cgId: "celestia" },
  { symbol: "SEI", name: "Sei", color: "#9B1B30", decimals: 6, chainId: 1, address: "0x0", pair: "SEIUSDT", cgId: "sei-network" },
  { symbol: "WLD", name: "Worldcoin", color: "#8B8B8B", decimals: 18, chainId: 1, address: "0x0", pair: "WLDUSDT", cgId: "worldcoin-wld" },
  { symbol: "RENDER", name: "Render", color: "#E0332B", decimals: 18, chainId: 1, address: "0x0", pair: "RENDERUSDT", cgId: "render-token" },
  { symbol: "PEPE", name: "Pepe", color: "#3D7B30", decimals: 18, chainId: 1, address: "0x0", pair: "PEPEUSDT", cgId: "pepe" },
  { symbol: "SHIB", name: "Shiba Inu", color: "#FFA409", decimals: 18, chainId: 1, address: "0x0", pair: "SHIBUSDT", cgId: "shiba-inu" },
  { symbol: "HEX", name: "HEX", color: "#FF00FF", decimals: 8, chainId: 1, address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", pair: null, cgId: "hex" },
  { symbol: "PLS", name: "PulseChain", color: "#00FF00", decimals: 18, chainId: 369, address: "0x0", pair: null, cgId: "pulsechain" },
  { symbol: "USDC", name: "USD Coin", color: "#2775CA", decimals: 6, chainId: 1, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", pair: null, cgId: "usd-coin", stable: true },
  { symbol: "USDT", name: "Tether", color: "#50AF95", decimals: 6, chainId: 1, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", pair: null, cgId: "tether", stable: true },
];

const BY_SYMBOL = new Map(MARKETS.map((m) => [m.symbol, m]));

export function marketBySymbol(symbol: string): Market | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

/** Markets that can be charted (a price series exists somewhere). */
export const CHARTABLE_MARKETS = MARKETS.filter((m) => !m.stable);

export const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;
export type Interval = (typeof INTERVALS)[number];
export const INTERVAL_MS: Record<Interval, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
};
export function isInterval(value: string): value is Interval {
  return (INTERVALS as readonly string[]).includes(value);
}

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type CandleResponse = {
  symbol: string;
  interval: Interval;
  source: "binance" | "coingecko";
  /** True when the fallback feed could not honour the requested granularity. */
  approximate: boolean;
  candles: Candle[];
  fetchedAt: number;
};

export type Ticker = {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  source: "binance" | "coingecko" | "stable";
};
