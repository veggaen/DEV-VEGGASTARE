/** @fileOverview Mixed-currency display totals never sum unlike units or invent missing rates. @stability stable */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@/components/providers/ui-preferences', () => ({ useUiPreferences: () => ({ prefs: { preferredFiatCurrency: 'USD', preferredCryptoCurrency: 'ETH' } }) }));
vi.mock('@/hooks/useCurrencyRates', () => ({ useCurrencyRates: () => ({ fiatRates: { USD: 1, NOK: 0.1, EUR: 1.1 }, cryptoPrices: { ETH: 2000 }, isLoading: false, lastUpdated: 1 }) }));
import { PriceTotal } from '@/components/crypto-related/PriceAmount';
import PreferredMoney from '@/components/checkout/preferred-money';

it('renders order and shipping amounts in the selected fiat and crypto using the recorded currency', () => {
  const html = renderToStaticMarkup(React.createElement(PreferredMoney, { amount: 20, currency: 'NOK' }));
  expect(html).toMatch(/USD\s*2\.00/);
  expect(html).toContain('(0.001 ETH)');
  expect(html).not.toContain('NOK');
});

it('does not guess an order currency when the historical record is missing it', () => {
  const html = renderToStaticMarkup(React.createElement(PreferredMoney, { amount: 20, currency: null }));
  expect(html).toContain('Price unavailable');
  expect(html).not.toContain('USD');
});

it('converts NOK and EUR separately before summing in the selected fiat and crypto', () => {
  const html = renderToStaticMarkup(React.createElement(PriceTotal, { entries: [{ amount: 39, currency: 'NOK' }, { amount: 2, currency: 'EUR' }] }));
  expect(html).toMatch(/USD\s*6\.10/);
  expect(html).toContain('(0.00305 ETH)');
  expect(html).not.toContain('NOK'); expect(html).not.toContain('EUR');
});

it('fails closed when even one line has no conversion rate', () => {
  const html = renderToStaticMarkup(React.createElement(PriceTotal, { entries: [{ amount: 39, currency: 'NOK' }, { amount: 2, currency: 'ZZZ' }] }));
  expect(html).toContain('Price unavailable');
  expect(html).not.toContain('USD'); expect(html).not.toContain('ETH)');
});
