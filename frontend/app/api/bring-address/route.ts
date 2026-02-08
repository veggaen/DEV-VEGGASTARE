import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bring Address API - https://developer.bring.com/api/address/
// Base URL: https://api.bring.com/address
// Rate limit: 120 requests/second

const BRING_ADDRESS_API = "https://api.bring.com/address/api";

function getBringCredentials(): { uid: string; key: string; hasCredentials: boolean } {
  const uid = process.env.MYBRING_API_UID || process.env.BRING_API_UID || "";
  const key = process.env.MYBRING_API_KEY || process.env.BRING_API_KEY || "";
  return { uid, key, hasCredentials: Boolean(uid && key) };
}

function jsonNoStore(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

interface AddressSuggestion {
  addressId?: string;
  streetName?: string;
  street_name?: string;
  houseNumber?: string;
  house_number?: number | string;
  letter?: string;
  postalCode?: string;
  postal_code?: string;
  city: string;
  county?: string;
  municipality?: string;
  type: "STREET" | "PLACE" | "PO_BOX" | "POSTAL_PLACE";
  geoCoordinate?: {
    latitude: number;
    longitude: number;
  };
  coordinate?: {
    latitude?: string | number;
    longitude?: string | number;
  };
}

interface BringAddressResponse {
  suggestions?: AddressSuggestion[];
  addresses?: AddressSuggestion[];
  error?: string;
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { suggestions: [], error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const countryCode = (searchParams.get("country") || "no").toLowerCase();
  const type = searchParams.get("type") || "suggestions"; // suggestions | streets | validate

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const { uid: bringApiUid, key: bringApiKey, hasCredentials } = getBringCredentials();

  // Check if API credentials are configured
  if (!hasCredentials) {
    console.warn("[bring-address] API credentials not configured, using public endpoint");
    console.warn("[bring-address] MYBRING_API_UID exists:", Boolean(process.env.MYBRING_API_UID));
    console.warn("[bring-address] BRING_API_UID exists:", Boolean(process.env.BRING_API_UID));
    console.warn("[bring-address] MYBRING_API_KEY exists:", Boolean(process.env.MYBRING_API_KEY));
    console.warn("[bring-address] BRING_API_KEY exists:", Boolean(process.env.BRING_API_KEY));
  }

  try {
    let endpoint: string;
    const params = new URLSearchParams();
    params.set("q", query);

    // Determine endpoint based on query type
    const isPostalCode = /^\d{4}$/.test(query.trim());
    
    switch (type) {
      case "streets":
        // Streets + places suggestions (no house numbers)
        endpoint = `${BRING_ADDRESS_API}/${countryCode}/suggestions`;
        break;
      case "validate":
        endpoint = `${BRING_ADDRESS_API}/${countryCode}/validation`;
        params.delete("q");
        params.set("address", query);
        break;
      case "suggestions":
      default:
        // For postal codes, use postal-places endpoint
        if (isPostalCode) {
          endpoint = `${BRING_ADDRESS_API}/${countryCode}/postal-codes/${query}`;
          params.delete("q");
        } else {
          // For single-input address autocomplete, use address suggestions
          endpoint = `${BRING_ADDRESS_API}/${countryCode}/addresses/suggestions`;
        }
        break;
    }

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    // Add authentication if available
    if (bringApiUid && bringApiKey) {
      headers["X-MyBring-API-Uid"] = bringApiUid;
      headers["X-MyBring-API-Key"] = bringApiKey;
    }

    const url = params.toString() 
      ? `${endpoint}?${params.toString()}`
      : endpoint;

    console.log("[bring-address] Fetching:", url);
    console.log("[bring-address] Has credentials:", hasCredentials);
    
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    console.log("[bring-address] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[bring-address] API error:", response.status, errorText);
      
      // Return empty suggestions on error with more detail
      const errorMessage = response.status === 429 
        ? "Rate limit exceeded" 
        : response.status === 401 
          ? "Authentication failed - check API credentials"
          : response.status === 403
            ? "Access forbidden - API may require whitelisted IP"
            : `Address lookup failed (${response.status})`;
      
      return jsonNoStore({ 
        suggestions: [],
        error: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? {
          status: response.status,
          hasCredentials,
          endpoint: url.split('?')[0],
        } : undefined,
      });
    }

    const data: BringAddressResponse | AddressSuggestion | AddressSuggestion[] = await response.json();

    // Handle different response formats
    let suggestions: AddressSuggestion[] = [];

    if (Array.isArray(data)) {
      // Postal code lookup returns array directly
      suggestions = data;
    } else if ("suggestions" in data) {
      suggestions = data.suggestions || [];
    } else if ("addresses" in data) {
      suggestions = data.addresses || [];
    } else if ("postalCode" in data) {
      // Single postal code result
      suggestions = [data as AddressSuggestion];
    }

    // Format for frontend consumption (handle Bring snake_case fields)
    const formatted = suggestions.map((s, index) => {
      const street = s.streetName || s.street_name;
      const houseNumber = s.houseNumber ?? s.house_number;
      const postalCode = s.postalCode || s.postal_code;
      const coords = s.geoCoordinate || s.coordinate;

      const normalized: AddressSuggestion = {
        ...s,
        streetName: street,
        houseNumber: houseNumber != null ? String(houseNumber) : undefined,
        postalCode: postalCode,
        geoCoordinate: coords
          ? {
              latitude: Number((coords as any).latitude),
              longitude: Number((coords as any).longitude),
            }
          : undefined,
      };

      return {
        id: s.addressId || `${postalCode || 'addr'}-${index}`,
        street,
        houseNumber: houseNumber != null ? String(houseNumber) : undefined,
        letter: s.letter,
        postalCode: postalCode || '',
        city: s.city,
        county: s.county,
        municipality: s.municipality,
        type: s.type || "POSTAL_PLACE",
        coords: normalized.geoCoordinate,
        display: formatAddress(normalized),
      };
    });

    console.log("[bring-address] Found", formatted.length, "suggestions");
    return jsonNoStore({ suggestions: formatted });
  } catch (error) {
    console.error("[bring-address] Error:", error);
    return jsonNoStore({ 
      suggestions: [],
      error: "Failed to fetch address suggestions"
    });
  }
}

function formatAddress(addr: AddressSuggestion): string {
  const parts: string[] = [];

  if (addr.streetName) {
    let street = addr.streetName;
    if (addr.houseNumber) {
      street += ` ${addr.houseNumber}`;
      if (addr.letter) street += addr.letter;
    }
    parts.push(street);
  }

  if (addr.postalCode && addr.city) {
    parts.push(`${addr.postalCode} ${addr.city}`);
  } else if (addr.city) {
    parts.push(addr.city);
  }

  return parts.join(", ");
}

// POST endpoint for batch validation or more complex queries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { addresses, countryCode = "no" } = body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: "No addresses provided" }, { status: 400 });
    }

    // Validate multiple addresses
    const results = await Promise.all(
      addresses.map(async (addr: string) => {
        try {
          const response = await fetch(
            `${BRING_ADDRESS_API}/api/${countryCode}/addresses/validate?address=${encodeURIComponent(addr)}`,
            {
              method: "GET",
              headers: { Accept: "application/json" },
            }
          );

          if (!response.ok) {
            return { address: addr, valid: false, error: "Validation failed" };
          }

          const data = await response.json();
          return {
            address: addr,
            valid: data.valid === true,
            normalized: data.address ? formatAddress(data.address) : null,
            postalCode: data.address?.postalCode,
            suggestions: data.suggestions?.map((s: AddressSuggestion) => formatAddress(s)),
          };
        } catch {
          return { address: addr, valid: false, error: "Validation error" };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[bring-address] POST error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

