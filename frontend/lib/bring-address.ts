/**
 * Bring Address API integration
 * https://developer.bring.com/api/address/
 * 
 * Provides Norwegian address lookup and autocomplete functionality
 */

import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Single address suggestion from Bring API
 */
export const BringAddressSuggestionSchema = z.object({
  street: z.string(),
  street_number: z.string().optional(),
  postal_code: z.string(),
  city: z.string(),
  municipality: z.string().optional(),
  county: z.string().optional(),
  country: z.string().default('NO'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export type BringAddressSuggestion = z.infer<typeof BringAddressSuggestionSchema>;

/**
 * Response from Bring Address API
 */
export const BringAddressResponseSchema = z.object({
  suggestions: z.array(BringAddressSuggestionSchema),
});

/**
 * Postal code lookup response
 */
export const BringPostalCodeSchema = z.object({
  postal_code: z.string(),
  city: z.string(),
  municipality: z.string().optional(),
  municipalityId: z.string().optional(),
  county: z.string().optional(),
  po_box: z.boolean().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export type BringPostalCode = z.infer<typeof BringPostalCodeSchema>;

export const BringPostalCodesResponseSchema = z.object({
  postal_codes: z.array(BringPostalCodeSchema),
});

/**
 * Full shipping address schema for form validation
 */
export const ShippingAddressSchema = z.object({
  streetAddress: z.string().min(1, 'Street address is required'),
  streetNumber: z.string().optional(),
  postalCode: z.string().min(4, 'Postal code must be at least 4 characters'),
  city: z.string().min(1, 'City is required'),
  municipality: z.string().optional(),
  county: z.string().optional(),
  country: z.string().default('NO'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

// =============================================================================
// API FUNCTIONS
// =============================================================================

const BRING_API_BASE = '/api/bring-address';
const DEBOUNCE_MS = 300;

let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Search for addresses using Bring's address autocomplete API
 * Debounced to prevent excessive API calls
 */
export async function searchAddresses(
  query: string,
  country: string = 'NO'
): Promise<BringAddressSuggestion[]> {
  if (!query || query.length < 2) {
    return [];
  }

  // Cancel previous debounced request
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  return new Promise((resolve, reject) => {
    debounceTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          country,
        });

        const response = await fetch(`${BRING_API_BASE}/search?${params}`);
        
        if (!response.ok) {
          console.warn('[bring-address] Search failed:', response.status);
          resolve([]);
          return;
        }

        const data = await response.json();
        const result = BringAddressResponseSchema.safeParse(data);
        
        if (!result.success) {
          console.warn('[bring-address] Invalid response:', result.error);
          resolve([]);
          return;
        }

        resolve(result.data.suggestions);
      } catch (error) {
        console.error('[bring-address] Search error:', error);
        resolve([]);
      }
    }, DEBOUNCE_MS);
  });
}

/**
 * Lookup postal code details
 */
export async function lookupPostalCode(
  postalCode: string,
  country: string = 'NO'
): Promise<BringPostalCode | null> {
  if (!postalCode || postalCode.length < 4) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      postalCode,
      country,
    });

    const response = await fetch(`${BRING_API_BASE}/postal-code?${params}`);
    
    if (!response.ok) {
      console.warn('[bring-address] Postal code lookup failed:', response.status);
      return null;
    }

    const data = await response.json();
    const result = BringPostalCodesResponseSchema.safeParse(data);
    
    if (!result.success || result.data.postal_codes.length === 0) {
      return null;
    }

    return result.data.postal_codes[0];
  } catch (error) {
    console.error('[bring-address] Postal code lookup error:', error);
    return null;
  }
}

/**
 * Validate a complete address
 */
export async function validateAddress(
  address: Partial<ShippingAddress>
): Promise<{ valid: boolean; normalized?: ShippingAddress; errors?: string[] }> {
  try {
    // First validate locally
    const localResult = ShippingAddressSchema.safeParse(address);
    if (!localResult.success) {
      return {
        valid: false,
        errors: localResult.error.errors.map(e => e.message),
      };
    }

    // Then validate with Bring API
    const params = new URLSearchParams({
      street: address.streetAddress || '',
      postal_code: address.postalCode || '',
      city: address.city || '',
      country: address.country || 'NO',
    });

    const response = await fetch(`${BRING_API_BASE}/validate?${params}`);
    
    if (!response.ok) {
      // API validation failed, but local validation passed
      return { valid: true, normalized: localResult.data };
    }

    const data = await response.json();
    
    return {
      valid: true,
      normalized: {
        ...localResult.data,
        // Use normalized values from API if available
        city: data.city || localResult.data.city,
        municipality: data.municipality || localResult.data.municipality,
        county: data.county || localResult.data.county,
      },
    };
  } catch (error) {
    console.error('[bring-address] Validation error:', error);
    // Fallback to local validation only
    const localResult = ShippingAddressSchema.safeParse(address);
    return {
      valid: localResult.success,
      normalized: localResult.success ? localResult.data : undefined,
      errors: localResult.success ? undefined : localResult.error.errors.map(e => e.message),
    };
  }
}

/**
 * Format an address for display
 */
export function formatAddress(address: Partial<ShippingAddress>): string {
  const parts: string[] = [];
  
  if (address.streetAddress) {
    parts.push(
      address.streetNumber 
        ? `${address.streetAddress} ${address.streetNumber}`
        : address.streetAddress
    );
  }
  
  if (address.postalCode || address.city) {
    parts.push(
      [address.postalCode, address.city].filter(Boolean).join(' ')
    );
  }
  
  if (address.country && address.country !== 'NO') {
    parts.push(address.country);
  }
  
  return parts.join(', ');
}

/**
 * Parse a free-text address string into components
 * Best-effort parsing, may not be perfect
 */
export function parseAddressString(addressString: string): Partial<ShippingAddress> {
  const result: Partial<ShippingAddress> = {};
  
  // Try to extract postal code (4 digits for Norway)
  const postalMatch = addressString.match(/\b(\d{4})\b/);
  if (postalMatch) {
    result.postalCode = postalMatch[1];
  }
  
  // Try to extract street number
  const streetNumberMatch = addressString.match(/\b(\d+[a-zA-Z]?)\b/);
  if (streetNumberMatch && streetNumberMatch[1] !== result.postalCode) {
    result.streetNumber = streetNumberMatch[1];
  }
  
  return result;
}
