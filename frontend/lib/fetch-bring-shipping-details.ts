import { getIntegrationCoreBaseUrl } from "@/lib/integration-core";


export async function fetchBringShippingDetails(requestData: any): Promise<any> {
    console.log('[frontend/lib/fetch-bring-shipping-details.ts] requestData', requestData)

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
          response = await fetch(`${coreBaseUrl}/v1/shipping/bring/products`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(coreRequestBody),
          });
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
	        console.log('[frontend/lib/fetch-bring-shipping-details.ts] result', result)
	        
	        if (!response.ok) {
	            const message = result?.error || response.statusText || `HTTP error! status: ${response.status}`;
	            // If the backend is misconfigured/unavailable, fall back to legacy route.
	            if (coreBaseUrl) {
	              const legacyResponse = await fetch("/api/bring-shipping", {
	                method: "POST",
	                headers: { "Content-Type": "application/json" },
	                body: JSON.stringify(legacyRequestBody),
	              });
	              const legacyResult = await legacyResponse.json().catch(() => null);
	              if (legacyResponse.ok) return legacyResult;
	            }
	            throw new Error(message);
	        }

          return result;
    } catch (error) {
	        console.error('There was an error fetching the shipping details:', error);
        throw error;
    }
}