export type Money = {
  amount: number;
  currency: string;
};

export type PackageSpec = {
  length: number;
  width: number;
  height: number;
  grossWeight: number;
};

export type RateRequest = {
  fromCountryCode: string;
  toCountryCode: string;
  fromPostalCode: string;
  toPostalCode: string;
  packages: PackageSpec[];
  language?: string;
  customerNumber?: string;
};

export type RateOption = {
  provider: 'bring' | 'mock';
  serviceCode: string;
  serviceName: string;
  price?: Money;
  meta?: Record<string, unknown>;
};

export type PostalCodeSuggestion = {
  postalCode: string;
  city?: string;
  countryCode: string;
};

export type PostalCodeSuggestionRequest = {
  countryCode: string;
  query: string;
  page?: number;
};

export interface BringProvider {
  getRates(req: RateRequest): Promise<RateOption[]>;
  /**
   * Optional: return a Bring-like "rich" Shipping Guide v2 response.
   * Useful for templates that already render consignments/products/guiInformation.
   */
  getShippingGuideProductsRaw?(req: RateRequest): Promise<unknown>;
  suggestPostalCodes(req: PostalCodeSuggestionRequest): Promise<PostalCodeSuggestion[]>;
  track(trackingNumber: string): Promise<unknown>;
}
