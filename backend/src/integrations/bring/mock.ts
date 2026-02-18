import type {
  BringProvider,
  PostalCodeSuggestion,
  PostalCodeSuggestionRequest,
  RateOption,
  RateRequest,
} from './types';

const TEST_TRACKING_NUMBERS = [
  'TESTPACKAGEATPICKUPPOINT',
  'TESTPACKAGEEDI',
  'TESTPACKAGEDELIVERED',
] as const;

export class MockBringProvider implements BringProvider {
  async getRates(req: RateRequest): Promise<RateOption[]> {
    const currency = req.toCountryCode.toUpperCase() === 'NO' ? 'NOK' : 'EUR';

    return [
      {
        provider: 'mock',
        serviceCode: '5800',
        serviceName: 'Bring Servicepakke (demo)',
        price: { amount: 129, currency },
        meta: {
          note:
            'Mock mode enabled. Configure BRING_API_UID + BRING_SHIPPING_API_KEY to fetch real rates.',
        },
      },
      {
        provider: 'mock',
        serviceCode: '5000',
        serviceName: 'Bring Pakke i postkassen (demo)',
        price: { amount: 89, currency },
        meta: {
          note:
            'Use Bring test customer numbers (e.g. customerNumber "5") for richer responses when authenticated.',
        },
      },
    ];
  }

  async getShippingGuideProductsRaw(req: RateRequest): Promise<unknown> {
    const currency = req.toCountryCode.toUpperCase() === 'NO' ? 'NOK' : 'EUR';
    const weight = req.packages?.[0]?.grossWeight ?? 300;
    const maxWeightInKgs = Math.max(1, Math.round((weight as number) / 1000));

    return {
      provider: 'mock',
      traceMessages: [],
      uniqueId: `mock-${Date.now()}`,
      consignments: [
        {
          consignmentId: 'mock-consignment-1',
          products: [
            {
              id: '5800',
              productionCode: '5800',
              shippingWeight: Number(weight),
              guiInformation: {
                sortOrder: '1',
                mainDisplayCategory: 'Package',
                subDisplayCategory: 'Pickup',
                trackable: true,
                logo: 'POSTEN',
                logoUrl: 'https://www.mybring.com/shipping-guide/assets/img/Posten_logo.svg',
                displayName: 'Bring Servicepakke (demo)',
                productName: 'Bring Servicepakke (demo)',
                descriptionText: 'Demo response (mock mode). Configure BRING_MODE=live for real Bring data.',
                helpText: 'Demo help text',
                shortName: 'Servicepakke',
                productURL: 'https://www.bring.com/',
                deliveryType: 'PICKUP_POINT',
                maxWeightInKgs: String(maxWeightInKgs),
                closestPickupPoint: 'Demo pickup point',
              },
              price: {
                listPrice: {
                  priceWithoutAdditionalServices: {
                    amountWithoutVAT: String(99),
                    vat: String(30),
                    amountWithVAT: String(129),
                    currencyCode: currency,
                  },
                  priceWithAdditionalServices: {
                    amountWithoutVAT: String(99),
                    vat: String(30),
                    amountWithVAT: String(129),
                    currencyCode: currency,
                  },
                },
                zones: { totalZoneCount: 1 },
              },
            },
          ],
        },
      ],
    };
  }

  async suggestPostalCodes(req: PostalCodeSuggestionRequest): Promise<PostalCodeSuggestion[]> {
    const countryCode = req.countryCode.toLowerCase();
    const q = req.query.trim();

    const samples: PostalCodeSuggestion[] =
      countryCode === 'no'
        ? [
            { countryCode: 'no', postalCode: '0951', city: 'Oslo' },
            { countryCode: 'no', postalCode: '4050', city: 'Sola' },
            { countryCode: 'no', postalCode: '5004', city: 'Bergen' },
            { countryCode: 'no', postalCode: '9600', city: 'Hammerfest' },
          ]
        : [
            { countryCode, postalCode: '10012', city: 'Stockholm' },
            { countryCode, postalCode: '0900', city: 'København C' },
          ];

    if (!q) return samples;

    return samples.filter((s) => s.postalCode.startsWith(q) || (s.city ?? '').toLowerCase().includes(q.toLowerCase()));
  }

  async track(trackingNumber: string): Promise<unknown> {
    const normalized = trackingNumber.trim();

    return {
      provider: 'mock',
      trackingNumber: normalized,
      hint:
        'Mock mode. Bring offers test tracking numbers like ' +
        TEST_TRACKING_NUMBERS.join(', ') +
        '.',
      events: [
        {
          timestamp: new Date().toISOString(),
          description: `Tracking demo event for ${normalized}`,
        },
      ],
    };
  }
}
