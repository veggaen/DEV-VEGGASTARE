import type { NextRequest } from "next/server";

type ForwardOk = { latitude: number; longitude: number };

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function forwardWithGoogle(postalCode: string, countryCode: string, key: string): Promise<ForwardOk | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    postalCode
  )}&components=postal_code:${encodeURIComponent(postalCode)}|country:${encodeURIComponent(countryCode)}&key=${key}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as any;
  if (data?.status !== "OK" || !data?.results?.length) return null;
  const loc = data.results[0]?.geometry?.location;
  const lat = Number(loc?.lat);
  const lon = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

async function forwardWithNominatim(postalCode: string, countryCode: string): Promise<ForwardOk | null> {
  const cc = countryCode.toLowerCase();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&postalcode=${encodeURIComponent(
    postalCode
  )}&countrycodes=${encodeURIComponent(cc)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "VEGGASTARE/1.0 (forward-geocode; contact: dev@local)",
    },
  });
  const data = (await res.json().catch(() => null)) as any[] | null;
  const hit = Array.isArray(data) ? data[0] : null;
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postalCode = (searchParams.get("postalCode") || "").trim();
  const countryCode = (searchParams.get("countryCode") || "NO").trim();

  if (!postalCode) return json(400, { error: "Missing 'postalCode' query param" });

  try {
    const googleKey = process.env.AUTH_GOOGLE_API_KEY;
    const coordsFromGoogle = googleKey ? await forwardWithGoogle(postalCode, countryCode, googleKey) : null;
    const coords = coordsFromGoogle ?? (await forwardWithNominatim(postalCode, countryCode));
    if (!coords) return json(404, { error: "Could not determine coordinates" });
    return json(200, coords satisfies ForwardOk);
  } catch (e: any) {
    return json(500, { error: e?.message || "Forward geocoding failed" });
  }
}
