'use client';
/** @fileOverview Checkout shares the global fiat (crypto) price presentation. @stability stable */
import PriceAmount from '@/components/crypto-related/PriceAmount';

export default function PreferredMoney({ amount, currency = 'NOK' }: { amount: number; currency?: string | null }) {
  return <PriceAmount amount={amount} currency={currency} />;
}
