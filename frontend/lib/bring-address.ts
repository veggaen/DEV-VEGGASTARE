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
  letter: z.string().optional(), // e.g., "A", "B" for addresses like "5A", "5B"
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
let lastGoodResults: BringAddressSuggestion[] = [];
let lastBaseQuery = '';

/**
 * Extract the base street query (without postal code/city/letter filter)
 * E.g., "blåskjellveien 5 43" -> base: "blåskjellveien 5", filter: "43"
 * E.g., "blåskjellveien 5b" -> base: "blåskjellveien 5", filter: "b" (letter filter)
 * E.g., "blåskjellveien 5b 43" -> base: "blåskjellveien 5b", filter: "43"
 */
function extractBaseQuery(query: string): { base: string; filter: string; letterFilter: string } {
  const trimmed = query.trim();
  
  // Check if query has a trailing space + filter (postal code or city)
  // Pattern: street + number[letter] + space + filter
  const spaceFilterMatch = trimmed.match(/^(.+?\s+\d+[a-zA-Z]?)\s+(.+)$/);
  
  if (spaceFilterMatch) {
    const [, base, filter] = spaceFilterMatch;
    // Only treat as filter if it looks like postal code start (digits) or city name (letters)
    if (/^\d+$/.test(filter) || /^[a-zA-ZæøåÆØÅ]+$/i.test(filter)) {
      return { base: base.trim(), filter: filter.toLowerCase(), letterFilter: '' };
    }
  }
  
  // Check if query ends with number+letter (like "5b") without space
  // In this case, we search for "street 5" and filter by letter "b"
  const letterMatch = trimmed.match(/^(.+?\s+\d+)([a-zA-Z])$/);
  if (letterMatch) {
    const [, base, letter] = letterMatch;
    return { base: base.trim(), filter: '', letterFilter: letter.toLowerCase() };
  }
  
  return { base: trimmed, filter: '', letterFilter: '' };
}

/**
 * Filter suggestions based on partial postal code, city name, or letter
 */
function filterSuggestions(
  suggestions: BringAddressSuggestion[],
  filter: string,
  letterFilter: string = ''
): BringAddressSuggestion[] {
  let filtered = suggestions;
  
  // Filter by letter first (e.g., "b" matches addresses with letter "B")
  if (letterFilter) {
    filtered = filtered.filter(s => 
      s.letter?.toLowerCase() === letterFilter
    );
  }
  
  // Then filter by postal code or city
  if (filter) {
    filtered = filtered.filter(s => {
      // Match partial postal code (e.g., "43" matches "4310")
      if (/^\d+$/.test(filter)) {
        return s.postal_code.startsWith(filter);
      }
      // Match city name start (e.g., "sand" matches "Sandnes")
      return s.city.toLowerCase().startsWith(filter) ||
             (s.municipality?.toLowerCase().startsWith(filter) ?? false);
    });
  }
  
  return filtered;
}

/**
 * Search for addresses using Bring's address autocomplete API
 * Debounced to prevent excessive API calls
 * 
 * Smart handling:
 * - Caches last good results for the base query
 * - Filters client-side when user adds postal code, city prefix, or letter
 * - E.g., "blåskjellveien 5 43" will search for "blåskjellveien 5" and filter by "43"
 * - E.g., "blåskjellveien 5b" will search for "blåskjellveien 5" and filter by letter "b"
 */
export async function searchAddresses(
  query: string,
  country: string = 'NO'
): Promise<BringAddressSuggestion[]> {
  if (!query || query.length < 2) {
    return [];
  }

  // Extract base query, filter, and letter filter
  const { base, filter, letterFilter } = extractBaseQuery(query);
  const hasFilter = filter || letterFilter;

  // Cancel previous debounced request
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  return new Promise((resolve) => {
    debounceTimer = setTimeout(async () => {
      try {
        // If we have cached results for this base query, use them and filter client-side
        if (base === lastBaseQuery && lastGoodResults.length > 0 && hasFilter) {
          const filtered = filterSuggestions(lastGoodResults, filter, letterFilter);
          resolve(filtered);
          return;
        }

        const params = new URLSearchParams({
          q: base, // Use base query for API (without postal code/letter filter)
          country,
        });

        const response = await fetch(`${BRING_API_BASE}/search?${params}`);
        
        if (!response.ok) {
          console.warn('[bring-address] Search failed:', response.status);
          // If we have cached results, filter and return them
          if (base === lastBaseQuery && lastGoodResults.length > 0) {
            resolve(filterSuggestions(lastGoodResults, filter, letterFilter));
          } else {
            resolve([]);
          }
          return;
        }

        const data = await response.json();
        const result = BringAddressResponseSchema.safeParse(data);
        
        if (!result.success) {
          console.warn('[bring-address] Invalid response:', result.error);
          resolve([]);
          return;
        }

        const suggestions = result.data.suggestions;
        
        // Cache results for this base query
        if (suggestions.length > 0) {
          lastBaseQuery = base;
          lastGoodResults = suggestions;
        }

        // Apply filter if present
        const filtered = hasFilter ? filterSuggestions(suggestions, filter, letterFilter) : suggestions;
        resolve(filtered);
      } catch (error) {
        console.error('[bring-address] Search error:', error);
        // On error, try to use cached results
        if (base === lastBaseQuery && lastGoodResults.length > 0) {
          resolve(filterSuggestions(lastGoodResults, filter, letterFilter));
        } else {
          resolve([]);
        }
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
