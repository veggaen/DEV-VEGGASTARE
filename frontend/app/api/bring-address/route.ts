import { NextRequest, NextResponse } from "next/server";

// Bring Address API - https://developer.bring.com/api/address/
// Base URL: https://api.bring.com/address
// Rate limit: 120 requests/second

const BRING_ADDRESS_API = "https://api.bring.com/address/api";
const BRING_API_UID = process.env.BRING_API_UID || "";
const BRING_API_KEY = process.env.BRING_API_KEY || "";

interface AddressSuggestion {
  addressId: string;
  streetName?: string;
  houseNumber?: string;
  letter?: string;
  postalCode: string;
  city: string;
  county?: string;
  municipality?: string;
  type: "STREET" | "PLACE" | "PO_BOX" | "POSTAL_PLACE";
  geoCoordinate?: {
    latitude: number;
    longitude: number;
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
  const countryCode = (searchParams.get("country") || "no").toUpperCase();
  const type = searchParams.get("type") || "suggestions"; // suggestions | streets | validate

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  // Check if API credentials are configured
  if (!BRING_API_UID || !BRING_API_KEY) {
    console.warn("[bring-address] API credentials not configured, using public endpoint");
  }

  try {
    let endpoint: string;
    const params = new URLSearchParams();
    params.set("q", query);

    // Determine endpoint based on query type
    const isPostalCode = /^\d{4}$/.test(query.trim());
    
    switch (type) {
      case "streets":
        endpoint = `${BRING_ADDRESS_API}/${countryCode}/autocomplete`;
        break;
      case "validate":
        endpoint = `${BRING_ADDRESS_API}/${countryCode}/addresses/validate`;
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
          // For addresses, use autocomplete
          endpoint = `${BRING_ADDRESS_API}/${countryCode}/autocomplete`;
        }
        break;
    }

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    // Add authentication if available
    if (BRING_API_UID && BRING_API_KEY) {
      headers["X-MyBring-API-Uid"] = BRING_API_UID;
      headers["X-MyBring-API-Key"] = BRING_API_KEY;
    }

    const url = params.toString() 
      ? `${endpoint}?${params.toString()}`
      : endpoint;

    console.log("[bring-address] Fetching:", url);
    
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[bring-address] API error:", response.status, errorText);
      
      // Return empty suggestions on error rather than failing
      return NextResponse.json({ 
        suggestions: [],
        error: response.status === 429 
          ? "Rate limit exceeded" 
          : response.status === 401 
            ? "Authentication failed - check API credentials"
            : "Address lookup failed"
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

    // Format for frontend consumption
    const formatted = suggestions.map((s, index) => ({
      id: s.addressId || `${s.postalCode}-${index}`,
      street: s.streetName,
      houseNumber: s.houseNumber,
      letter: s.letter,
      postalCode: s.postalCode,
      city: s.city,
      county: s.county,
      municipality: s.municipality,
      type: s.type || "POSTAL_PLACE",
      coords: s.geoCoordinate,
      display: formatAddress(s),
    }));

    console.log("[bring-address] Found", formatted.length, "suggestions");
    return NextResponse.json({ suggestions: formatted });
  } catch (error) {
    console.error("[bring-address] Error:", error);
    return NextResponse.json({ 
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

