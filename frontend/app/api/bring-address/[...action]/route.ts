/**
 * Bring Address API proxy
 * https://developer.bring.com/api/address/
 * 
 * Proxies requests to Bring's address services to:
 * 1. Keep API keys secure (server-side only)
 * 2. Handle CORS issues
 * 3. Provide consistent error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Bring API configuration
const BRING_API_URL = 'https://api.bring.com/address/api';
const BRING_API_UID = process.env.BRING_API_UID || '';
const BRING_API_KEY = process.env.BRING_API_KEY || '';

// Rate limiting (simple in-memory, per-IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

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

// Query parameter schemas
const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  country: z.string().length(2).default('NO'),
});

const PostalCodeQuerySchema = z.object({
  postalCode: z.string().min(4).max(10),
  country: z.string().length(2).default('NO'),
});

const ValidateQuerySchema = z.object({
  street: z.string().max(200),
  postal_code: z.string().max(10),
  city: z.string().max(100),
  country: z.string().length(2).default('NO'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { action } = await params;
    const actionPath = action?.[0];
    const searchParams = request.nextUrl.searchParams;

    // Check if Bring API is configured
    if (!BRING_API_UID || !BRING_API_KEY) {
      console.warn('[bring-address] API credentials not configured');
      // Return empty results instead of error to not break the UI
      return NextResponse.json({ suggestions: [], postal_codes: [] });
    }

    const headers: HeadersInit = {
      'Accept': 'application/json',
      'X-MyBring-API-Uid': BRING_API_UID,
      'X-MyBring-API-Key': BRING_API_KEY,
    };

    switch (actionPath) {
      case 'search': {
        const query = SearchQuerySchema.safeParse({
          q: searchParams.get('q'),
          country: searchParams.get('country') || 'NO',
        });

        if (!query.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters', details: query.error.flatten() },
            { status: 400 }
          );
        }

        // Bring's address search endpoint
        const url = `${BRING_API_URL}/${query.data.country}/autocomplete?q=${encodeURIComponent(query.data.q)}`;
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          console.error('[bring-address] Search API error:', response.status);
          return NextResponse.json({ suggestions: [] });
        }

        const data = await response.json();
        
        // Transform Bring's response to our format
        const suggestions = (data.suggestions || data.addresses || []).map((item: Record<string, unknown>) => ({
          street: item.street || item.streetName || '',
          street_number: item.streetNumber || item.houseNumber || '',
          postal_code: item.postalCode || item.zipCode || '',
          city: item.city || item.postalPlace || '',
          municipality: item.municipality || '',
          county: item.county || '',
          country: query.data.country,
          latitude: item.latitude || '',
          longitude: item.longitude || '',
        }));

        return NextResponse.json({ suggestions });
      }

      case 'postal-code': {
        const query = PostalCodeQuerySchema.safeParse({
          postalCode: searchParams.get('postalCode'),
          country: searchParams.get('country') || 'NO',
        });

        if (!query.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters', details: query.error.flatten() },
            { status: 400 }
          );
        }

        // Bring's postal code lookup endpoint
        const url = `${BRING_API_URL}/${query.data.country}/postal-codes/${query.data.postalCode}`;
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          console.error('[bring-address] Postal code API error:', response.status);
          return NextResponse.json({ postal_codes: [] });
        }

        const data = await response.json();
        
        // Transform response
        const postalCodes = Array.isArray(data) ? data : [data];
        const formatted = postalCodes
          .filter((item: Record<string, unknown>) => item && item.postalCode)
          .map((item: Record<string, unknown>) => ({
            postal_code: item.postalCode || item.zipCode || '',
            city: item.city || item.postalPlace || '',
            municipality: item.municipality || '',
            municipalityId: item.municipalityId || '',
            county: item.county || '',
            po_box: item.poBox || false,
            latitude: item.latitude || '',
            longitude: item.longitude || '',
          }));

        return NextResponse.json({ postal_codes: formatted });
      }

      case 'validate': {
        const query = ValidateQuerySchema.safeParse({
          street: searchParams.get('street'),
          postal_code: searchParams.get('postal_code'),
          city: searchParams.get('city'),
          country: searchParams.get('country') || 'NO',
        });

        if (!query.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters', details: query.error.flatten() },
            { status: 400 }
          );
        }

        // Bring's address validation endpoint
        const url = new URL(`${BRING_API_URL}/${query.data.country}/addresses/validate`);
        url.searchParams.set('streetName', query.data.street);
        url.searchParams.set('postalCode', query.data.postal_code);
        url.searchParams.set('city', query.data.city);
        
        const response = await fetch(url.toString(), { headers });
        
        if (!response.ok) {
          // Validation endpoint may return 404 for invalid addresses
          return NextResponse.json({ valid: false });
        }

        const data = await response.json();
        
        return NextResponse.json({
          valid: true,
          street: data.streetName || query.data.street,
          postal_code: data.postalCode || query.data.postal_code,
          city: data.city || data.postalPlace || query.data.city,
          municipality: data.municipality || '',
          county: data.county || '',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action. Use: search, postal-code, or validate' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[bring-address] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
