import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultBringLiveEnabled, getRuntimeConfig } from "@/lib/runtime-config";

/**
 * Bring Booking API Integration
 * Docs: https://developer.bring.com/api/booking/
 * 
 * This API creates actual shipments, generates labels, and provides tracking.
 * 
 * IMPORTANT: Use X-Bring-Test-Indicator: true for testing!
 * This creates test bookings that won't generate real shipments or charges.
 */

const BringPartySchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  postalCode: z.string().min(1).max(20),
  city: z.string().min(1).max(200),
  countryCode: z.string().length(2).default("NO"),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(30).optional(),
});

const BringPackageSchema = z.object({
  weight: z.number().positive().max(100_000), // grams
  dimensions: z.object({
    height: z.number().positive().max(500),
    width: z.number().positive().max(500),
    length: z.number().positive().max(500),
  }).optional(),
  description: z.string().max(200).optional(),
});

const BringBookingBodySchema = z.object({
  sender: BringPartySchema,
  recipient: BringPartySchema,
  packages: z.array(BringPackageSchema).min(1).max(50),
  serviceCode: z.string().max(20).default("5800"),
  shippingDate: z.string().max(30).optional(),
  orderId: z.string().max(100).optional(),
});

const BRING_BOOKING_API = "https://api.bring.com/booking/api";

// Environment variables needed:
// BRING_API_KEY - Your MyBring API key
// BRING_API_UID - Your MyBring user ID (email)
// BRING_CUSTOMER_NUMBER - Your Bring customer number (for pricing)
// BRING_TEST_MODE - "true" for test bookings

interface BookingConsignment {
  shippingDate: string; // ISO date
  parties: {
    sender: {
      name: string;
      addressLine: string;
      postalCode: string;
      city: string;
      countryCode: string;
      email?: string;
      phoneNumber?: string;
    };
    recipient: {
      name: string;
      addressLine: string;
      postalCode: string;
      city: string;
      countryCode: string;
      email?: string;
      phoneNumber?: string;
    };
  };
  product: {
    id: string; // Service code e.g., "5600" for standard parcel
    customerNumber: string;
  };
  packages: Array<{
    weightInKg: number;
    dimensions?: {
      heightInCm: number;
      widthInCm: number;
      lengthInCm: number;
    };
    goodsDescription?: string;
  }>;
}

interface BookingRequest {
  schemaVersion: number;
  consignments: BookingConsignment[];
  testIndicator?: boolean;
}

