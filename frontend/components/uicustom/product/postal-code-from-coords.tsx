'use server';

interface GeocodeApiResponse {
  results: GeocodeResult[];
  status: string;
}

interface GeocodeResult {
  address_components: AddressComponent[];
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}
const LOG_PREFIX = '[frontend/components/uicustom/postal-code-from-coords.tsx]'
const googleMapApiKey = process.env.AUTH_GOOGLE_API_KEY

export const fetchPostalCodeFromCoords = async (latitude: number, longitude: number): Promise<string | null> => {
    console.log(LOG_PREFIX,`fetchPostalCodeFromCoords(${latitude},${longitude}) 1/2`)
    const url: string = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapApiKey}`;
  
    try {
      const response = await fetch(url);
      const data: GeocodeApiResponse = await response.json();
  
      // Find the postal code in the response
      const postalCodeObj = data.results
        .flatMap((result: GeocodeResult) => result.address_components)
        .find((component: AddressComponent) => component.types.includes('postal_code'));
      console.log(LOG_PREFIX, '2/2 ', JSON.stringify( postalCodeObj));
      return postalCodeObj ? postalCodeObj.long_name : null;
    } catch (error) {
      console.error('Error fetching postal code from coordinates:', error);
      return null;
    }
  };