import { NextResponse } from 'next/server';
import { 
  getExchangeRates, 
  getCryptoPrices,
  areRatesFresh, 
  areCryptoPricesFresh,
  getRatesTimestamp,
  getCryptoPricesTimestamp 
} from '@/lib/currency-rates';

/**
 * GET /api/currency-rates
 * Returns current fiat exchange rates (to USD) and crypto prices (in USD)
 * Fiat rates cached for 1 hour, crypto prices cached for 5 minutes
 */
export async function GET() {
  try {
    const [fiatRates, cryptoPrices] = await Promise.all([
      getExchangeRates(),
      getCryptoPrices(),
    ]);
    
    return NextResponse.json({
      success: true,
      fiat: {
        base: 'USD',
        rates: fiatRates,
        fresh: areRatesFresh(),
        timestamp: getRatesTimestamp(),
        updatedAt: getRatesTimestamp() ? new Date(getRatesTimestamp()!).toISOString() : null,
      },
      crypto: {
        base: 'USD',
        prices: cryptoPrices,
        fresh: areCryptoPricesFresh(),
        timestamp: getCryptoPricesTimestamp(),
        updatedAt: getCryptoPricesTimestamp() ? new Date(getCryptoPricesTimestamp()!).toISOString() : null,
      },
      // Legacy format for backwards compatibility
      rates: fiatRates,
    });
  } catch (error) {
    console.error('[API /currency-rates] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch exchange rates' 
      },
      { status: 500 }
    );
  }
}

// Revalidate every 5 minutes (for crypto)
export const revalidate = 300;
