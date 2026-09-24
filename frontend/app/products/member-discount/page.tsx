/** @fileOverview Member-offer availability without promising a paid membership. @stability stable */
import MarketplaceOffers from '@/components/uicustom/products/MarketplaceOffers';

export const metadata = { title: 'Member discounts', description: 'Member offer availability and standard AI-credit volume pricing.', robots: { index: false, follow: true } };

export default function MemberDiscountPage() {
  return <MarketplaceOffers kind="members" />;
}
