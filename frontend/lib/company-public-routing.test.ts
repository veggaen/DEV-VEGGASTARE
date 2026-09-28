/** @fileOverview Public storefronts must not open company management routes. @stability stable */
import { expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import proxy from '@/proxy';

it.each(['/companies', '/companies/cveggatshowcasestudio00001'])('keeps %s available without signing in', async path => {
  const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
  expect(response.status).toBe(200); expect(response.headers.get('location')).toBeNull();
});
it.each(['/companies/create', '/companies/cfixture/settings', '/companies/cfixture/hub', '/companies/cfixture/warehouse/cstock', '/nexus/company/cfixture/settings'])('keeps %s behind sign-in', async path => {
  const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
  expect(response.status).toBe(307);
  const redirect = new URL(response.headers.get('location')!); expect(redirect.pathname).toBe('/auth/login'); expect(redirect.searchParams.get('callbackUrl')).toBe(path);
});
