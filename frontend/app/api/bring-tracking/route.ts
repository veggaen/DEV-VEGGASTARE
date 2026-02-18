import { NextRequest, NextResponse } from "next/server";

/**
 * Bring Tracking API Integration
 * Docs: https://developer.bring.com/api/tracking/
 * 
 * Track shipments in real-time. Use this to show tracking status to customers
 * after they've received their tracking number from the Booking API.
 */

const BRING_TRACKING_API = "https://tracking.bring.com/api/v2/tracking.json";

interface TrackingEvent {
  description: string;
  status: string;
  dateIso: string;
  displayDate: string;
  displayTime: string;
  postalCode?: string;
  city?: string;
  country?: string;
  unitId?: string;
  unitType?: string;
}

interface TrackingPackage {
  packageNumber: string;
  statusDescription: string;
  dateOfDelivery?: string;
  dateOfReturn?: string;
  eventSet: TrackingEvent[];
  productName?: string;
  productCode?: string;
  brand?: string;
  senderName?: string;
  recipientName?: string;
  totalWeightInKgs?: number;
  totalVolumeInDm3?: number;
}

interface TrackingConsignment {
  consignmentId: string;
  isPickupNoticeAvailable?: boolean;
  packageSet: TrackingPackage[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const trackingNumber = searchParams.get("q") || searchParams.get("tracking");
  const language = searchParams.get("lang") || "en";

  if (!trackingNumber) {
    return NextResponse.json(
      { error: "Tracking number is required" },
      { status: 400 }
    );
  }

  try {
    // Bring accepts multiple tracking numbers comma-separated
    const trackingNumbers = trackingNumber.split(",").map(t => t.trim()).filter(Boolean);
    
    if (trackingNumbers.length === 0) {
      return NextResponse.json(
        { error: "No valid tracking numbers provided" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      q: trackingNumbers.join(","),
      // Language for status descriptions
      ...(language && { lang: language }),
    });

    const apiKey = process.env.BRING_SHIPPING_API_KEY;
    const apiUid = process.env.BRING_API_UID;

    const headers: HeadersInit = {
      "Accept": "application/json",
    };

    // Add auth if available (recommended for higher rate limits)
    if (apiKey && apiUid) {
      headers["X-MyBring-API-Uid"] = apiUid;
      headers["X-MyBring-API-Key"] = apiKey;
    }

    const response = await fetch(
      `${BRING_TRACKING_API}?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[bring-tracking] API error:", response.status, text);
      
      if (response.status === 404) {
        return NextResponse.json({
          error: "Tracking number not found",
          trackingNumber,
          consignments: [],
        });
      }
      
      return NextResponse.json(
        { error: "Failed to fetch tracking info" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform response
    const consignmentSet = data.consignmentSet || [];
    
    const consignments: TrackingConsignment[] = consignmentSet.map((consignment: any) => ({
      consignmentId: consignment.consignmentId,
      isPickupNoticeAvailable: consignment.isPickupNoticeAvailable,
      packageSet: (consignment.packageSet || []).map((pkg: any) => ({
        packageNumber: pkg.packageNumber,
        statusDescription: pkg.statusDescription,
        dateOfDelivery: pkg.dateOfDelivery,
        dateOfReturn: pkg.dateOfReturn,
        productName: pkg.productName,
        productCode: pkg.productCode,
        brand: pkg.brand,
        senderName: pkg.senderName,
        recipientName: pkg.recipientName?.substring(0, 3) + "***", // Privacy: mask recipient
        totalWeightInKgs: pkg.totalWeightInKgs,
        totalVolumeInDm3: pkg.totalVolumeInDm3,
        eventSet: (pkg.eventSet || []).map((event: any) => ({
          description: event.description,
          status: event.status,
          dateIso: event.dateIso,
          displayDate: event.displayDate,
          displayTime: event.displayTime,
          postalCode: event.postalCode,
          city: event.city,
          country: event.country,
          unitId: event.unitId,
          unitType: event.unitType,
        })),
      })),
    }));

    // Get summary for quick display
    const latestPackage = consignments[0]?.packageSet?.[0];
    const latestEvent = latestPackage?.eventSet?.[0];

    return NextResponse.json({
      trackingNumber: trackingNumbers[0],
      status: latestPackage?.statusDescription || "Unknown",
      lastUpdate: latestEvent ? {
        description: latestEvent.description,
        date: latestEvent.displayDate,
        time: latestEvent.displayTime,
        location: latestEvent.city,
      } : null,
      delivered: latestPackage?.dateOfDelivery ? true : false,
      deliveryDate: latestPackage?.dateOfDelivery,
      consignments,
      trackingUrl: `https://tracking.bring.com/tracking/${trackingNumbers[0]}`,
    });

  } catch (error) {
    console.error("[bring-tracking] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracking info" },
      { status: 500 }
    );
  }
}

