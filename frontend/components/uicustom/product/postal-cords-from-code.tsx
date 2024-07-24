'use server';

interface GeocodeApiResponse {
  results: GeocodeResult[];
  status: string;
}

interface GeocodeResult {
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: AddressComponent[];
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

const LOG_PREFIX = '[frontend/components/uicustom/product/postal-cords-from-code.tsx]';
const googleMapApiKey = process.env.AUTH_GOOGLE_API_KEY;

export const fetchCoordsFromPostalCode = async (postalCode: string, countryCode: string): Promise<{ latitude: number; longitude: number; } | null> => {
  console.log(LOG_PREFIX, `fetchCoordsFromPostalCode(${postalCode}, ${countryCode}) 1/2`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${postalCode}&components=postal_code:${postalCode}|country:${countryCode}&key=${googleMapApiKey}`;

  try {
    const response = await fetch(url);
    const data: GeocodeApiResponse = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log(LOG_PREFIX, `fetchCoordsFromPostalCode(${postalCode}, ${countryCode}) 2/2`, location);
      return { latitude: location.lat, longitude: location.lng };
    } else {
      console.error(LOG_PREFIX, `Error fetching coordinates for postal code ${postalCode}: `, data.status);
      return null;
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching coordinates from postal code:', error);
    return null;
  }
};