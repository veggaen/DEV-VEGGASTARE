import { NextRequest, NextResponse } from "next/server";

/**
 * Bring Pickup Point API Integration
 * Docs: https://developer.bring.com/api/pickup-point/
 * 
 * Find pickup points (post offices, parcel lockers, stores) near an address.
 * Used in checkout to let customers choose where to pick up their package.
 */

const BRING_PICKUP_API = "https://api.bring.com/pickuppoint/api/pickuppoint";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  countryCode: string;
  municipality?: string;
  county?: string;
  visitingAddress?: string;
  visitingPostalCode?: string;
  visitingCity?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  openingHoursNorwegian?: string;
  openingHoursEnglish?: string;
  additionalServiceCode?: string;
  routeDistance?: number; // meters from search location
  distanceInKm?: number;
  type?: string; // e.g., "manned", "locker"
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Query parameters
  const countryCode = searchParams.get("country") || "NO";
  const postalCode = searchParams.get("postalCode");
  const streetAddress = searchParams.get("address");
  const latitude = searchParams.get("lat");
  const longitude = searchParams.get("lon");
  const numberOfResults = searchParams.get("limit") || "10";
  const serviceCode = searchParams.get("serviceCode"); // e.g., "5800" for pickup parcel

  // Must have either postal code or coordinates
  if (!postalCode && (!latitude || !longitude)) {
    return NextResponse.json(
      { error: "Provide postalCode or lat/lon coordinates" },
      { status: 400 }
    );
  }

  try {
    // Build query params for Bring API
    const params = new URLSearchParams({
      countryCode,
      numberOfResponses: numberOfResults,
    });

    if (postalCode) {
      params.set("postalCode", postalCode);
    }
    if (streetAddress) {
      params.set("street", streetAddress);
    }
    if (latitude && longitude) {
      params.set("latitude", latitude);
      params.set("longitude", longitude);
    }
    if (serviceCode) {
      // Filter by service (e.g., only points that support specific delivery type)
      params.set("additionalServiceCode", serviceCode);
    }

    const apiKey = process.env.BRING_SHIPPING_API_KEY;
    const apiUid = process.env.BRING_API_UID;

    const headers: HeadersInit = {
      "Accept": "application/json",
    };

    // Add auth if available (optional for pickup points, but recommended)
    if (apiKey && apiUid) {
      headers["X-MyBring-API-Uid"] = apiUid;
      headers["X-MyBring-API-Key"] = apiKey;
    }

    const response = await fetch(
      `${BRING_PICKUP_API}/${countryCode}/all.json?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[bring-pickup] API error:", response.status, text);
      return NextResponse.json(
        { error: "Failed to fetch pickup points", pickupPoints: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Bring returns pickup points in 'pickupPoint' array
    const rawPoints = data.pickupPoint || [];

    // Transform to cleaner format
    const pickupPoints: PickupPoint[] = rawPoints.map((point: any) => ({
      id: point.id,
      name: point.name,
      address: point.address,
      postalCode: point.postalCode,
      city: point.city,
      countryCode: point.countryCode,
      municipality: point.municipality,
      county: point.county,
      visitingAddress: point.visitingAddress,
      visitingPostalCode: point.visitingPostalCode,
      visitingCity: point.visitingCity,
      latitude: point.latitude ? parseFloat(point.latitude) : undefined,
      longitude: point.longitude ? parseFloat(point.longitude) : undefined,
      openingHours: point.openingHours,
      openingHoursNorwegian: point.openingHoursNorwegian,
      openingHoursEnglish: point.openingHoursEnglish,
      additionalServiceCode: point.additionalServiceCode,
      routeDistance: point.routeDistance,
      distanceInKm: point.routeDistance ? Math.round(point.routeDistance / 100) / 10 : undefined,
      type: point.type,
    }));

    return NextResponse.json({
      pickupPoints,
      count: pickupPoints.length,
      searchedPostalCode: postalCode,
      searchedCoordinates: latitude && longitude ? { latitude, longitude } : undefined,
    });

  } catch (error) {
    console.error("[bring-pickup] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pickup points", pickupPoints: [] },
      { status: 500 }
    );
  }
}

