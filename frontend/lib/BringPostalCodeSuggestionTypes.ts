// frontend/lib/BringPostalCodeSuggestionTypes.ts
export interface BringPostalCodeSuggestion {
  postal_code: string;
  city: string;
  municipalityId: string;
  municipality: string;
  county: string;
  po_box: boolean;
  latitude: string;
  longitude: string;
}

export interface BringPostalCodeSuggestionsResponse {
  navigation: {
    total_hits: number;
    self: string;
    next?: string;
    first: string;
    last: string;
  };
  postal_codes: BringPostalCodeSuggestion[];
}