import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import path from 'node:path';

test('all static routes: signed-in rendering, scroll and overflow triage', async ({ browser, baseURL }, info) => {
  test.skip(process.env.E2E_ROUTE_INVENTORY !== '1', 'Opt-in read-only full route inventory');
  test.setTimeout(900_000);
  const files = readdirSync(path.resolve('app'), { recursive: true }).map(String).filter(file => /(^|[\\/])page\.tsx$/.test(file) && !file.replaceAll('\\', '/').split('/').some(segment => segment.startsWith('_')));
  const routes = files.map(file => '/' + file.replaceAll('\\', '/').split('/').filter(segment => !/^\([^)]*\)$/.test(segment) && !segment.startsWith('@') && segment !== 'page.tsx').map(segment => segment.replace(/^\(\.\)/, '')).join('/'));
  const staticRoutes = [...new Set(routes.filter(route => !route.includes('[')))].sort();
  const dynamicNotExercised = [...new Set(routes.filter(route => route.includes('[')))].sort();
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, reducedMotion: 'reduce' });
  const results: { route: string; width: number; status?: number; finalUrl?: string; overflow?: boolean; errors: string[]; failure?: string }[] = [];
  try {
    expect((await (await context.request.get('/api/auth/session')).json()).user?.isDemo).toBe(true);
    const page = await context.newPage();
    for (const width of [390, 2560]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1440 });
      for (const route of staticRoutes) {
        const errors: string[] = [];
        const listener = (error: Error) => errors.push(error.message); page.on('pageerror', listener);
        try {
          const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          if (route === '/nexus/company/job-ask') await page.waitForURL('**/jobs/post', { waitUntil: 'domcontentloaded' });
          await page.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
          // Short hydration grace for triage, not a substitute for feature assertions.
          await page.waitForTimeout(500);
          await page.mouse.move(width - 30, 500); await page.mouse.wheel(0, 900);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          results.push({ route, width, status: response?.status(), finalUrl: new URL(page.url()).pathname, overflow, errors });
          if (overflow || errors.length || (response?.status() ?? 0) >= 500) await info.attach(`route-${width}-${route.replaceAll('/', '_')}`, { body: await page.screenshot(), contentType: 'image/png' });
        } catch (error) { results.push({ route, width, failure: String(error), errors }); }
        finally { page.off('pageerror', listener); }
      }
    }
    await info.attach('route-inventory', { body: JSON.stringify({ dynamicNotExercised, results }, null, 2), contentType: 'application/json' });
    console.log(`${staticRoutes.length} static routes at 2 widths; ${dynamicNotExercised.length} dynamic routes need record-specific tests.`);
    expect(results.filter(row => row.failure || row.overflow || Number(row.status) >= 500 || row.errors.length)).toEqual([]);
  } finally { await context.close(); }
});
