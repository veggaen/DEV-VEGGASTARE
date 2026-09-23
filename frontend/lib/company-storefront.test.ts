/** @fileOverview Public storefront prices, visibility and truthful metrics. @stability stable */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { company: { findUnique: mocks.find } } }));
vi.mock('@/lib/mail', () => ({ sendCompanyOrgVerificationEmail: vi.fn() }));
vi.mock('@/components/uicustom/banner/BannerThemeWrapper', () => ({ default: ({ children }: React.PropsWithChildren) => children }));
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => React.createElement('img', { alt }) }));
import CompanyPublicPage from '@/app/companies/[id]/page';
import CompanyReachChart from '@/components/uicustom/company/CompanyReachChart';
import { MyCreateCompanyAction } from '@/actions/create-company';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.find.mockResolvedValue({ id: 'fixture', name: 'Fixture company', description: 'Public shop', websiteUrl: null,
    logo: [], bannerImage: [], ownerId: 'owner', creatorId: 'owner', Employee: [], orgVerification: null,
    Product: [{ id: 'item', title: 'Review pack', price: 29, priceCurrency: 'NOK', image: [], category: 'Art', viewCount: 6, Review: [] }],
  });
});

it('restricts the public storefront query to public product listings', async () => {
  await CompanyPublicPage({ params: Promise.resolve({ id: 'fixture' }) });
  expect(mocks.find.mock.calls[0][0].select.Product.where).toEqual({ visibility: 'PUBLIC' });
  expect(mocks.find.mock.calls[0][0].select.Product.select.priceCurrency).toBe(true);
});
it('renders the stored price currency without inventing unique visitors or sales', async () => {
  const html = renderToStaticMarkup(await CompanyPublicPage({ params: Promise.resolve({ id: 'fixture' }) }));
  expect(html).toMatch(/NOK\s*29\.00/);
  expect(html).not.toContain('$29');
  expect(html).toContain('Not rated yet');
  expect(html).toContain('Unique visitors and sales are not measured');
  expect(html).not.toContain('<canvas');
});
it('renders actual recorded review average when reviews exist', () => {
  const html = renderToStaticMarkup(React.createElement(CompanyReachChart, { companyName: 'Fixture',
    stats: { totalProductViews: 4, productCount: 2, averageRating: 4.5, reviewCount: 2 } }));
  expect(html).toContain('4.5 / 5');
  expect(html).not.toContain('Not rated yet');
});
it('denies demo company creation before validation or any database work', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'demo_fixture', role: 'USER' } });
  const result = await MyCreateCompanyAction({} as Parameters<typeof MyCreateCompanyAction>[0]);
  expect(result).toEqual({ error: 'Company creation is unavailable in the demo.' });
  expect(mocks.find).not.toHaveBeenCalled();
});
