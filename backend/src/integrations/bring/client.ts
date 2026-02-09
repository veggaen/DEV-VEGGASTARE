import type {
  BringProvider,
  PostalCodeSuggestion,
  PostalCodeSuggestionRequest,
  RateOption,
  RateRequest,
} from './types';

type BringEnv = {
  uid: string;
  key: string;
  clientUrl: string;
};

function requireBringEnv(): BringEnv {
  const uid = process.env.BRING_API_UID || process.env.BRING_SHIPPING_API_UID;
  const key = process.env.BRING_API_KEY || process.env.BRING_SHIPPING_API_KEY;

  if (!uid || !key) {
    throw new Error(
      'Bring credentials missing. Set BRING_API_UID + BRING_API_KEY (or legacy BRING_SHIPPING_API_UID/KEY).'
    );
  }

  const clientUrl =
    process.env.BRING_CLIENT_URL ||
    process.env.PUBLIC_BASE_URL ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/'
      : 'https://example.com/');

  return { uid, key, clientUrl };
}

function asBringHeaders(env: BringEnv): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Mybring-API-Uid': env.uid,
    'X-Mybring-API-Key': env.key,
    'X-Bring-Client-URL': env.clientUrl,
  };
}

function nowShippingDate() {
  const now = new Date();
  return {
    day: String(now.getDate()),
    hour: String(now.getHours()),
    minute: String(now.getMinutes()),
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

export class LiveBringProvider implements BringProvider {
  private async fetchShippingGuide(req: RateRequest): Promise<any> {
    const env = requireBringEnv();

    const packages = req.packages.map((p, idx) => ({
      id: String(idx + 1),
      length: Number(p.length),
      width: Number(p.width),
      height: Number(p.height),
      grossWeight: Number(p.grossWeight),
      // Bring API fields
      nonStackable: false,
      numberOfPallets: 0,
      volumeSpecial: false,
    }));

    // Shipping Guide API v2 expects consignments[] payload.
    // According to Bring docs: customerNumber must be INSIDE the products array for pricing
    // Request multiple products to show more shipping options:
    // - 5800: Pickup Parcel (Hentepakke) - collect at post office/pickup point
    // - 5600: Home Delivery Parcel (Hjemlevering) - delivery to door
    // - PA_DOREN: Door delivery alternative
    // - SERVICEPAKKE: General service package
    const productIds = ['5800', '5600', 'PA_DOREN', 'SERVICEPAKKE'];
    
    const body = {
      language: req.language ?? 'en',
      withPrice: true,
      withExpectedDelivery: true,
      withGuiInformation: true,
      numberOfAlternativeDeliveryDates: 0,
      edi: true,
      postingAtPostOffice: false,
      trace: false,
      withEnvironmentalData: false,
      consignments: [
        {
          id: '1',
          // Request multiple products for variety of shipping options
          products: productIds.map((id) => ({
            id,
            ...(req.customerNumber ? { customerNumber: req.customerNumber } : {}),
          })),
          additionalServices: [],
          fromCountryCode: req.fromCountryCode,
          toCountryCode: req.toCountryCode,
          fromPostalCode: req.fromPostalCode,
          toPostalCode: req.toPostalCode,
          shippingDate: nowShippingDate(),
          packages,
          pickupPoints: [],
        },
      ],
    };

    console.log('[bring/client.ts] Calling Bring API with body:', JSON.stringify(body, null, 2));

    const response = await fetch(
      'https://api.bring.com/shippingguide/api/v2/products',
      {
        method: 'POST',
        headers: asBringHeaders(env),
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();
    console.log('[bring/client.ts] Bring API response status:', response.status, 'body:', text.substring(0, 500));
    
    if (!response.ok) {
      throw new Error(`Bring Shipping Guide error (${response.status}): ${text}`);
    }

    return JSON.parse(text) as any;
  }

  async getRates(req: RateRequest): Promise<RateOption[]> {
    const data = await this.fetchShippingGuide(req);
    const products =
      data?.consignments?.[0]?.products && Array.isArray(data.consignments[0].products)
        ? data.consignments[0].products
        : [];

    return products.map((p: any): RateOption => {
      const listPrice = p?.price?.listPrice;
      const amount =
        typeof listPrice?.priceWithoutAdditionalServices === 'number'
          ? listPrice.priceWithoutAdditionalServices
          : undefined;
      const currency =
        typeof listPrice?.currencyCode === 'string' ? listPrice.currencyCode : undefined;

      return {
        provider: 'bring',
        serviceCode: String(p?.id ?? ''),
        serviceName: String(p?.name ?? p?.title ?? 'Bring service'),
        price:
          typeof amount === 'number' && typeof currency === 'string'
            ? { amount, currency }
            : undefined,
        meta: {
          raw: p,
        },
      };
    });
  }

  async getShippingGuideProductsRaw(req: RateRequest): Promise<unknown> {
    const data = await this.fetchShippingGuide(req);
    // Attach a lightweight hint without changing the important Bring structure.
    if (data && typeof data === 'object') {
      return { provider: 'bring', ...(data as Record<string, unknown>) };
    }
    return data;
  }

  async suggestPostalCodes(req: PostalCodeSuggestionRequest): Promise<PostalCodeSuggestion[]> {
    const env = requireBringEnv();

    const countryCode = req.countryCode.toLowerCase();
    const page = req.page ?? 1;
    const url = `https://api.bring.com/address/api/${countryCode}/postal-codes/suggestions?q=${encodeURIComponent(
      req.query
    )}&page=${encodeURIComponent(String(page))}`;

    const response = await fetch(url, {
      headers: {
        ...asBringHeaders(env),
        // Address API does not require content-type for GET, but harmless.
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Bring Address API error (${response.status}): ${text}`);
    }

    const data = JSON.parse(text) as any;
    const postalCodes = Array.isArray(data?.postal_codes) ? data.postal_codes : [];

    return postalCodes.map((p: any) => ({
      countryCode,
      postalCode: String(p?.postal_code ?? p?.postalCode ?? ''),
      city: typeof p?.city === 'string' ? p.city : undefined,
    }));
  }

  async track(trackingNumber: string): Promise<unknown> {
    const env = requireBringEnv();

    const url = `https://api.bring.com/tracking/api/v2/tracking.json?q=${encodeURIComponent(
      trackingNumber
    )}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Mybring-API-Uid': env.uid,
        'X-Mybring-API-Key': env.key,
        'X-Bring-Client-URL': env.clientUrl,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Bring Tracking API error (${response.status}): ${text}`);
    }

    return JSON.parse(text) as unknown;
  }
}
