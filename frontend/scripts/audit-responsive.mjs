/** Read-only route triage. Screenshots need human/agent review; not a feature pass. */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const index = value.indexOf('=');
  return [value.slice(2, index), value.slice(index + 1)];
}));
const baseURL = args.base ?? 'http://localhost:3000';
const widths = (args.widths ?? '390,1280').split(',').map(Number);
const output = path.resolve('.private-showcase/responsive-audit', args.label ?? 'routes');
await mkdir(output, { recursive: true });

async function inventory(directory, segments = []) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('@')) {
      result.push(...await inventory(path.join(directory, entry.name), [...segments, entry.name]));
    } else if (entry.isFile() && /^page\.(tsx|jsx|ts|js)$/.test(entry.name)) {
      const route = '/' + segments.filter(segment => !segment.startsWith('(')).join('/');
      result.push({ route, file: path.join(directory, entry.name), status: 'UNTESTED',
        requiresRecord: route.includes('['), requiresOwner: route.startsWith('/admin') });
    }
  }
  return result;
}

const routes = await inventory('app');
await writeFile(path.join(output, 'inventory.json'), JSON.stringify(routes, null, 2));
const selected = args.routes ? args.routes.split(',') : routes.filter(r => !r.requiresRecord).map(r => r.route);
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({ baseURL, viewport: { width, height: width < 600 ? 844 : 800 },
      colorScheme: 'dark', storageState: args.state, isMobile: width < 600, hasTouch: width < 600 });
    await context.addInitScript(() => {
      window.__auditVitals = { layoutShiftSum: 0, lcp: 0 };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__auditVitals.layoutShiftSum += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__auditVitals.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    for (const route of selected) {
      const page = await context.newPage();
      let recording = true;
      const result = { route, width, status: 'REVIEW_REQUIRED', errors: [], consoleErrors: [], failedRequests: [], cancelledRequests: [], states: [] };
      page.on('pageerror', error => result.errors.push(error.message.replace(/https?:\/\/\S+/g, '[URL]')));
      page.on('console', message => {
        if (message.type() === 'error') result.consoleErrors.push(message.text().replace(/https?:\/\/\S+/g, '[URL]').slice(0, 500));
      });
      page.on('requestfailed', request => {
        if (!recording) return;
        const url = new URL(request.url());
        if (url.origin === new URL(baseURL).origin)
          (request.failure()?.errorText === 'net::ERR_ABORTED' ? result.cancelledRequests : result.failedRequests)
            .push({ path: url.pathname, failure: request.failure()?.errorText });
      });
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === new URL(baseURL).origin && response.status() >= 400)
          result.failedRequests.push({ path: url.pathname, status: response.status() });
      });
      try {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45000 });
        result.httpStatus = response?.status();
        await page.locator('main').waitFor({ state: 'visible', timeout: 20000 });
        await page.waitForFunction(() => {
          const main = document.querySelector('main');
          if (!main) return false;
          const key = `${main.scrollHeight}:${main.textContent.length}`;
          const now = performance.now();
          if (window.__auditSize?.key !== key) window.__auditSize = { key, since: now };
          return now - window.__auditSize.since > 700;
        }, null, { timeout: 12000 }).catch(() => {});
        result.finalRoute = new URL(page.url()).pathname;
        const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
        if (await consent.isVisible()) await consent.click();
        for (const phase of ['top', 'middle', 'bottom']) {
          if (phase !== 'top') {
            await page.mouse.move(Math.round(width * .5), 550);
            await page.mouse.wheel(0, phase === 'middle' ? 550 : 16000);
            // Observe the completion of browser wheel dispatch, not network idle.
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          }
          const geometry = await page.evaluate(() => {
            const box = el => el?.getBoundingClientRect().toJSON() ?? null;
            return {
              documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
              footer: box(document.querySelector('footer')), main: box(document.querySelector('main')),
              heading: document.querySelector('main h1')?.textContent ?? null,
              labTiming: { ...window.__auditVitals, ttfb: performance.getEntriesByType('navigation')[0]?.responseStart },
              loading: [...document.querySelectorAll('main [role=status],main [aria-busy=true]')].map(e => e.getAttribute('aria-label') ?? e.textContent.slice(0,80)),
              scrollers: [...document.querySelectorAll('body *')].filter(e => e.clientHeight && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1)
                .map(e => ({ label: e.getAttribute('aria-label'), site: e.hasAttribute('data-site-scroll'), app: e.hasAttribute('data-app-scroll-container'), height: e.clientHeight, scrollHeight: e.scrollHeight, width: e.clientWidth, contentWidth: e.scrollWidth, top: e.scrollTop })),
              unnamedButtons: [...document.querySelectorAll('main button')].filter(e => e.getBoundingClientRect().width && !e.textContent.trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.getAttribute('title')).length,
            };
          });
          result.states.push({ phase, ...geometry });
          const filename = `${route.replace(/[^a-z0-9-]/gi, '_') || 'home'}-${width}-${phase}.png`;
          await page.screenshot({ path: path.join(output, filename) });
        }
      } catch (error) {
        result.status = 'ERROR_OR_TIMEOUT';
        result.error = error.message.split('\n')[0].replace(/https?:\/\/\S+/g, '[URL]');
      } finally {
        recording = false;
        await page.close();
      }
      results.push(result);
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ route, width, status: result.status, finalRoute: result.finalRoute,
        exceptions: result.errors.length, failedRequests: result.failedRequests.length,
        overflow: result.states.some(s => s.documentWidth > width || s.scrollers.some(c => (c.site || c.app) && c.contentWidth > c.width + 1)) }));
    }
    await context.close();
  }
} finally { await browser.close(); }
console.log(`Recorded ${results.length} route/viewport checks; screenshots still require review.`);
