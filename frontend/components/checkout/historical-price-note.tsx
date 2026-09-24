/** @fileOverview Visible distinction between recorded order values and current display conversions. @stability stable */
export default function HistoricalPriceNote() {
  return <p data-historical-price-note className="text-sm leading-relaxed text-muted-foreground">Recorded amounts do not change. Fiat and crypto equivalents use current reference rates, not the exchange rate on your payment statement.</p>;
}
