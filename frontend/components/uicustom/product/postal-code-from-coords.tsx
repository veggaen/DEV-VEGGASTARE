"use client";

export interface ReverseGeocodeResult {
  postalCode: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  municipality?: string;
  county?: string;
  country?: string;
  /** Formatted full street address like "Blåskjellveien 5" */
  formattedStreet?: string;
  /** Full address line like "Blåskjellveien 5, 4310 Hommersåk" */
  formattedAddress?: string;
}

const LOG_PREFIX = "[frontend/components/uicustom/postal-code-from-coords.tsx]";

/**
 * Fetch full address details from coordinates
 */
export const fetchAddressFromCoords = async (latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> => {
  console.log(LOG_PREFIX, `fetchAddressFromCoords(${latitude},${longitude})`);
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`, { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as ReverseGeocodeResult | null;
    if (!res.ok || !data?.postalCode) {
      console.warn(LOG_PREFIX, "reverse geocode failed", data);
      return null;
    }
    
    // Build formatted strings
    const formattedStreet = [data.street, data.streetNumber].filter(Boolean).join(' ') || undefined;
    const formattedAddress = [
      formattedStreet,
      [data.postalCode, data.city].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ') || undefined;
    
    console.log(LOG_PREFIX, "result:", { ...data, formattedStreet, formattedAddress });
    return { ...data, formattedStreet, formattedAddress };
  } catch (error) {
    console.error(LOG_PREFIX, "Error fetching address from coordinates:", error);
    return null;
  }
};

/**
 * @deprecated Use fetchAddressFromCoords instead
 */
export const fetchPostalCodeFromCoords = async (latitude: number, longitude: number): Promise<string | null> => {
	const result = await fetchAddressFromCoords(latitude, longitude);
	return result?.postalCode ?? null;
};