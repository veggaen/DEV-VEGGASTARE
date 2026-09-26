/** @fileOverview Read-only hosted product boundary checks; no customer writes. @stability active */
import { expect, test } from '@playwright/test';

for (const width of [390, 2560]) test(`public product lifecycle boundary (${width}px)`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width, height: width === 390 ? 844 : 1440 }, reducedMotion: 'reduce' });
  try {
    const id = 'cveggatinterviewcredits01';
    const response = await context.request.get(`/api/products/${id}`);
    expect(response.status()).toBe(200);
    const product = await response.json();
    expect(product.visibility).toBe('PUBLIC');
    expect(product.specifications?.some((entry: { key: string }) => entry.key.trim().startsWith('__')) ?? false).toBe(false);
    expect((await context.request.get(`/api/products/${id}/repo-access`)).status()).toBe(401);
    expect((await context.request.post(`/api/products/${id}/repo-access`, { headers: { Origin: baseURL! }, data: { enabled: false } })).status()).toBe(401);
    const page = await context.newPage(); const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/products/${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: product.title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Cookie Preferences' })).toHaveCount(0);
    await expect(page.getByText('Manage listing', { exact: true })).toHaveCount(0);
    await page.mouse.move(width - 24, 600); await page.mouse.wheel(0, 1000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
