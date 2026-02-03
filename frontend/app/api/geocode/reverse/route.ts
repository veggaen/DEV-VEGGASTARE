import type { NextRequest } from "next/server";
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

type ReverseOk = { 
  postalCode: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  municipality?: string;
  county?: string;
  country?: string;
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function reverseWithGoogle(lat: number, lon: number, key: string): Promise<ReverseOk | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${key}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as any;
  const components = (data?.results ?? []).flatMap((r: any) => r?.address_components ?? []);
  
  const getComponent = (type: string) => 
    components.find((c: any) => Array.isArray(c?.types) && c.types.includes(type));
  
  const postal = getComponent("postal_code")?.long_name;
  if (!postal) return null;
  
  return {
    postalCode: postal,
    street: getComponent("route")?.long_name,
    streetNumber: getComponent("street_number")?.long_name,
    city: getComponent("postal_town")?.long_name || getComponent("locality")?.long_name,
    municipality: getComponent("administrative_area_level_2")?.long_name,
    county: getComponent("administrative_area_level_1")?.long_name,
    country: getComponent("country")?.long_name,
  };
}

async function reverseWithNominatim(lat: number, lon: number): Promise<ReverseOk | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // Nominatim requires a valid UA per usage policy.
      "User-Agent": "VEGGASTARE/1.0 (reverse-geocode; contact: dev@local)",
    },
  });
  const data = (await res.json().catch(() => null)) as any;
  const addr = data?.address;
  const postcode = addr?.postcode;
  
  if (typeof postcode !== "string" || !postcode.trim()) return null;
  
  return {
    postalCode: postcode.trim(),
    street: addr?.road || addr?.street,
    streetNumber: addr?.house_number,
    city: addr?.city || addr?.town || addr?.village,
    municipality: addr?.municipality || addr?.county,
    county: addr?.state,
    country: addr?.country,
  };
}

export async function GET(req: NextRequest) {
  const queryResult = parseQueryOrError(
    req,
    z.object({
      lat: z.coerce.number().min(-90).max(90),
      lon: z.coerce.number().min(-180).max(180),
    })
  );
  if (!queryResult.ok) return queryResult.response;

  const { lat, lon } = queryResult.data;

  try {
    const googleKey = process.env.AUTH_GOOGLE_API_KEY;
    const resultFromGoogle = googleKey ? await reverseWithGoogle(lat, lon, googleKey) : null;
    const result = resultFromGoogle ?? (await reverseWithNominatim(lat, lon));

    if (!result) return json(404, { error: "Could not determine postal code" });
    return json(200, result satisfies ReverseOk);
  } catch (e: any) {
    return json(500, { error: e?.message || "Reverse geocoding failed" });
  }
}
