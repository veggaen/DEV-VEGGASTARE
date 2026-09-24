'use client';
/** @fileOverview Checkout shares the global fiat (crypto) price presentation. @stability stable */
import PriceAmount from '@/components/crypto-related/PriceAmount';

export default function PreferredMoney({ amount, currency = 'NOK', context }: { amount: number; currency?: string | null; context?: 'catalog' | 'history' }) {
  return <PriceAmount amount={amount} currency={currency} context={context} />;
}
