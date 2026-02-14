import { getIntegrationCoreBaseUrl } from "@/lib/integration-core";


export async function fetchBringShippingDetails(requestData: any): Promise<any> {

    const rawPackages = Array.isArray(requestData?.packages) && requestData.packages.length > 0
      ? requestData.packages
      : [{ length: 10, width: 10, height: 10, grossWeight: 300 }];

    const packages = rawPackages.map((p: any, idx: number) => ({
      id: String(idx + 1),
      length: Number(p?.length ?? 10),
      width: Number(p?.width ?? 10),
      height: Number(p?.height ?? 10),
      grossWeight: Number(p?.grossWeight ?? 300),
    }));

    const fromPostalCode = requestData ? requestData.fromPostalCode : "1234";
    const toPostalCode = requestData ? requestData.toPostalCode : "4321";

    // New preferred path: call Integration Core backend service (rich Bring Shipping Guide response).
    const coreBaseUrl = getIntegrationCoreBaseUrl();
    const coreRequestBody = {
      fromCountryCode: "NO",
      toCountryCode: "NO",
      fromPostalCode,
      toPostalCode,
      packages,
      language: "en",
      // Bring testing: customerNumber "5"/"6"/"7" can unlock dummy pricing for some services.
      customerNumber: "5",
    };

    // Legacy fallback path: call Next route that proxies Bring Shipping Guide directly.
    // Keep this around so existing deployments that don't run the backend service still work.
    const legacyRequestBody = {
      language: "en",
      withPrice: true,
      withExpectedDelivery: false,
      withGuiInformation: true,
      numberOfAlternativeDeliveryDates: 0,
      edi: true,
      postingAtPostOffice: true,
      trace: true,
      consignments: [
        {
          id: 101,
          products: [{ id: "5800" }],
          fromCountryCode: "NO",
          toCountryCode: "NO",
          fromPostalCode,
          toPostalCode,
          shippingDate: {
            day: String(new Date().getDate()),
            hour: String(new Date().getHours()),
            minute: String(new Date().getMinutes()),
            month: String(new Date().getMonth() + 1),
            year: String(new Date().getFullYear()),
          },
          packages,
        },
      ],
    };

    try {
        let response: Response;
        if (coreBaseUrl) {
          try {
            response = await fetch(`${coreBaseUrl}/v1/shipping/bring/products`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(coreRequestBody),
            });
          } catch (networkError: any) {
            // Backend service unavailable, fall back to legacy API route
            console.warn('[fetch-bring-shipping-details] Integration Core unavailable, using legacy API:', networkError);
            
            // Check if it's a connection refused error (backend not running)
            if (networkError?.cause?.code === 'ECONNREFUSED' || networkError?.message?.includes('fetch failed')) {
              throw new ShippingError(
                'BACKEND_UNAVAILABLE',
                'The shipping service is currently unavailable. Please try again later.'
              );
            }
            
            response = await fetch("/api/bring-shipping", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(legacyRequestBody),
            });
          }
        } else {
          response = await fetch("/api/bring-shipping", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(legacyRequestBody),
          });
        }

        const result = await response.json().catch(() => null);
        
        if (!response.ok) {
            const message = result?.error || response.statusText || `HTTP error! status: ${response.status}`;
            // If the backend is misconfigured/unavailable, fall back to legacy route.
            if (coreBaseUrl) {
              try {
                const legacyResponse = await fetch("/api/bring-shipping", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(legacyRequestBody),
                });
                const legacyResult = await legacyResponse.json().catch(() => null);
                if (legacyResponse.ok) return legacyResult;
              } catch (legacyError: any) {
                // Both services failed
                if (legacyError?.cause?.code === 'ECONNREFUSED') {
                  throw new ShippingError(
                    'BACKEND_UNAVAILABLE',
                    'The shipping service is currently unavailable. Please try again later.'
                  );
                }
              }
            }
            
            // Parse error message for better UX
            if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
              throw new ShippingError(
                'BACKEND_UNAVAILABLE',
                'The shipping service is currently unavailable. Please try again later.'
              );
            }
            
            throw new ShippingError('API_ERROR', message);
        }

        return result;
    } catch (error: any) {
        console.error('There was an error fetching the shipping details:', error);
        
        // Re-throw ShippingError as-is
        if (error instanceof ShippingError) {
          throw error;
        }
        
        // Handle connection errors
        if (error?.cause?.code === 'ECONNREFUSED' || error?.message?.includes('fetch failed')) {
          throw new ShippingError(
            'BACKEND_UNAVAILABLE',
            'The shipping service is currently unavailable. Please try again later.'
          );
        }
        
        throw new ShippingError('UNKNOWN_ERROR', 'Unable to calculate shipping. Please try again.');
    }
}

// Custom error class for better error handling
export class ShippingError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ShippingError';
  }
}