"use client";

const LOG_PREFIX = "[frontend/components/uicustom/product/postal-cords-from-code.tsx]";
export const fetchCoordsFromPostalCode = async (postalCode: string, countryCode: string): Promise<{ latitude: number; longitude: number; } | null> => {
	console.log(LOG_PREFIX, `fetchCoordsFromPostalCode(${postalCode}, ${countryCode}) 1/2`);
	try {
		const res = await fetch(
			`/api/geocode/forward?postalCode=${encodeURIComponent(postalCode)}&countryCode=${encodeURIComponent(countryCode)}`,
			{ cache: "no-store" }
		);
		const data = (await res.json().catch(() => null)) as any;
		if (!res.ok) {
			console.warn(LOG_PREFIX, "forward geocode failed", data);
			return null;
		}
		const latitude = Number(data?.latitude);
		const longitude = Number(data?.longitude);
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
		console.log(LOG_PREFIX, `fetchCoordsFromPostalCode(${postalCode}, ${countryCode}) 2/2`, { latitude, longitude });
		return { latitude, longitude };
	} catch (error) {
		console.error(LOG_PREFIX, "Error fetching coordinates from postal code:", error);
		return null;
	}
};