interface BookingResponse {
  consignments?: Array<{
    confirmation?: {
      consignmentNumber: string;
      links: {
        labels: string;
        tracking: string;
      };
      packages: Array<{
        packageNumber: string;
        correlationId: string;
      }>;
    };
    errors?: Array<{
      code: string;
      messages: Array<{
        lang: string;
        message: string;
      }>;
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = BringBookingBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      sender,
      recipient,
      packages,
      serviceCode,
      shippingDate,
      orderId,
    } = parsed.data;

    // Get credentials from environment
    const apiKey = process.env.BRING_API_KEY;
    const apiUid = process.env.BRING_API_UID;
    const customerNumber = process.env.BRING_CUSTOMER_NUMBER;
    const runtime = await getRuntimeConfig();
    const bringLiveEnabled = runtime.bringLiveEnabled ?? defaultBringLiveEnabled();
    const isTestMode = !bringLiveEnabled;

    if (!apiKey || !apiUid || !customerNumber) {
      console.error("[bring-booking] Missing API credentials");
      return NextResponse.json(
        { error: "Shipping service not configured" },
        { status: 503 }
      );
    }

    // Build booking request
    const bookingRequest: BookingRequest = {
      schemaVersion: 1,
      testIndicator: isTestMode,
      consignments: [{
        shippingDate: shippingDate || new Date().toISOString().split('T')[0],
        parties: {
          sender: {
            name: sender.name,
            addressLine: sender.address,
            postalCode: sender.postalCode,
            city: sender.city,
            countryCode: sender.countryCode || "NO",
            email: sender.email,
            phoneNumber: sender.phone,
          },
          recipient: {
            name: recipient.name,
            addressLine: recipient.address,
            postalCode: recipient.postalCode,
            city: recipient.city,
            countryCode: recipient.countryCode || "NO",
            email: recipient.email,
            phoneNumber: recipient.phone,
          },
        },
        product: {
          id: serviceCode,
          customerNumber: customerNumber,
        },
        packages: packages.map((pkg) => ({
          weightInKg: pkg.weight / 1000, // Convert grams to kg
          dimensions: pkg.dimensions ? {
            heightInCm: pkg.dimensions.height,
            widthInCm: pkg.dimensions.width,
            lengthInCm: pkg.dimensions.length,
          } : undefined,
          goodsDescription: pkg.description || "Merchandise",
        })),
      }],
    };

    console.log("[bring-booking] Creating booking:", {
      testMode: isTestMode,
      serviceCode,
      sender: sender.postalCode,
      recipient: recipient.postalCode,
      packages: packages.length,
    });

    // Call Bring Booking API
    // Endpoint: POST https://api.bring.com/booking/api/create
    // X-Bring-Test-Indicator is REQUIRED (true = test, false = production)
    const response = await fetch(`${BRING_BOOKING_API}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-MyBring-API-Uid": apiUid,
        "X-MyBring-API-Key": apiKey,
        "X-Bring-Test-Indicator": isTestMode ? "true" : "false",
      },
      body: JSON.stringify(bookingRequest),
    });

    const result: BookingResponse = await response.json();

    if (!response.ok) {
      console.error("[bring-booking] API error:", response.status, result);
      
      // Extract error messages
      const errors = result.consignments?.[0]?.errors || [];
      const errorMessage = errors.length > 0
        ? errors.map(e => e.messages?.[0]?.message || e.code).join(", ")
        : "Booking failed";
      
      return NextResponse.json(
        { error: errorMessage, details: errors },
        { status: response.status }
      );
    }

    // Extract confirmation details
    const confirmation = result.consignments?.[0]?.confirmation;
    
    if (!confirmation) {
      const errors = result.consignments?.[0]?.errors || [];
      return NextResponse.json(
        { 
          error: "Booking not confirmed",
          details: errors,
        },
        { status: 400 }
      );
    }

    // Success! Return booking details
    return NextResponse.json({
      success: true,
      testMode: isTestMode,
      booking: {
        consignmentNumber: confirmation.consignmentNumber,
        labelUrl: confirmation.links?.labels,
        trackingUrl: confirmation.links?.tracking,
        packages: confirmation.packages?.map(p => ({
          packageNumber: p.packageNumber,
          correlationId: p.correlationId,
        })),
      },
      // Include order reference for your system
      orderId,
    });

  } catch (error) {
    console.error("[bring-booking] Error:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving booking errors reference
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (action === "errors") {
    // Return Bring's error codes for reference
    return NextResponse.json({
      info: "Bring Booking API error codes",
      docsUrl: "https://developer.bring.com/api/booking/#list-error-codes-get",
      commonErrors: {
        "BOOK-INPUT-022": "Invalid postal code",
        "BOOK-INPUT-023": "Weight exceeds limit",
        "BOOK-INPUT-024": "Dimensions invalid",
        "BOOK-INPUT-031": "Service not available for route",
        "BOOK-AUTH-001": "Authentication failed",
        "BOOK-AUTH-002": "Customer number invalid",
      },
    });
  }

  // Return service info
  return NextResponse.json({
    name: "Bring Booking API",
    version: "1.0",
    testMode: !(await getRuntimeConfig()).bringLiveEnabled,
    endpoints: {
      createBooking: "POST /api/bring-booking",
      getErrors: "GET /api/bring-booking?action=errors",
    },
    docs: "https://developer.bring.com/api/booking/",
  });
}

