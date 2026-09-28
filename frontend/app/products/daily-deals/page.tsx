/** @fileOverview Daily-promotion availability and useful marketplace navigation. @stability stable */
import MarketplaceOffers from '@/components/uicustom/products/MarketplaceOffers';

export const metadata = { title: 'Daily deals', description: 'Daily promotion availability and current marketplace options.', robots: { index: false, follow: true } };

export default function DailyDealsPage() {
  return <MarketplaceOffers kind="deals" />;
}
