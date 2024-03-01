type PostalCodeSuggestion = {
    city: string;
    postal_code: string;
    // Add more fields based on your needs
  };
  
  type FetchPostalCodeSuggestionsResponse = PostalCodeSuggestion[] | null;
  
  export async function fetchPostalCodeSuggestions(postalCodeInput: string): Promise<FetchPostalCodeSuggestionsResponse> {
    if (!postalCodeInput) return null;
  
    try {
      const response = await fetch(`https://api.bring.com/address/api/no/postal-codes/suggestions?q=${postalCodeInput}`, {
        headers: {
          'X-Mybring-API-Uid': process.env.MYBRING_API_UID || '',
          'X-Mybring-API-Key': process.env.MYBRING_API_KEY || '',
          'X-Bring-Client-URL': 'http://localhost:3000/',
          'Accept': 'application/json',
        },
      });
  
      if (!response.ok) throw new Error('Failed to fetch suggestions');
  
      const data = await response.json();
      return data.postal_codes || [];
    } catch (error) {
      console.error('Error fetching postal code suggestions:', error);
      return null;
    }
}