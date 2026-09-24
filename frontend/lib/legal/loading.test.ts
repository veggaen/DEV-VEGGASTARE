/** @fileOverview Legal fallback markers are route-owned presentation, never authentication. @stability stable */
import { expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth/jwt', () => ({ getToken: vi.fn().mockResolvedValue(null) }));
import proxy from '@/proxy';

it('sets the public terms marker from the actual route, not a caller header', async () => {
  const terms = await proxy(new NextRequest('http://localhost:3000/terms', { headers: { 'x-veggat-publication': 'forged' } }));
  expect(terms.headers.get('x-middleware-request-x-veggat-publication')).toBe('sales-terms');
  const products = await proxy(new NextRequest('http://localhost:3000/products', { headers: { 'x-veggat-publication': 'sales-terms' } }));
  expect(products.headers.get('x-middleware-request-x-veggat-publication')).toBe('');
});
it('cannot use the marker to enter a protected page', async () => {
  const response = await proxy(new NextRequest('http://localhost:3000/profile', { headers: { 'x-veggat-publication': 'sales-terms' } }));
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get('location')!).pathname).toBe('/auth/login');
});
