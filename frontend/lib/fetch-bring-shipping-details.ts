

export async function fetchBringShippingDetails(requestData: any): Promise<any> {
    console.log('[frontend/lib/fetch-bring-shipping-details.ts] requestData', requestData)

    // Bring Shipping Guide rejects dates in the past; generate a current shipping date.
    const now = new Date();
    const shippingDate = {
      day: String(now.getDate()),
      hour: String(now.getHours()),
      minute: String(now.getMinutes()),
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    };

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

    const requestBody = {  
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
          products: [
            {
              id: "5800"
            }
          ],
          fromCountryCode: "NO",
          toCountryCode: "NO",
          fromPostalCode: requestData ? requestData.fromPostalCode : "1234",
          toPostalCode: requestData ? requestData.toPostalCode : "4321",
          shippingDate,
          packages,
        }
      ]
    };

    try {
        const response = await fetch('/api/bring-shipping', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
	        const result = await response.json().catch(() => null);
	        console.log('[frontend/lib/fetch-bring-shipping-details.ts] result', result)
	        
	        if (!response.ok) {
	            const message = result?.error || response.statusText || `HTTP error! status: ${response.status}`;
	            throw new Error(message);
	        }

	        return result;
    } catch (error) {
	        console.error('There was an error fetching the shipping details:', error);
        throw error;
    }
}