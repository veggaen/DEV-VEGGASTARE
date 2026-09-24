/** @fileOverview Decimal input parsing for fiat listing prices, without silent reinterpretation. @stability stable */
export function parseListingPriceInput(input: string): number {
  const value = input.trim();
  if (!/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(value)) return NaN;
  const amount = Number(value.replace(',', '.'));
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 ? amount : NaN;
}

export function listingPriceInputValue(amount: number): string {
  return Number.isFinite(amount) ? String(amount) : '';
}
