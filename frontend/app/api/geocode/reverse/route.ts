import type { NextRequest } from "next/server";
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

type ReverseOk = { postalCode: string };

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function reverseWithGoogle(lat: number, lon: number, key: string): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${key}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as any;
  const components = (data?.results ?? []).flatMap((r: any) => r?.address_components ?? []);
  const postal = components.find((c: any) => Array.isArray(c?.types) && c.types.includes("postal_code"));
  return postal?.long_name ?? null;
}

async function reverseWithNominatim(lat: number, lon: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // Nominatim requires a valid UA per usage policy.
      "User-Agent": "VEGGASTARE/1.0 (reverse-geocode; contact: dev@local)",
    },
  });
  const data = (await res.json().catch(() => null)) as any;
  const postcode = data?.address?.postcode;
  return typeof postcode === "string" && postcode.trim() ? postcode.trim() : null;
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
    const postalFromGoogle = googleKey ? await reverseWithGoogle(lat, lon, googleKey) : null;
    const postal = postalFromGoogle ?? (await reverseWithNominatim(lat, lon));

    if (!postal) return json(404, { error: "Could not determine postal code" });
    return json(200, { postalCode: postal } satisfies ReverseOk);
  } catch (e: any) {
    return json(500, { error: e?.message || "Reverse geocoding failed" });
  }
}
