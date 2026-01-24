"use client";

const LOG_PREFIX = "[frontend/components/uicustom/postal-code-from-coords.tsx]";
export const fetchPostalCodeFromCoords = async (latitude: number, longitude: number): Promise<string | null> => {
	console.log(LOG_PREFIX, `fetchPostalCodeFromCoords(${latitude},${longitude}) 1/2`);
	try {
		const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`, { cache: "no-store" });
		const data = (await res.json().catch(() => null)) as any;
		if (!res.ok) {
			console.warn(LOG_PREFIX, "reverse geocode failed", data);
			return null;
		}
		console.log(LOG_PREFIX, "2/2", data?.postalCode);
		return typeof data?.postalCode === "string" ? data.postalCode : null;
	} catch (error) {
		console.error(LOG_PREFIX, "Error fetching postal code from coordinates:", error);
		return null;
	}
  };