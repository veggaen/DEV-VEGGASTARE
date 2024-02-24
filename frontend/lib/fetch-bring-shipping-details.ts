
interface PackageDetail {
    length: number;
    width: number;
    height: number;
    grossWeight: number;
}

interface ShippingRequest {
  fromPostalCode: string;
  toPostalCode: string;

}

export async function fetchBringShippingDetails(requestData: any): Promise<any> {
    const bringApiKey: string | undefined = process.env.BRING_SHIPPING_API_KEY
    const bringApiUid: string | undefined = process.env.BRING_SHIPPING_API_UID
    if (!bringApiKey  || !bringApiUid) {
        console.error('API Key or User ID not set');
        // throw new Error('API Key or User ID not set');
    }
    
    console.log('[frontend/lib/fetch-bring-shipping-details.ts] requestData', requestData)
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
          shippingDate: {
            day: "21",
            hour: "10",
            minute: "0",
            month: "2",
            year: "2024"
          },
          packages: [
            {
              id: "10",
              length: 10,
              width: 10,
              height: 10,
              grossWeight: 300
            }   
          ]
        }
      ]
    };

    try {
        const response = await fetch('/api/bring-shipping', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Mybring-API-Uid': bringApiUid as string,
                'X-Mybring-API-Key': bringApiKey as string,
                'X-Bring-Client-URL': 'https://dev-veggastare.vercel.app/',
            },
            body: JSON.stringify(requestBody),
        });
        const result = await response.json();
        console.log('[frontend/lib/fetch-bring-shipping-details.ts] result', result)
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return result
    } catch (error) {
        console.error('There was an error fetching the shipping details:', error);
        throw error;
    }
}