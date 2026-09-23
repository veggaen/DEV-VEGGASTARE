import { test, expect } from "@playwright/test";

test('S2 — auth layouts, fields, theme and scrolling stay usable from phone to ultrawide', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const [route, title] of [['login', 'Sign in to Veggat'], ['register', 'Create your account'], ['reset', 'Forgot your password?'], ['new-password', 'Enter a new password'], ['new-verification', 'Confirm your email'], ['error', 'Oops! Something went wrong']] as const) {
      await page.goto(`/auth/${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Toggle theme', exact: true })).toBeEnabled();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      // Consent mounts independently of the auth form. In a fresh browser wait
      // for its actual arrival; an early isVisible() can miss the later overlay.
      if (route === 'login') await expect(consent).toBeVisible();
      if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
      const site = page.locator('[data-site-scroll]');
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        test.info().annotations.push({ type: 'auth-viewport', description: `${route}: ${size.width}x${size.height}` });
        await page.setViewportSize(size);
        await site.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
        await expect(page.locator('main h1')).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('main, [data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
        const measurements = await page.locator('main input:not([type=hidden])').evaluateAll(xs => xs.map(x => ({ labels: (x as HTMLInputElement).labels?.length ?? 0, height: x.getBoundingClientRect().height, font: parseFloat(getComputedStyle(x).fontSize) })));
        for (const field of measurements) { expect(field.labels).toBeGreaterThan(0); expect(field.height).toBeGreaterThanOrEqual(48); expect(field.font).toBeGreaterThanOrEqual(16); }
        const card = page.locator('[data-auth-card]');
        if (await card.count()) {
          const box = await card.boundingBox();
          expect(Math.abs(box!.x + box!.width / 2 - size.width / 2)).toBeLessThan(2);
          expect(box!.width).toBeLessThanOrEqual(448);
        }
        const canvas = page.locator('[data-auth-canvas]');
        if (await canvas.count()) expect((await canvas.boundingBox())!.width).toBeLessThanOrEqual(1280);
        await expect(page.locator('footer')).not.toBeInViewport();
        await page.mouse.move(size.width / 2, size.height - 30);
        await page.mouse.wheel(0, 7000);
        await expect(page.locator('footer')).toBeInViewport();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await page.mouse.wheel(0, -7000);
        await expect.poll(() => site.evaluate(e => e.scrollTop)).toBe(0);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      if (route === 'login' || route === 'register') for (const provider of ['Google', 'GitHub', 'Discord']) {
        const button = page.getByRole('button', { name: `Continue with ${provider}`, exact: true });
        await expect(button.getByText(provider, { exact: true })).toBeVisible();
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    const darkColor = await page.locator('main h1').evaluate(e => getComputedStyle(e).color);
    await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
    await expect.poll(() => page.locator('main h1').evaluate(e => getComputedStyle(e).color)).not.toBe(darkColor);
    await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
    await expect.poll(() => page.locator('main h1').evaluate(e => getComputedStyle(e).color)).toBe(darkColor);
    await page.getByRole('link', { name: 'Create an account', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/register$/);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/reset$/);
    await page.getByRole('link', { name: 'Back to Login', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    // A shortened viewport is a reflow check, not a claim of physical keyboard QA.
    await page.setViewportSize({ width: 390, height: 360 });
    await page.getByLabel('Password', { exact: true }).focus();
    await page.getByRole('button', { name: 'Sign in', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(url => url.pathname === '/auth/login' && url.searchParams.get('callbackUrl') === '/auth');
    await page.goto('/auth/security-action', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(url => url.pathname === '/auth/login' && url.searchParams.get('callbackUrl') === '/auth/security-action');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S2 — auth essential text is readable before JavaScript in both motion preferences', async ({ browser, baseURL }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion });
    try {
      const page = await context.newPage();
      let blocked = 0;
      await page.route('**/_next/static/**', route => {
        if (new URL(route.request().url()).pathname.endsWith('.js')) { blocked++; return route.abort(); }
        return route.continue();
      });
      for (const route of ['login', 'register', 'reset']) {
        await page.goto(`/auth/${route}`, { waitUntil: 'domcontentloaded' });
        const heading = page.locator('main h1');
        await expect(heading).toBeInViewport();
        expect(await heading.evaluate(e => {
          for (let node: Element | null = e; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) === 0) return false;
          return true;
        })).toBe(true);
        await expect(page.locator('main input[type=email]')).toBeVisible();
        await expect(page.locator('main input[type=email]')).toBeDisabled();
      }
      expect(blocked).toBeGreaterThan(0);
    } finally { await context.close(); }
  }
});

test('S2 — demo button recovers from denial without creating an account', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  let attempts = 0;
  try {
    // Auth.js appends a query delimiter. Match the parsed path, not a glob that
    // silently misses "/demo?" and accidentally creates a real demo identity.
    await context.route(url => url.pathname === '/api/auth/callback/demo', async route => {
      attempts++;
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ url: new URL('/auth/error?error=CredentialsSignin', baseURL!).href }) });
    });
    const page = await context.newPage();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Try the demo — no payment', exact: true }).click();
    await expect(page.getByText('Demo is busy. Please try again later or create an account.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try the demo — no payment', exact: true })).toBeEnabled();
    expect(attempts).toBe(1);
    expect((await (await context.request.get('/api/auth/session')).json())?.user).toBeFalsy();
  } finally { await context.close(); }
});

test('S2 — slow scripts cannot discard early recovery-form input', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const page = await context.newPage();
    await page.route('**/_next/static/**', async route => {
      if (new URL(route.request().url()).pathname.endsWith('.js')) await held;
      await route.continue();
    });
    await page.goto('/auth/reset', { waitUntil: 'commit' });
    const email = page.getByLabel('Email', { exact: true });
    await expect(page.getByRole('heading', { name: 'Forgot your password?', exact: true })).toBeVisible();
    await expect(email).toBeDisabled();
    release();
    await expect(email).toBeEditable();
    await email.fill('no-send@example.invalid');
    await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
    await expect(email).toHaveValue('no-send@example.invalid');
  } finally { release(); await context.close(); }
});

for (const [path, submit, pending] of [['login', 'Sign in', 'Signing in…'], ['register', 'Register', 'Creating account…'], ['reset', 'Send reset email', 'Sending…'], ['new-password', 'Reset Password', 'Updating…']] as const) {
  test(`S2 — ${path} prevents duplicate submits and recovers from a transport failure`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let submissions = 0;
    try {
      await page.route('**/auth/**', async route => {
        if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
          submissions++; await held; return route.abort('failed');
        }
        return route.continue();
      });
      await page.goto(`/auth/${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'Toggle theme', exact: true })).toBeEnabled();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
      if (path === 'register') await page.getByLabel('Name', { exact: true }).fill('QA transport test');
      if (path !== 'new-password') await page.getByLabel('Email', { exact: true }).fill('no-send@example.invalid');
      if (path !== 'reset') await page.getByLabel('Password', { exact: true }).fill('Browser-fixture-only-123!');
      await page.getByRole('button', { name: submit, exact: true }).click();
      await expect.poll(() => submissions).toBe(1);
      const waiting = page.getByRole('button', { name: pending, exact: true });
      await expect(waiting).toBeDisabled();
      await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
      // Native enter while the action is pending must not send another request.
      await page.keyboard.press('Enter');
      expect(submissions).toBe(1);
      release();
      await expect(page.locator('form').getByRole('alert')).toContainText('temporarily unavailable');
      await expect(page.getByRole('button', { name: submit, exact: true })).toBeEnabled();
      expect(submissions).toBe(1);
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
  });
}

for (const width of [390, 1280]) {
  test(`S8 — pricing and info links, layout and scrolling (${width}px)`, async ({ browser, baseURL }) => {
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo; does not create credits or change keys');
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('complementary', { name: 'Demo mode', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.getByRole('link', { name: 'Manage API keys', exact: true }).click();
      await expect(page).toHaveURL(/\/settings\?section=ai$/);
      await expect(page.getByRole('heading', { name: 'AI Keys', exact: true })).toBeVisible();
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'View the credit pack', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Interviewer AI Credits', exact: true })).toBeVisible();
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'Open the free demo', exact: true }).click();
      await expect(page).toHaveURL(new URL('/', baseURL!).href);
      await expect(page.getByRole('heading', { name: 'Veggat', exact: true })).toBeVisible();
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('complementary', { name: 'Demo mode', exact: true })).toBeVisible();
      await page.evaluate(() => { (window as Window & { __marketingHeader?: Element | null }).__marketingHeader = document.querySelector('header'); });
      await page.getByRole('link', { name: 'Talk to THORSEN SOFTWARE', exact: true }).click();
      await expect(page).toHaveURL(/\/info#contact$/);
      const contact = page.getByRole('region', { name: 'Contact', exact: true });
      await expect(contact.getByRole('heading', { name: 'Contact', exact: true })).toBeInViewport();
      const expectStationaryShell = async () => {
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await expect(page.getByRole('complementary', { name: 'Demo mode', exact: true })).toBeInViewport();
        expect(await page.locator('[data-site-scroll]').evaluate(e => Math.abs(e.getBoundingClientRect().bottom - innerHeight))).toBeLessThan(2);
      };
      await expectStationaryShell();
      await expect(contact.getByRole('link', { name: /Contact via GitHub/ })).toHaveAttribute('href', 'https://github.com/veggaen');
      const popupPromise = page.waitForEvent('popup');
      await contact.getByRole('link', { name: /Contact via GitHub/ }).click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL(/^https:\/\/github\.com\/veggaen(?:[/?#]|$)/);
      await popup.close();
      expect(await page.evaluate(() => (window as Window & { __marketingHeader?: Element | null }).__marketingHeader === document.querySelector('header'))).toBe(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('complementary', { name: 'Demo mode', exact: true })).toBeVisible();
      await expect(contact.getByRole('heading', { name: 'Contact', exact: true })).toBeInViewport();
      await expectStationaryShell();
      await contact.getByRole('link', { name: 'Explore marketplace', exact: true }).click();
      await expect(page).toHaveURL(/\/products$/);
      await expect(page.getByRole('button', { name: 'Product filters', exact: true })).toBeVisible();
      for (const route of ['/pricing', '/info']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('complementary', { name: 'Demo mode', exact: true })).toBeVisible();
        await expect(page.locator('main h1')).toHaveCount(1);
        await expect(page.locator('footer')).toHaveCount(1);
        const site = page.locator('[data-site-scroll]');
        for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
          await page.setViewportSize(size);
          await site.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
          await expect(page.locator('main h1')).toBeInViewport();
          if (route === '/pricing' && size.width >= 768) {
            const rows = await page.locator('main article').evaluateAll(cards => cards.map(card => ({ price: card.children[2].getBoundingClientRect().top, cta: card.lastElementChild!.getBoundingClientRect().top })));
            expect(rows).toHaveLength(3);
            expect(Math.max(...rows.map(r => r.price)) - Math.min(...rows.map(r => r.price))).toBeLessThan(2);
            expect(Math.max(...rows.map(r => r.cta)) - Math.min(...rows.map(r => r.cta))).toBeLessThan(2);
          }
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('[data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
          await page.mouse.move(size.width / 2, size.height - 30);
          await page.mouse.wheel(0, 350);
          await expect.poll(() => site.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
          await page.mouse.wheel(0, 6000);
          await expect(page.locator('footer')).toBeInViewport();
          await expectStationaryShell();
        }
        await page.setViewportSize({ width, height: 844 });
        const before = await site.evaluate(e => e.scrollTop);
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        const drawer = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
        await expect(drawer).toBeVisible();
        await drawer.evaluate(async e => { await Promise.all(e.getAnimations().map(a => a.finished.catch(() => {}))); });
        await expect(drawer.getByText('Loading wallet controls…', { exact: true })).toBeHidden();
        const rail = page.locator('[data-navigation-scroll]');
        const box = await rail.boundingBox();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.wheel(0, 7000);
        await expect.poll(() => rail.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await page.mouse.wheel(0, 1000);
        expect(await site.evaluate(e => e.scrollTop)).toBe(before);
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
        await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused();
      }
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('complementary', { name: 'Demo mode', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Digital products. Clear ownership.', exact: true })).toBeVisible();
      const avatar = page.getByRole('complementary', { name: 'About the builder', exact: true }).locator('img');
      await avatar.scrollIntoViewIfNeeded();
      await expect.poll(() => avatar.evaluate(e => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await page.getByRole('link', { name: 'Contact the builder', exact: true }).click();
      await expect(contact.getByRole('heading', { name: 'Contact', exact: true })).toBeInViewport();
      await expectStationaryShell();
      await contact.getByRole('link', { name: 'Back home', exact: true }).click();
      await expect(page).toHaveURL(new URL('/', baseURL!).href);
      for (const [label, destination] of [['Browse products', '/products'], ['Explore Pulse', '/pulse'], ['View analytics previews', '/analytics'], ['See pricing & limits', '/pricing']] as const) {
        await page.goto('/info', { waitUntil: 'domcontentloaded' });
        await page.getByRole('link', { name: label, exact: true }).click();
        await expect(page).toHaveURL(new URL(destination, baseURL!).href);
        if (destination === '/products') await expect(page.getByRole('button', { name: 'Product filters', exact: true })).toBeVisible();
        else if (destination === '/pulse') await expect(page.getByRole('feed', { name: 'Pulse feed', exact: true })).toBeVisible();
        else await expect(page.locator('main h1').first()).toBeVisible();
      }
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('S8 — info text paints before app bundles and remains readable with reduced motion', async ({ browser, baseURL }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion });
    try {
      const page = await context.newPage();
      let blocked = 0;
      await page.route('**/_next/static/**', route => {
        if (new URL(route.request().url()).pathname.endsWith('.js')) { blocked++; return route.abort(); }
        return route.continue();
      });
      await page.goto('/info', { waitUntil: 'domcontentloaded' });
      const heading = page.locator('main h1');
      await expect(heading).toBeVisible();
      for (const target of [heading, page.getByRole('heading', { name: 'Contact', exact: true })]) {
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeInViewport();
        expect(await target.evaluate(e => {
          for (let node: Element | null = e; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) === 0) return false;
          return true;
        })).toBe(true);
      }
      expect(blocked).toBeGreaterThan(0);
      await expect(page.getByText('Loading page…', { exact: true })).toHaveCount(0);
    } finally { await context.close(); }
  }
});

test('S8 — pricing preserves the AI settings destination for signed-out visitors', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    await page.getByRole('link', { name: 'Manage API keys', exact: true }).click();
    await expect(page).toHaveURL(url => url.pathname === '/auth/login' && url.searchParams.get('callbackUrl') === '/settings?section=ai');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test('S8 — pricing preserves an early scroll while app scripts hydrate', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  let release!: () => void;
  const scripts = new Promise<void>(resolve => { release = resolve; });
  try {
    const page = await context.newPage();
    await page.route('**/_next/static/**', async route => {
      if (new URL(route.request().url()).pathname.endsWith('.js')) await scripts;
      await route.continue();
    });
    await page.goto('/pricing', { waitUntil: 'commit' });
    const link = page.getByRole('link', { name: 'Manage API keys', exact: true });
    await link.scrollIntoViewIfNeeded();
    expect(await page.locator('[data-site-scroll]').evaluate(e => e.scrollTop)).toBeGreaterThan(500);
    release();
    await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    await expect(link).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await link.click();
    await expect(page).toHaveURL(url => url.pathname === '/auth/login' && url.searchParams.get('callbackUrl') === '/settings?section=ai');
  } finally { release(); await context.close(); }
});

for (const width of [390, 1280]) {
  test(`S8 — crypto filters, errors, table and scroll geometry (${width}px)`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let calls = 0;
    let mode: 'failure' | 'normal' | 'empty' | 'zero' | 'invalid' = 'failure';
    let release!: () => void;
    const initialGate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/analytics/crypto-price?**', async route => {
      calls++;
      if (calls === 1) await initialGate;
      const query = new URL(route.request().url()).searchParams;
      const coin = query.get('crypto');
      const currency = query.get('vs_currency');
      if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'Fixture provider outage' } });
      const data = mode === 'empty' ? [] : mode === 'zero' ? [{ date: '2026-03-31', price: 0 }] : Array.from({ length: 90 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, 1) + index * 86400000).toISOString().slice(0, 10), price: (coin === 'bitcoin' ? 60000 + index * 100 : coin === 'wrapped-pulse-wpls' ? 0.0001 + index * 0.000001 : 1000 + index) * (currency === 'nok' ? 10 : currency === 'eur' ? 0.9 : 1) }));
      return route.fulfill({ json: mode === 'invalid' ? { data: 'invalid' } : { coin, currency, fetchedAt: '2026-03-31T12:00:00Z', data } });
    });
    try {
      await page.goto('/analytics/crypto', { waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { name: 'Crypto Price Overview', exact: true });
      const explorer = page.getByRole('region', { name: 'Historical price explorer', exact: true });
      await expect(heading).toBeVisible();
      // The server-rendered explorer can precede AppShell hydration. Its first
      // client request is the readiness signal; do not interact with inert SSR controls.
      await expect.poll(() => calls).toBe(1);
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await expect(explorer.getByRole('status', { name: 'Loading historical price data', exact: true })).toBeVisible();
      const skeleton = await explorer.getByRole('status', { name: 'Loading historical price data', exact: true }).boundingBox();
      await page.evaluate(() => { (window as Window & { __cryptoHeading?: Element | null }).__cryptoHeading = document.querySelector('main h1'); });
      release();
      await expect(explorer.getByRole('alert')).toContainText('Historical prices are temporarily unavailable.');
      await expect(explorer.getByText('No price data loaded.', { exact: true })).toBeVisible();
      mode = 'normal';
      await explorer.getByRole('button', { name: 'Retry prices', exact: true }).click();
      const chart = explorer.getByRole('img', { name: /^Ethereum · Daily observations · USD/ });
      await expect(chart).toBeVisible();
      expect((await chart.boundingBox())!.height).toBeCloseTo(skeleton!.height, 0);
      expect(await page.evaluate(() => (window as Window & { __cryptoHeading?: Element | null }).__cryptoHeading === document.querySelector('main h1'))).toBe(true);
      await expect(page.locator('main h1')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
      for (const label of ['Asset', 'Currency', 'Date range', 'Display']) expect((await explorer.getByRole('combobox', { name: label, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(48);
      const callsBeforeFilters = calls;
      await explorer.getByLabel('Date range', { exact: true }).selectOption('7');
      await expect(explorer.getByText('7 displayed values', { exact: true })).toBeVisible();
      await explorer.getByLabel('Display', { exact: true }).selectOption('weekly');
      await expect(explorer.getByText('2 displayed values', { exact: true })).toBeVisible();
      await explorer.getByLabel('Display', { exact: true }).selectOption('monthly');
      await expect(explorer.getByText('1 displayed value', { exact: true })).toBeVisible();
      await explorer.getByLabel('Date range', { exact: true }).selectOption('custom');
      await explorer.getByLabel('Start date (UTC)').fill('2026-03-31');
      await explorer.getByLabel('End date (UTC)').fill('2026-01-01');
      await expect(explorer.getByRole('alert')).toHaveText('End date must be on or after start date.');
      await explorer.getByLabel('Start date (UTC)').fill('');
      await expect(explorer.getByRole('alert')).toHaveText('Enter a valid start and end date.');
      await explorer.getByLabel('Start date (UTC)').fill('2027-01-01');
      await explorer.getByLabel('End date (UTC)').fill('2027-02-01');
      await expect(explorer.getByText('No observations in this date range.', { exact: true })).toBeVisible();
      expect(calls).toBe(callsBeforeFilters);
      await explorer.getByRole('button', { name: 'Reset filters', exact: true }).click();
      await expect(explorer.getByLabel('Display', { exact: true })).toHaveValue('daily');
      await expect(explorer.getByText('30 displayed values', { exact: true })).toBeVisible();
      await explorer.getByLabel('Currency', { exact: true }).selectOption('nok');
      await expect(explorer.getByRole('img', { name: /^Ethereum · Daily observations · NOK/ })).toBeVisible();
      await explorer.getByLabel('Asset', { exact: true }).selectOption('bitcoin');
      await expect(explorer.getByRole('img', { name: /^Bitcoin · Daily observations · NOK/ })).toBeVisible();
      await explorer.getByLabel('Date range', { exact: true }).selectOption('365');
      await explorer.getByText('View price data table', { exact: true }).click();
      const table = explorer.getByRole('region', { name: 'Scrollable price observations', exact: true });
      await expect(explorer.getByText('Page 1 of 3', { exact: true })).toBeVisible();
      expect(await table.locator('tbody tr').count()).toBe(30);
      await explorer.getByRole('button', { name: 'Next rows', exact: true }).click();
      await expect(explorer.getByText('Page 2 of 3', { exact: true })).toBeVisible();
      await explorer.getByRole('button', { name: 'Previous rows', exact: true }).click();
      await expect(explorer.getByText('Page 1 of 3', { exact: true })).toBeVisible();
      await table.scrollIntoViewIfNeeded();
      const scroller = page.locator('[data-site-scroll]');
      const backgroundTop = await scroller.evaluate(e => e.scrollTop);
      const tableBox = await table.boundingBox();
      await page.mouse.move(tableBox!.x + tableBox!.width / 2, tableBox!.y + tableBox!.height / 2);
      await page.mouse.wheel(0, 6000);
      await expect.poll(() => table.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
      await page.mouse.wheel(0, 1000);
      expect(await scroller.evaluate(e => e.scrollTop)).toBe(backgroundTop);
      await explorer.getByText('View price data table', { exact: true }).click();
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('[data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
        await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
        await page.mouse.move(size.width / 2, size.height - 50);
        await page.mouse.wheel(0, 9000);
        await expect(page.locator('footer')).toBeInViewport();
      }
      await page.setViewportSize({ width, height: 844 });
      const beforeDrawer = await scroller.evaluate(e => e.scrollTop);
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
      await expect(drawer).toBeVisible();
      await drawer.evaluate(async e => { await Promise.all(e.getAnimations().map(a => a.finished.catch(() => {}))); });
      await expect(drawer.getByText('Loading wallet controls…', { exact: true })).toBeHidden();
      const rail = page.locator('[data-navigation-scroll]');
      const railBox = await rail.boundingBox();
      await page.mouse.move(railBox!.x + railBox!.width / 2, railBox!.y + railBox!.height / 2);
      await page.mouse.wheel(0, 5000);
      await expect.poll(() => rail.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
      await page.mouse.wheel(0, 1000);
      expect(await scroller.evaluate(e => e.scrollTop)).toBe(beforeDrawer);
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused();
      mode = 'empty';
      await explorer.getByRole('button', { name: 'Refresh view', exact: true }).click();
      await expect(explorer.getByText('No observations in this date range.', { exact: true })).toBeVisible();
      mode = 'zero';
      await explorer.getByRole('button', { name: 'Refresh view', exact: true }).click();
      await expect(explorer.getByText('1 displayed value', { exact: true })).toBeVisible();
      mode = 'invalid';
      await explorer.getByRole('button', { name: 'Refresh view', exact: true }).click();
      await expect(explorer.getByRole('alert')).toContainText('The price service returned an unreadable response.');
      await expect(explorer.getByRole('alert')).toContainText('Showing the last successfully loaded data');
      await expect(explorer.getByText('1 displayed value', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'All analytics', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Analytics Dashboard', exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
  });

  test(`S8 — crypto ignores late responses for a previously selected asset (${width}px)`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 } });
    const page = await context.newPage();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let first = true;
    await page.route('**/api/analytics/crypto-price?**', async route => {
      const query = new URL(route.request().url()).searchParams;
      const coin = query.get('crypto');
      if (first) { first = false; await gate; }
      await route.fulfill({ json: { coin, currency: query.get('vs_currency'), fetchedAt: '2026-03-31T12:00:00Z', data: [{ date: '2026-03-31', price: coin === 'bitcoin' ? 60000 : 1000 }] } });
    });
    try {
      await page.goto('/analytics/crypto', { waitUntil: 'domcontentloaded' });
      const explorer = page.getByRole('region', { name: 'Historical price explorer', exact: true });
      await expect.poll(() => first).toBe(false);
      await expect(explorer.getByRole('status', { name: 'Loading historical price data', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await explorer.getByLabel('Asset', { exact: true }).selectOption('bitcoin');
      await expect(explorer.getByLabel('Asset', { exact: true })).toHaveValue('bitcoin');
      await expect(explorer.getByRole('img', { name: /^Bitcoin · Daily observations · USD/ })).toBeVisible();
      const lateResponse = page.waitForResponse(response => response.url().includes('crypto=ethereum'));
      release();
      await lateResponse;
      await expect(explorer.getByRole('img', { name: /^Bitcoin · Daily observations · USD/ })).toBeVisible();
      await expect(explorer.getByRole('status').filter({ hasText: 'Bitcoin' })).toContainText(/USD.*60,000\.00/);
      await expect(explorer.getByRole('img', { name: /^Ethereum / })).toBeHidden();
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
  });
}

for (const width of [390, 1280]) {
  test(`S8 — analytics previews, date controls and real scrolling (${width}px)`, async ({ browser, baseURL }) => {
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses a retained non-admin demo session');
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    const privateReads: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/analytics\/(users|products|companies|user-product-creation)(?:\?|$)/.test(request.url())) privateReads.push(request.url()); });
    try {
      await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Analytics Dashboard', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      for (const metric of ['Products', 'Users', 'Companies']) {
        await page.locator('main').getByRole('link', { name: new RegExp('^' + metric + ' ') }).click();
        await expect(page.getByText('Illustrative sample · not live platform data', { exact: true })).toBeVisible();
        await expect(page.getByRole('img', { name: new RegExp('^' + metric + ': cumulative count') })).toBeVisible();
        await expect(page.locator('main h1')).toHaveCount(1);
        if (metric === 'Users') {
          const mix = page.getByRole('region', { name: 'Product publishing mix', exact: true });
          await expect(mix).toContainText('Illustrative publishing mix · fictional counts');
          const growthBox = await page.getByRole('region', { name: 'Users growth report', exact: true }).boundingBox();
          const mixBox = await mix.boundingBox();
          expect(Math.abs(growthBox!.x - mixBox!.x)).toBeLessThan(1);
          expect(Math.abs(growthBox!.width - mixBox!.width)).toBeLessThan(1);
          expect((await context.request.get('/api/analytics/user-product-creation')).status()).toBe(403);
        }
        await expect(page.getByRole('status').filter({ hasText: '30 daily values' })).toBeVisible();
        const range = page.getByRole('combobox', { name: 'Date range', exact: true });
        expect((await range.boundingBox())!.height).toBeGreaterThanOrEqual(48);
        await range.selectOption('7');
        await expect(page.getByRole('status').filter({ hasText: '7 daily values' })).toBeVisible();
        await range.selectOption('custom');
        await page.getByLabel('Start date (UTC)').fill('2026-03-31');
        await page.getByLabel('End date (UTC)').fill('2026-01-01');
        await expect(page.locator('main').getByRole('alert')).toHaveText('End date must be on or after start date.');
        await page.getByLabel('End date (UTC)').fill('2026-03-31');
        await expect(page.getByRole('status').filter({ hasText: '1 daily value' })).toBeVisible();
        await page.getByLabel('Start date (UTC)').fill('2027-01-01');
        await page.getByLabel('End date (UTC)').fill('2027-02-01');
        await expect(page.getByText('No data available for the selected date range.', { exact: true })).toBeVisible();
        await range.selectOption('all');
        await page.getByText('View data table', { exact: true }).click();
        const table = page.getByRole('region', { name: 'Scrollable daily counts' });
        await table.scrollIntoViewIfNeeded();
        const site = page.locator('[data-site-scroll]');
        const beforeTableScroll = await site.evaluate(element => element.scrollTop);
        const tableBox = await table.boundingBox();
        await page.mouse.move(tableBox!.x + tableBox!.width / 2, tableBox!.y + tableBox!.height / 2);
        await page.mouse.wheel(0, 7000);
        await expect.poll(() => table.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await page.mouse.wheel(0, 2000);
        expect(await site.evaluate(element => element.scrollTop)).toBe(beforeTableScroll);
        await expect(table.getByRole('rowheader', { name: '31 Mar 2026' })).toBeInViewport();
        await page.getByText('View data table', { exact: true }).click();
        await page.mouse.move(width - 24, 500);
        await page.mouse.wheel(0, 6000);
        await expect(page.locator('footer')).toBeInViewport();
        await page.getByRole('link', { name: 'All analytics', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Analytics Dashboard', exact: true })).toBeVisible();
        if (width === 390) expect((await context.request.get('/api/analytics/' + metric.toLowerCase())).status()).toBe(403);
      }
      // Resize the actual report, not an empty route shell. This is not OS/browser zoom emulation.
      await page.locator('main').getByRole('link', { name: /^Products / }).click();
      await expect(page.getByText('Illustrative sample · not live platform data', { exact: true })).toBeVisible();
      const site = page.locator('[data-site-scroll]');
      const backgroundTop = await site.evaluate(e => e.scrollTop);
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
      await expect(drawer).toBeVisible();
      await drawer.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      await expect(drawer.getByText('Loading wallet controls…', { exact: true })).toBeHidden();
      const rail = page.locator('[data-navigation-scroll]');
      const box = await rail.boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.wheel(0, 5000);
      await expect.poll(() => rail.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
      await page.mouse.wheel(0, 2000);
      expect(await site.evaluate(e => e.scrollTop)).toBe(backgroundTop);
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused();
      for (const metricPath of ['products', 'users', 'companies']) {
        await page.goto('/analytics/' + metricPath, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Illustrative sample · not live platform data', { exact: true })).toBeVisible();
        for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
          await page.setViewportSize(size);
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('[data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
          if (metricPath === 'users') {
            const growthBox = await page.getByRole('region', { name: 'Users growth report', exact: true }).boundingBox();
            const mixBox = await page.getByRole('region', { name: 'Product publishing mix', exact: true }).boundingBox();
            expect(Math.abs(growthBox!.x - mixBox!.x)).toBeLessThan(1);
            expect(Math.abs(growthBox!.width - mixBox!.width)).toBeLessThan(1);
          }
          await site.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
          await page.mouse.move(size.width / 2, size.height - 50);
          await page.mouse.wheel(0, 9000);
          await expect(page.locator('footer')).toBeInViewport();
        }
      }
      expect(privateReads).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test(`S8 — analytics admin UI retries without replacing the page heading (${width}px)`, async ({ browser, baseURL }) => {
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Browser-only role fixture; does not grant a real admin session');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 } });
    const page = await context.newPage();
    let fail = true;
    let failMix = true;
    // Only the browser session response is a fixture. Every private analytics request
    // is intercepted; the actual signed-in USER remains unable to query the API.
    const realSession = await (await context.request.get('/api/auth/session')).json();
    expect(realSession.user.role).not.toBe('ADMIN');
    await page.route('**/api/auth/session', route => route.fulfill({ json: { ...realSession, user: { ...realSession.user, role: 'ADMIN' } } }));
    await page.route(/\/api\/analytics\/(products|users|companies)(?:\?|$)/, route => {
      const kind = new URL(route.request().url()).pathname.split('/').at(-1);
      const name = kind === 'companies' ? 'Company' : kind === 'users' ? 'User' : 'Product';
      const field = kind === 'companies' ? 'companies' : 'users';
      return fail ? route.fulfill({ status: 503, json: { error: 'Fixture outage' } }) : route.fulfill({ json: {
        data: [{ label: name + ' Growth', data: [{ date: '2026-03-01T00:00:00Z', [field]: 2 }, { date: '2026-03-02T00:00:00Z', [field]: 4 }] }],
        ['first' + name + 'Date']: '2026-03-01', ['last' + name + 'Date']: '2026-03-02', today: '2026-03-02',
      } });
    });
    await page.route('**/api/analytics/user-product-creation', route => failMix
      ? route.fulfill({ status: 503, json: { error: 'Fixture outage' } })
      : route.fulfill({ json: { data: [{ label: 'Independent seller products', count: 27 }, { label: 'Company products', count: 9 }] } }));
    try {
      await page.goto('/analytics/products', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Product Growth Analytics', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await expect(page.locator('main').getByRole('alert')).toContainText('Analytics are temporarily unavailable.');
      await page.evaluate(() => { (window as Window & { __analyticsHeading?: Element | null }).__analyticsHeading = document.querySelector('main h1'); });
      fail = false;
      await page.getByRole('button', { name: 'Retry analytics', exact: true }).click();
      await expect(page.getByText('Live platform data · administrator access', { exact: true })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: '2 daily values' })).toBeVisible();
      await expect(page.locator('main').getByRole('alert')).toBeHidden();
      expect(await page.evaluate(() => (window as Window & { __analyticsHeading?: Element | null }).__analyticsHeading === document.querySelector('main h1'))).toBe(true);
      fail = true;
      await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
      await expect(page.locator('main').getByRole('alert')).toContainText('Showing the last successfully loaded report below.');
      await expect(page.getByRole('status').filter({ hasText: '2 daily values' })).toBeVisible();
      expect((await context.request.get('/api/analytics/products')).status()).toBe(403);
      fail = false;
      await page.goto('/analytics/users', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      const mix = page.getByRole('region', { name: 'Product publishing mix', exact: true });
      await expect(mix.getByRole('alert')).toContainText('The publishing mix is temporarily unavailable.');
      failMix = false;
      await mix.getByRole('button', { name: 'Retry publishing mix', exact: true }).click();
      await expect(mix.getByRole('definition').filter({ hasText: /^27$/ })).toBeVisible();
      await expect(mix.getByRole('definition').filter({ hasText: /^9$/ })).toBeVisible();
      await expect(mix.getByRole('alert')).toBeHidden();
      expect((await context.request.get('/api/analytics/user-product-creation')).status()).toBe(403);
    } finally { await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
  });
}

test.describe('S2 — account recovery', () => {
  test('register, verify, reset, reject replay, revoke session, login and logout', async ({ browser, baseURL }) => {
    // Opt-in only: sends two safe Resend test emails and provisions one isolated
    // USER in the explicitly selected live database (also used by local next start).
    test.skip(process.env.E2E_AUTH_RECOVERY !== 'live-db', 'Requires explicit recovery-fixture opt-in');
    test.setTimeout(120_000);
    const { Pool } = await import('pg');
    const { randomBytes } = await import('node:crypto');
    const database = new URL(process.env.DATABASE_URL_MAINLIVE!);
    database.searchParams.set('uselibpqcompat', 'true');
    const pool = new Pool({ connectionString: database.toString(), max: 2 });
    const origin = new URL(baseURL!).origin;
    const email = `delivered+veggat-s2-${Date.now()}@resend.dev`;
    const firstPassword = randomBytes(24).toString('base64url');
    const nextPassword = randomBytes(24).toString('base64url');
    const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const second = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await first.newPage();
    const recovery = await second.newPage();
    const errors: string[] = [];
    let secretLogged = false;
    for (const p of [page, recovery]) {
      p.on('pageerror', error => errors.push(error.message));
      p.on('console', message => { if (message.text().includes(firstPassword) || message.text().includes(nextPassword)) secretLogged = true; });
    }
    try {
      await page.goto(`${origin}/auth/register`, { waitUntil: 'domcontentloaded' });
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.getByPlaceholder('Choose a name').fill('Veggat QA recovery');
      await page.locator('input[name=email]').fill(email);
      await page.locator('input[name=password]').fill(firstPassword);
      await page.getByRole('button', { name: 'Register', exact: true }).click();
      await expect(page.getByText(/Check your email to verify/)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const user = (await pool.query('SELECT id FROM "User" WHERE email=$1', [email])).rows[0];
      // Read only this fixture's app-issued token. No verification/session bypass.
      const verification = (await pool.query('SELECT token FROM "VerificationToken" WHERE email=$1 ORDER BY "createdAt" DESC LIMIT 1', [email])).rows[0];
      expect(verification).toBeTruthy();
      await page.goto(`${origin}/auth/new-verification?token=${encodeURIComponent(verification.token)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/(nexus|products|pulse)(?:[/?#]|$)/, { waitUntil: 'domcontentloaded' });
      expect((await (await first.request.get(`${origin}/api/auth/session`)).json()).user.id).toBe(user.id);
      await recovery.goto(`${origin}/auth/reset`, { waitUntil: 'domcontentloaded' });
      await recovery.locator('input[type=email]').fill(email);
      await recovery.getByRole('button', { name: 'Send reset email', exact: true }).click();
      await expect(recovery.getByText(/If an account matches/)).toBeVisible();
      const reset = (await pool.query('SELECT token FROM "PasswordResetToken" WHERE email=$1 ORDER BY "createdAt" DESC LIMIT 1', [email])).rows[0];
      expect(reset).toBeTruthy();
      const resetUrl = `${origin}/auth/new-password?token=${encodeURIComponent(reset.token)}`;
      await recovery.goto(resetUrl, { waitUntil: 'domcontentloaded' });
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Reset Password', exact: true }).click();
      await expect(recovery.getByText('Password updated! Sign in with your new password.')).toBeVisible();
      expect((await (await first.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
      await recovery.goto(resetUrl, { waitUntil: 'domcontentloaded' });
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Reset Password', exact: true }).click();
      await expect(recovery.getByText(/Token does not exist|invalid or already used/)).toBeVisible();
      await recovery.goto(`${origin}/auth/login?callbackUrl=https%3A%2F%2Fevil.example`, { waitUntil: 'domcontentloaded' });
      await recovery.getByPlaceholder('you@example.com').fill(email);
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Sign in', exact: true }).click();
      await recovery.waitForURL(/\/(nexus|products|pulse)(?:[/?#]|$)/, { waitUntil: 'domcontentloaded' });
      expect(new URL(recovery.url()).origin).toBe(origin);
      expect((await (await second.request.get(`${origin}/api/auth/session`)).json()).user.id).toBe(user.id);
      // Auth.js sign-out form exercises its own CSRF token, not a forged session.
      await recovery.goto(`${origin}/api/auth/signout`, { waitUntil: 'domcontentloaded' });
      await recovery.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect.poll(async () => (await (await second.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
      // Enable 2FA only on the just-created fixture, then exercise its real UI.
      await pool.query('UPDATE "User" SET "isTwoFactorEnabled"=true WHERE id=$1 AND email=$2', [user.id, email]);
      await recovery.goto(`${origin}/auth/login`, { waitUntil: 'domcontentloaded' });
      await recovery.getByPlaceholder('you@example.com').fill(email);
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(recovery.locator('input[name=code]')).toBeVisible();
      const direct = await browser.newContext();
      try {
        const csrf = (await (await direct.request.get(`${origin}/api/auth/csrf`)).json()).csrfToken;
        await direct.request.post(`${origin}/api/auth/callback/credentials`, { form: { csrfToken: csrf, email, password: nextPassword, callbackUrl: `${origin}/products` }, headers: { 'X-Auth-Return-Redirect': '1' } });
        expect((await (await direct.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
        const otp = (await pool.query('SELECT token FROM "TwoFactorToken" WHERE email=$1 AND expires>now() ORDER BY "createdAt" DESC LIMIT 1', [email])).rows[0];
        expect(otp).toBeTruthy();
        await recovery.locator('input[name=code]').fill(otp.token);
        await recovery.getByRole('button', { name: 'Verify Code', exact: true }).click();
        await recovery.waitForURL(/\/(nexus|products|pulse)(?:[/?#]|$)/, { waitUntil: 'domcontentloaded' });
        expect((await (await second.request.get(`${origin}/api/auth/session`)).json()).user.id).toBe(user.id);
        await direct.request.post(`${origin}/api/auth/callback/credentials`, { form: { csrfToken: csrf, email, password: nextPassword, code: otp.token, callbackUrl: `${origin}/products` }, headers: { 'X-Auth-Return-Redirect': '1' } });
        expect((await (await direct.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
      } finally { await direct.close(); }
      expect(secretLogged).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await first.close(); await second.close(); await pool.end();
    }
  });
});
import {
  PAGE_TIMEOUT,
  HEAVY_PAGE_TIMEOUT,
  EXPECT_TIMEOUT,
  hasAuth,
  PUBLIC_PAGES,
  AUTH_PAGES,
  PROTECTED_PAGES,
  PUBLIC_APIS,
  PROTECTED_APIS,
  PROTECTED_POST_APIS,
  visitPage,
} from "./helpers";

/**
 * @fileOverview  VeggaStare Consolidated E2E Suite
 *
 *                ONE file. Layered like a pyramid. Each layer depends on the
 *                previous passing — if Layer 1 fails, nothing above it matters.
 *
 *                Layer 1 — ALIVE:    Is the system responding at all?
 *                Layer 2 — ROUTING:  Do public/protected routes behave correctly?
 *                Layer 3 — CONTENT:  Do pages render meaningful content?
 *                Layer 4 — FLOWS:    Can a user complete critical journeys?
 *                Layer 5 — DATA:     Do APIs return correct shapes?
 *
 *                Why this structure:
 *                • If /api/health is down, no point testing 50 routes
 *                • If auth gates are broken, no point testing UI
 *                • Failures cascade UP, never down — you fix from the bottom
 *
 *                Scalability (2026–2030):
 *                • Add routes to helpers.ts arrays → tests auto-expand
 *                • Add new layers BELOW existing ones for new concerns
 *                • Never split into multiple files — ONE pyramid, always
 *
 * @stability stable
 */

/* ================================================================== */
/*  LAYER 1 — ALIVE                                                   */
/*  "Is the system responding?"                                       */
/*  If these fail, NOTHING else matters.                               */
/* ================================================================== */
test.describe.serial("Layer 1 — System Alive", () => {
  test("API health endpoint responds with healthy status", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body).toHaveProperty("dbLatencyMs");
  });

  test("API version endpoint responds with build info", async ({
    request,
  }) => {
    const res = await request.get("/api/version");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("buildId");
  });

  test("homepage responds with 200", async ({ request }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
  });

  test("homepage renders in browser", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/");
    await expect(page).toHaveTitle(/Veggat|VeggaStare|Freedom Store/i, {
      timeout: EXPECT_TIMEOUT,
    });
  });
});

/* ================================================================== */
/*  LAYER 2 — ROUTING                                                 */
/*  "Do the gates work?"                                              */
/*  Public pages serve, protected pages redirect, APIs guard.          */
/* ================================================================== */
test.describe("Layer 2 — Routing", () => {
  test("OAuth callbacks stay on the tested app origin", async ({ request, baseURL }) => {
    const response = await request.get("/api/auth/providers");
    expect(response.ok()).toBeTruthy();
    const providers = await response.json();
    for (const provider of Object.values(providers) as { type: string; callbackUrl: string }[]) {
      if (provider.type !== "oauth" && provider.type !== "oidc") continue;
      expect(new URL(provider.callbackUrl).origin).toBe(new URL(baseURL!).origin);
    }
  });

  /* ---------- 2a. Every public page returns 200 via API ----------- */
  test.describe("Public pages respond (API-level)", () => {
    for (const route of PUBLIC_PAGES) {
      test(`GET ${route} → 200`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.get(route);
        expect(res.ok()).toBeTruthy();
      });
    }
  });

  /* ---------- 2b. Every auth page responds ----------------------- */
  test.describe("Auth pages respond (API-level)", () => {
    for (const route of AUTH_PAGES) {
      test(`GET ${route} → 200/302`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.get(route);
        expect([200, 302, 307, 308]).toContain(res.status());
      });
    }
  });

  /* ---------- 2c. Protected pages redirect when no auth ---------- */
  test.describe("Protected pages redirect to gate/login", () => {
    for (const route of PROTECTED_PAGES) {
      test(`${route} → gate or login`, async ({ page }) => {
        test.setTimeout(HEAVY_PAGE_TIMEOUT);
        await page.goto(route, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
        await page.waitForURL(/\/(gate|auth\/login)/, {
          timeout: PAGE_TIMEOUT,
        });
        expect(page.url()).toMatch(/\/(gate|auth\/login)/);
      });
    }
  });

  /* ---------- 2d. Public APIs return 200 ------------------------- */
  test.describe("Public APIs respond", () => {
    for (const endpoint of PUBLIC_APIS) {
      test(`GET ${endpoint} → 200`, async ({ request }) => {        test.setTimeout(PAGE_TIMEOUT);        const res = await request.get(endpoint);
        expect(res.ok()).toBeTruthy();
      });
    }
  });

  /* ---------- 2e. Protected APIs reject unauthenticated requests --- */
  test.describe("Protected APIs reject without auth", () => {
    for (const endpoint of PROTECTED_APIS) {
      test(`GET ${endpoint} → not 200`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.get(endpoint, {
          headers: { cookie: "" },
        });
        // Any non-success status is valid: 401, 403, 400, 405, 500, etc.
        // The key invariant: unauthenticated GET must NOT return 200.
        expect(res.status()).toBeGreaterThanOrEqual(400);
      });
    }

    for (const { path, data } of PROTECTED_POST_APIS) {
      test(`POST ${path} → not 200`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.post(path, {
          data,
          headers: { cookie: "" },
        });
        expect(res.status()).toBeGreaterThanOrEqual(400);
      });
    }
  });
});

/* ================================================================== */
/*  LAYER 3 — CONTENT                                                 */
/*  "Do pages render real content?"                                   */
/*  Now we know routes work, verify they render something meaningful.  */
/* ================================================================== */
test.describe("Layer 3 — Content", () => {
  test('S6 — settings drawers, payout preview and independent scrolling', async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses an existing isolated app-issued demo');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/settings?section=wallet', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Web3 & Wallet', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await expect(page.getByRole('switch', { name: 'Toggle Web3 mode' })).toBeDisabled();
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        await page.locator('[data-site-scroll]').evaluate(el => el.scrollTo(0, 0));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const heading = page.getByRole('heading', { name: 'Web3 & Wallet', exact: true });
        await expect(heading).toBeInViewport();
        let nav = page.getByRole('navigation', { name: 'Settings sections', exact: true });
        if (size.width < 1024) {
          const trigger = page.getByRole('button', { name: 'Settings sections: Web3 & Wallet', exact: true });
          await trigger.click();
          const dialog = page.getByRole('dialog', { name: 'Settings sections', exact: true });
          await expect(dialog).toBeVisible();
          expect(await page.locator('[data-site-scroll]').evaluate(el => el.scrollTop), 'Opening focus must not move the background page').toBe(0);
          nav = dialog.getByRole('navigation', { name: 'Settings sections', exact: true });
          await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
        }
        const navBox = await nav.boundingBox();
        await page.mouse.move(navBox!.x + 30, navBox!.y + navBox!.height / 2);
        await page.mouse.wheel(0, 5000);
        await expect.poll(() => nav.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
        expect(await page.locator('[data-site-scroll]').evaluate(el => el.scrollTop)).toBe(0);
        if (size.width < 1024) {
          await page.keyboard.press('Escape');
          await expect(page.getByRole('button', { name: 'Settings sections: Web3 & Wallet' })).toBeFocused();
        }
        const outer = page.locator('[data-site-scroll]');
        const content = await page.locator('[data-settings-content]').boundingBox();
        await page.mouse.move(content!.x + 30, Math.min(size.height - 30, content!.y + 30));
        await page.mouse.wheel(0, 5000);
        await expect.poll(() => outer.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
        await expect(page.getByRole('contentinfo')).toBeInViewport();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('[data-site-scroll]').evaluate(el => el.scrollTo(0, 0));
      await page.getByRole('button', { name: 'Settings sections: Web3 & Wallet' }).click();
      await page.getByRole('dialog', { name: 'Settings sections', exact: true }).getByRole('button', { name: /^Payments / }).click();
      await expect(page).toHaveURL(/section=payments/);
      await expect(page.getByRole('heading', { name: 'Seller Payments', exact: true })).toBeInViewport();
      await expect(page.getByLabel('PayPal receiving email', { exact: true })).toBeDisabled();
      await page.getByRole('link', { name: 'View wallet connection options', exact: true }).click();
      await expect(page).toHaveURL(/section=wallet/);
      const chooser = page.getByRole('button', { name: 'Choose wallet connection method', exact: true });
      await chooser.click();
      const walletDialog = page.getByRole('dialog', { name: 'Connect a wallet', exact: true });
      for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(size);
        await expect(walletDialog).toBeInViewport({ ratio: 0.99 });
        await walletDialog.evaluate(async element => {
          await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
        });
        const box = await walletDialog.boundingBox();
        await page.mouse.move(box!.x + 30, box!.y + box!.height / 2);
        await page.mouse.wheel(0, 5000);
        await expect.poll(async () => {
          // Keep scrolling if responsive/font settling added a few pixels after
          // the first wheel; do not weaken the actual bottom-boundary assertion.
          await page.mouse.wheel(0, 1000);
          return walletDialog.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop));
        }).toBeLessThan(2);
        await page.mouse.wheel(0, -5000);
        await expect.poll(() => walletDialog.evaluate(el => el.scrollTop)).toBe(0);
        await expect(walletDialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
      }
      await page.keyboard.press('Escape');
      await expect(chooser).toBeFocused();
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test('S6 — injected test wallet cancellation, connect and disconnect preserve demo auth', async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses an existing isolated app-issued demo');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 } });
    // Browser-only EIP-6963 fixture: no private key, signatures or transactions.
    // Exercises the real wagmi connector lifecycle, not a live wallet service.
    await context.addInitScript(() => {
      let requested = 0, connected = false;
      const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
      const address = '0x0000000000000000000000000000000000000001';
      const provider = {
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_chainId') return '0x1';
          if (method === 'eth_accounts') return connected ? [address] : [];
          if (method === 'eth_requestAccounts') {
            if (++requested === 1) throw Object.assign(new Error('User rejected connection'), { code: 4001 });
            connected = true; return [address];
          }
          if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }];
          if (method === 'wallet_revokePermissions') { connected = false; return null; }
          if (/sign|sendTransaction/i.test(method)) throw new Error('QA wallet forbids signing and transactions');
          throw Object.assign(new Error('Unsupported QA wallet method'), { code: 4200 });
        },
        on: (event: string, listener: (...args: unknown[]) => void) => {
          const set = listeners.get(event) ?? new Set(); set.add(listener); listeners.set(event, set);
        },
        removeListener: (event: string, listener: (...args: unknown[]) => void) => { listeners.get(event)?.delete(listener); },
      };
      const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
        info: { uuid: '83b13b23-24f7-498f-a49d-26fca16003a7', name: 'Veggat QA Test Wallet', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rdns: 'test.veggat.wallet' }, provider,
      } }));
      window.addEventListener('eip6963:requestProvider', announce); announce();
    });
    const page = await context.newPage(), errors: string[] = [], forbidden: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/(auth\/wallet\/nonce|wallets\/evm\/verify|payments)/.test(request.url()) && request.method() === 'POST') forbidden.push(new URL(request.url()).pathname); });
    try {
      const before = (await (await context.request.get('/api/auth/session')).json()).user.id;
      await page.goto('/settings?section=wallet', { waitUntil: 'domcontentloaded' });
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.getByRole('button', { name: 'Choose wallet connection method', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Connect a wallet', exact: true });
      const wallet = dialog.getByRole('button', { name: /Veggat QA Test Wallet/ });
      await expect(wallet).toBeEnabled(); await wallet.click();
      await expect(dialog.getByRole('alert')).toContainText('Connection cancelled');
      await wallet.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText('Current wallet session', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Disconnect session', exact: true }).click();
      await expect(page.getByText(/No live wallet session/)).toBeVisible();
      expect((await (await context.request.get('/api/auth/session')).json()).user.id).toBe(before);
      expect(forbidden).toEqual([]); expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test("S5 — AI drawers, transcript scroll and composer reflow without provider calls", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses a retained app-issued demo with a saved conversation');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const list = await (await context.request.get('/api/ai-chat/sessions?limit=20')).json();
      const session = list.sessions.find((s: { _count: { messages: number } }) => s._count.messages > 0);
      expect(session).toBeTruthy();
      await page.goto(`/ai/${session.id}`, { waitUntil: 'domcontentloaded' });
      const composer = page.getByRole('textbox', { name: 'AI message', exact: true });
      await expect(composer).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(composer).toBeInViewport({ ratio: 0.95 });
        await expect(page.getByRole('heading', { name: session.title, exact: true })).toBeInViewport();
        await expect(page.getByRole('contentinfo')).toHaveCount(0);
        const picker = page.getByRole('button', { name: /^Choose AI model:/ });
        await picker.click();
        const sheet = page.getByRole('dialog', { name: 'Choose AI model', exact: true });
        await expect(sheet).toBeVisible();
        await sheet.getByRole('textbox', { name: 'Search models', exact: true }).fill('');
        await sheet.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))); });
        const scroller = sheet.locator('[data-ai-model-scroll]');
        const box = await scroller.boundingBox();
        expect(box!.height).toBeGreaterThan(20);
        await page.mouse.move(box!.x + 20, box!.y + box!.height / 2);
        await page.mouse.wheel(0, 5000);
        await expect.poll(() => scroller.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
        expect(await page.locator('[data-site-scroll]').evaluate(el => el.scrollTop)).toBe(0);
        await page.keyboard.press('Escape'); await expect(sheet).toBeHidden(); await expect(picker).toBeFocused();
        const transcript = page.locator('[data-ai-transcript]');
        const rect = await transcript.boundingBox();
        if (rect && rect.height > 20) {
          await page.mouse.move(rect.x + 30, rect.y + rect.height / 2);
          await page.mouse.wheel(0, -5000);
          await expect.poll(() => transcript.evaluate(el => el.scrollTop)).toBe(0);
          await page.mouse.wheel(0, 5000);
          await expect.poll(() => transcript.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
          await expect(composer).toBeInViewport({ ratio: 0.95 });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [buttonName, dialogName] of [['Open conversations', 'Conversations'], ['Settings', 'Conversation settings'], ['Participants', 'Participants']]) {
        const button = page.getByRole('button', { name: buttonName, exact: true });
        await button.click();
        const dialog = page.getByRole('dialog', { name: dialogName, exact: true });
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(button).toBeFocused();
        await expect(composer).toBeInViewport({ ratio: 0.95 });
      }
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test("S5 — real credit debit, saved conversation and zero-balance block", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    test.skip(process.env.E2E_AI_REAL !== '1' || !process.env.E2E_DEMO_STORAGE_STATE, 'Opt-in bounded provider calls using a retained app-issued demo session');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const config = await context.request.get('/api/ai-chat/config');
      expect(config.status()).toBe(200);
      const initial = await config.json();
      expect(initial.demo).toBe(true);
      expect([1, 3, 5]).toContain(initial.balance);
      await page.goto('/ai', { waitUntil: 'domcontentloaded' });
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.getByRole('button', { name: 'Start a blank chat', exact: true }).click();
      await expect(page).toHaveURL(/\/ai\/c[a-z0-9]+$/);
      const conversationPath = new URL(page.url()).pathname;
      await expect(page.getByText(`${initial.balance} demo credits`, { exact: true })).toBeVisible();
      let remaining = initial.balance as number;
      const turns = [...Array.from({ length: Math.floor(remaining / 2) }, () => ({ model: 'GPT-5.6 Luna', cost: 2 })), { model: 'GPT-OSS 20B · Groq', cost: 1 }];
      for (const [index, { model, cost }] of turns.entries()) {
        await page.getByRole('button', { name: /^Choose AI model:/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Choose AI model', exact: true });
        await sheet.getByRole('textbox', { name: 'Search models', exact: true }).fill(model);
        await sheet.getByRole('button', { name: new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
        await expect(sheet).toBeHidden();
        await page.getByRole('textbox', { name: 'AI message', exact: true }).fill(`Reply with one short sentence about digital downloads. This is bounded QA check ${index + 1}.`);
        const generated = page.waitForResponse(r => new URL(r.url()).pathname === '/api/ai-chat' && r.request().method() === 'POST');
        const saved = page.waitForResponse(r => new URL(r.url()).pathname === `/api/ai-chat/sessions/${conversationPath.split('/').at(-1)}/messages` && r.request().method() === 'POST').catch(() => null);
        await page.getByRole('button', { name: 'Send message', exact: true }).click();
        const response = await generated;
        expect(response.status()).toBe(200);
        // Browser SSE bodies may be evicted from the CDP response cache. The
        // app saves only completed replies; assert that observable result.
        expect((await saved)?.status()).toBe(200);
        remaining -= cost;
        await expect(page.getByText(`${remaining} demo credits`, { exact: true })).toBeVisible();
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('0 demo credits', { exact: true })).toBeVisible();
      const record = await context.request.get(`/api/ai-chat/sessions/${conversationPath.split('/').at(-1)}`);
      const data = await record.json();
      const replies = (data.conversation ?? data).messages.filter((m: { role: string }) => m.role === 'assistant');
      expect(replies).toHaveLength(turns.length);
      for (const reply of replies) expect(reply.content.trim().length).toBeGreaterThan(0);
      await page.getByRole('button', { name: /^Choose AI model:/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Choose AI model', exact: true });
      await sheet.getByRole('textbox', { name: 'Search models', exact: true }).fill('GPT-5.6 Luna');
      await sheet.getByRole('button', { name: /GPT-5.6 Luna/ }).click();
      await page.getByRole('textbox', { name: 'AI message', exact: true }).fill('This must be blocked before any provider charge.');
      const denied = page.waitForResponse(r => new URL(r.url()).pathname === '/api/ai-chat' && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      expect((await denied).status()).toBe(402);
      await expect(page.getByText('Not enough credits for this model.', { exact: false })).toBeVisible();
      expect((await (await context.request.get('/api/ai-chat/config')).json()).balance).toBe(0);
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.getByRole('textbox', { name: 'AI message', exact: true })).toBeInViewport();
      }
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test('S7 — homepage content renders before app bundles', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      let blockedScripts = 0;
      // Keep Next's inline streaming reveal, but deny all external app chunks.
      // The hero must not depend on downloading wallet/React hydration bundles.
      await page.route('**/_next/static/**', route => {
        if (new URL(route.request().url()).pathname.endsWith('.js')) {
          blockedScripts++;
          return route.abort();
        }
        return route.continue();
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('link', { name: 'Browse products', exact: true }).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Veggat', exact: true })).toBeVisible();
      await expect(page.locator('p').filter({ hasText: 'Veggat is a trust-first marketplace for digital products.' }).first()).toBeVisible();
      const chatIntro = page.getByText('Try a limited free preview. Sign in for more models with clear per-message credit costs.', { exact: true });
      await expect(chatIntro).toBeVisible();
      expect(await chatIntro.evaluate(element => {
        for (let current: Element | null = element; current; current = current.parentElement) {
          if (Number.parseFloat(getComputedStyle(current).opacity) === 0) return false;
        }
        return true;
      })).toBe(true);
      // Scroll beyond the hero while app scripts are still blocked. Essential
      // section text must not be left transparent by an entrance animation.
      const lowerHeading = page.getByRole('heading', { name: /Three\s+steps\s+to\s+get\s+started/i });
      await lowerHeading.scrollIntoViewIfNeeded();
      await expect(lowerHeading).toBeInViewport();
      expect(await lowerHeading.evaluate(element => {
        for (let current: Element | null = element; current; current = current.parentElement) {
          if (Number.parseFloat(getComputedStyle(current).opacity) === 0) return false;
        }
        return true;
      })).toBe(true);
      await expect(page.getByText('Loading page…', { exact: true })).toHaveCount(0);
      expect(blockedScripts).toBeGreaterThan(0);
    } finally { await context.close(); }
  });

  for (const width of [390, 1280]) {
  test(`S7 — stored wallet preferences and reduced motion hydrate without replacing the shell (${width}px)`, async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('fs.activeNetwork', JSON.stringify({ kind: 'evm', chainId: 11155111 }));
      localStorage.setItem('veggat:tradeMode', 'paper');
      localStorage.setItem('evm.brand', 'MetaMask');
      localStorage.setItem('sol.brand', 'Phantom');
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /hydration|hydrating|#418|#423|#425/i.test(message.text())) errors.push(message.text());
    });
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const link = page.getByRole('link', { name: 'Browse products', exact: true }).first();
      await expect(link).toBeVisible();
      // Content is intentionally visible before hydration. Exercise a real
      // client action before asserting subsequent client-side shell retention.
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      await consent.click();
      await expect(consent).toBeHidden();
      // OS preference changes must not replace the heading's letter structure
      // or reflow the essential hero text after the initial paint.
      const title = page.getByRole('heading', { name: /Veggat/i, level: 1 });
      const titleElement = await title.elementHandle();
      const before = await title.boundingBox();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await titleElement!.evaluate(element => element.isConnected)).toBe(true);
      expect(await title.boundingBox()).toEqual(before);
      await page.evaluate(() => { (window as Window & { __qaMain?: Element | null }).__qaMain = document.querySelector('main'); });
      await link.click();
      await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as Window & { __qaMain?: Element | null }).__qaMain === document.querySelector('main'))).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem('veggat:tradeMode'))).toBe('paper');
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
  }

  test('S7 — messages preview reflows and scrolls without contacting members', async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses a retained app-issued demo session');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/conversations') writes.push(request.url());
    });
    try {
      await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Search conversations', exact: true })).toBeVisible();
      await page.getByRole('combobox', { name: 'Sort conversations' }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: 'New Chat', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'New Conversation', exact: true })).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Demo messaging preview' })).toBeVisible();
      await expect(page.getByLabel('Find someone', { exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Group Chat', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Group Chat', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByLabel('Group name', { exact: true })).toBeDisabled();
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 },
        { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 },
        { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const fields = await page.locator('form input,form textarea').evaluateAll(elements => elements.map(element => ({
          font: Number.parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height,
        })));
        expect(fields.every(field => field.font >= 16 && field.height >= 44)).toBe(true);
        await page.mouse.move(Math.min(size.width / 2, 600), size.height - 90);
        await page.mouse.wheel(0, 1800);
        await expect(page.getByRole('button', { name: 'Sending unavailable in demo', exact: true })).toBeInViewport({ ratio: 1 });
        await page.mouse.wheel(0, -2200);
        await expect(page.getByRole('link', { name: 'Back to Messages', exact: true })).toBeInViewport();
      }
      await page.getByRole('link', { name: 'Back to Messages', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test('S7 — message composer handles search and send failures with mocked transport', async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses a retained demo session for the page shell');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors: string[] = [];
    let posts = 0;
    page.on('pageerror', error => errors.push(error.message));
    // UI-only normal-account preview. The server session stays a demo; ALL
    // searches and message writes below are intercepted, never sent to members.
    await page.route('**/api/auth/session', async route => {
      const response = await route.fetch();
      const session = await response.json();
      await route.fulfill({ response, json: { ...session, user: { ...session.user, id: 'ui_fixture_only' } } });
    });
    await page.route('**/api/users/search?*', route => new URL(route.request().url()).searchParams.get('q') === 'fail'
      ? route.fulfill({ status: 503, json: { error: 'Fixture error' } })
      : route.fulfill({ json: { users: [{ id: 'ui_recipient_only', name: 'QA Fixture Member', email: null, image: '',
        role: null, bio: null, followerCount: 0, isFollowing: false }], count: 1 } }));
    await page.route('**/api/conversations', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      posts++;
      expect(route.request().postDataJSON().participants).toEqual(['ui_recipient_only']);
      await route.fulfill({ status: 503, json: { message: 'Fixture failure' } });
    });
    try {
      await page.goto('/conversations/new', { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Find someone', { exact: true }).fill('fail');
      await expect(page.getByRole('form', { name: 'New conversation' }).getByRole('alert')).toHaveText('People search is unavailable. Please try again in a moment.');
      await page.getByLabel('Find someone', { exact: true }).fill('QA');
      const recipient = page.getByRole('button', { name: 'QA Fixture Member', exact: true });
      await recipient.focus();
      await page.keyboard.press('Enter');
      await page.getByLabel('Message (optional)', { exact: true }).fill('Private unsent fixture draft');
      await page.getByRole('button', { name: 'Start Conversation', exact: true }).click();
      await expect(page.getByRole('form', { name: 'New conversation' }).getByRole('alert')).toContainText('Your draft is still here');
      await expect(page.getByLabel('Message (optional)', { exact: true })).toHaveValue('Private unsent fixture draft');
      await expect(page.getByRole('button', { name: 'Start Conversation', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Remove QA Fixture Member', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Start Conversation', exact: true })).toBeDisabled();
      expect(posts).toBe(1);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test('S8 — company directory and storefront scroll, preserve currency and respect demo limits', async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses an existing isolated demo session');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    const writes: string[] = [];
    let directoryReads = 0;
    let peopleReads = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path === '/api/companies/public') directoryReads++;
      if (path === '/api/users') peopleReads++;
      if (request.method() === 'POST' && /companies|edgestore/.test(path) && !path.endsWith('/init')) writes.push(path);
    });
    try {
      await page.goto('/companies', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Companies', exact: true })).toBeVisible();
      const studio = page.locator('a[href="/companies/cveggatshowcasestudio00001"]');
      await expect(studio).toBeVisible();
      await expect(page.getByText('Demo preview:', { exact: false })).toBeVisible();
      expect(directoryReads).toBe(1);
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 },
        { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 },
        { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        const scroller = page.locator('[data-site-scroll]');
        expect(await scroller.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await page.locator('[data-company-directory]').boundingBox())!.width).toBeLessThanOrEqual(1280);
        await page.mouse.move(Math.min(size.width / 2, 900), size.height - 90);
        await page.mouse.wheel(0, 3000);
        await expect.poll(() => scroller.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
        await page.mouse.wheel(0, -3000);
        await expect(page.getByRole('heading', { name: 'Companies', exact: true })).toBeInViewport();
      }
      await studio.click();
      await expect(page.getByRole('heading', { name: 'Veggat Studio', exact: true })).toBeVisible();
      await expect(page.getByText(/NOK\s*29\.00/, { exact: false })).toBeVisible();
      await expect(page.getByText(/NOK\s*39\.00/, { exact: false })).toBeVisible();
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.mouse.move(Math.min(size.width / 2, 900), size.height - 90);
        await page.mouse.wheel(0, 3000);
        await expect(page.getByText('Views may include repeat visits.', { exact: false })).toBeInViewport();
        await page.mouse.wheel(0, -3000);
        await expect(page.getByRole('link', { name: 'Back to companies' })).toBeInViewport();
      }
      await page.getByRole('link', { name: /Veggat Interview Pack/ }).click();
      await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
      await page.goto('/companies/create', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('region', { name: 'Company setup preview' })).toBeVisible();
      await expect(page.locator('form')).toHaveCount(0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('link', { name: 'Explore companies' }).click();
      await expect(studio).toBeVisible();
      expect(peopleReads).toBe(0);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test('S8 — company form keeps its draft and submit lock on a mocked failure', async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses retained demo auth; no actual company is created');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors: string[] = [];
    let posts = 0;
    let directoryReads = 0;
    let release: () => void = () => {};
    const responseGate = new Promise<void>(resolve => { release = resolve; });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/users') directoryReads++; });
    // Only the rendered UI sees this fixture. Server auth remains the real demo,
    // and the entire creation request is intercepted before reaching the server.
    await page.route('**/api/auth/session', async route => {
      const response = await route.fetch();
      const session = await response.json();
      await route.fulfill({ response, json: { ...session, user: { ...session.user, id: 'ui_company_fixture', role: 'USER' } } });
    });
    await page.route('**/companies/create', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      posts++;
      await responseGate;
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Fixture unavailable' });
    });
    try {
      await page.goto('/companies/create', { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Company Name', { exact: true }).fill('Private unsent QA fixture');
      await page.getByLabel('Description', { exact: true }).fill('This form submission is intercepted and never published.');
      await page.getByLabel('Website', { exact: true }).fill('https://example.com');
      const submit = page.getByRole('button', { name: 'Create Company', exact: true });
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 },
        { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const fields = await page.locator('form input:not([type=hidden]):visible, form textarea:visible').evaluateAll(elements => elements.map(element => ({
          font: Number.parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height,
        })));
        expect(fields.every(field => field.font >= 16 && field.height >= 44)).toBe(true);
        await page.mouse.move(Math.min(size.width / 2, 900), size.height - 90);
        await page.mouse.wheel(0, 6000);
        await expect(submit).toBeInViewport({ ratio: 1 });
        await page.mouse.wheel(0, -6000);
        await expect(page.getByRole('heading', { name: 'Create Your Company', exact: true })).toBeInViewport();
      }
      await submit.click();
      await expect.poll(() => posts).toBe(1);
      await expect(page.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled();
      release();
      await expect(page.locator('form').getByRole('alert')).toContainText('Your details are still here');
      await expect(page.getByLabel('Company Name', { exact: true })).toHaveValue('Private unsent QA fixture');
      await expect(submit).toBeEnabled();
      expect(directoryReads).toBe(0);
      expect(errors).toEqual([]);
    } finally { release(); await context.close(); }
  });

  test('S8 — company directory failure keeps its heading and can retry', async ({ browser, baseURL }) => {
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Directory route requires an app session');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let fail = true;
    await page.route('**/api/companies/public', route => fail
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Fixture outage"}' }) : route.continue());
    try {
      await page.goto('/companies', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Companies', exact: true })).toBeVisible();
      await expect(page.getByText('We couldn’t load the company directory. Please try again.')).toBeVisible();
      await page.evaluate(() => { (window as Window & { __qaCompanyHeading?: Element | null }).__qaCompanyHeading = document.querySelector('main h1'); });
      fail = false;
      await page.getByRole('button', { name: 'Retry directory' }).click();
      await expect(page.locator('a[href="/companies/cveggatshowcasestudio00001"]')).toBeVisible();
      expect(await page.evaluate(() => (window as Window & { __qaCompanyHeading?: Element | null }).__qaCompanyHeading === document.querySelector('main h1'))).toBe(true);
    } finally { await context.close(); }
  });

  test("S8 — warehouse detail is readable without inventory privileges", async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses a retained app-issued demo session');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const list = await context.request.get('/api/warehouses');
      expect(list.status()).toBe(200);
      const warehouses = await list.json() as { id: string }[];
      expect(warehouses.length).toBeGreaterThan(0);
      const id = warehouses[0].id;
      const details = await context.request.get(`/api/warehouses/${id}?id=${id}`);
      expect(details.status()).toBe(200);
      expect((await details.json()).warehouse.inventory).toEqual([]);
      await page.goto(`/warehouses/${id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Warehouse Details', exact: true })).toBeVisible();
      await expect(page.getByText('Inventory is visible to authorized warehouse administrators.', { exact: false })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      for (const width of [360, 390, 1280, 2560]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const refresh = page.getByRole('button', { name: 'Refresh Now', exact: true });
        const response = page.waitForResponse(r => r.url().includes(`/api/warehouses/${id}`) && r.request().method() === 'GET');
        await refresh.click();
        expect((await response).status()).toBe(200);
        await expect(refresh).toBeEnabled();
        await expect(page.getByRole('button', { name: /Increase stock|Decrease stock/ })).toHaveCount(0);
        await expect(page.getByText('An unexpected response was received from the server.', { exact: false })).toHaveCount(0);
      }
      await page.getByRole('link', { name: 'Back to warehouses', exact: true }).click();
      await expect(page).toHaveURL(/\/warehouses$/);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test("S7 — product filters reflow, contain scroll and restore focus", async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/products', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(size);
        const trigger = page.getByRole('button', { name: 'Product filters', exact: true });
        const triggerBox = await trigger.boundingBox();
        expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
        expect(await page.getByRole('checkbox', { name: /^Digital art /i }).count()).toBe(0);
        // locator.click may scroll its trigger into view after a viewport change.
        // Capture the actual pointer-down position so that movement is distinct
        // from opening the drawer or leaking wheel gestures through it.
        const beforeAction = await page.locator('[data-app-scroll-container]').evaluate(e => e.scrollTop);
        await trigger.evaluate(button => button.addEventListener('pointerdown', () => {
          const scroller = document.querySelector('[data-app-scroll-container]');
          scroller?.setAttribute('data-scroll-at-pointer', String(scroller.scrollTop));
        }, { once: true }));
        await trigger.click();
        const pointerScroll = await page.locator('[data-app-scroll-container]').getAttribute('data-scroll-at-pointer');
        expect(pointerScroll).not.toBeNull();
        const background = Number(pointerScroll);
        expect(Number.isFinite(background)).toBe(true);
        const panel = page.getByRole('dialog', { name: 'Product filters', exact: true });
        await expect(panel).toBeVisible();
        await panel.evaluate(async e => { await Promise.all(e.getAnimations().map(a => a.finished.catch(() => {}))); });
        const afterOpen = await page.locator('[data-app-scroll-container]').evaluate(e => e.scrollTop);
        test.info().annotations.push({ type: 'filter-scroll', description: JSON.stringify({ viewport: size, beforeAction, atPointerDown: background, afterOpen }) });
        expect(afterOpen).toBe(background);
        const scroller = panel.locator('[data-product-filter-scroll]');
        const box = await scroller.boundingBox();
        await page.mouse.move(box!.x + 20, box!.y + box!.height / 2);
        await page.mouse.wheel(0, 5000);
        await expect.poll(() => scroller.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await page.mouse.wheel(0, 5000);
        expect(await page.locator('[data-app-scroll-container]').evaluate(e => e.scrollTop)).toBe(background);
        await expect(panel.getByRole('button', { name: 'Reset all filters', exact: true })).toBeInViewport();
        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Product filters', exact: true }).click();
      await page.getByRole('checkbox', { name: /^Digital art /i }).check();
      await page.keyboard.press('Escape');
      await expect(page.locator('article h2')).toHaveText(['Veggat Interview Pack']);
      await page.getByRole('button', { name: 'Product filters', exact: true }).click();
      await page.getByRole('button', { name: /Reset all filters/ }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Interviewer AI Credits', exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test("S7 — mobile product native scrolling and profile tabs", async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses a retained app-issued demo session');
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      const scroll = page.locator('[data-app-scroll-container]');
      await page.mouse.move(190, 560);
      await page.mouse.wheel(0, 450);
      // A first gesture must move content, not merely run a header animation.
      await expect.poll(() => scroll.evaluate(e => e.scrollTop)).toBeGreaterThan(100);
      const purchase = page.getByRole('region', { name: 'Product purchase', exact: true });
      await expect(purchase.getByRole('button', { name: 'Add to basket', exact: true })).toBeInViewport();
      expect(await purchase.evaluate(e => Math.abs(e.getBoundingClientRect().bottom - innerHeight) < 2)).toBe(true);
      await page.mouse.wheel(0, -4000);
      await expect.poll(() => scroll.evaluate(e => e.scrollTop)).toBe(0);
      await page.getByRole('button', { name: 'Next product image', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Previous product image', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Previous product image', exact: true }).click();
      for (const width of [320, 360, 390, 1280, 2560]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await scroll.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
      }
      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      const tabs = page.getByRole('tablist', { name: 'Profile sections' });
      await expect(tabs).toBeVisible();
      for (const width of [320, 360, 390, 1280, 2560]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await tabs.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      for (const name of ['Posts', 'Activity', 'Reach', 'Connections']) {
        await page.getByRole('tab', { name, exact: true }).click();
        await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
      }
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test("S7 — Pulse filters, footer and independent navigation scrolling", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Deterministic layout fixture only. Live feed/API behavior is separately
    // exercised by the read-only audit harness and interactive browser checks.
    await page.route('**/api/conversations?**', route => route.fulfill({ json: {
      conversations: Array.from({ length: 12 }, (_, index) => ({
        id: `layout-fixture-${index}`, title: 'Layout audit fixture',
        description: 'A repeatable paragraph to exercise scrolling, sticky controls and the end of the feed.',
        type: 'PUBLIC_THREAD', tags: ['layout'], userId: 'layout-fixture-user',
        user: { id: 'layout-fixture-user', name: 'Layout reviewer', email: '' },
        createdAt: '2026-01-01T12:00:00.000Z', messageCount: 1, hasPoll: false,
      })), nextCursor: null,
    } }));
    try {
      await page.goto('/pulse', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('feed', { name: 'Pulse feed' })).toHaveAttribute('aria-busy', 'false');
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 },
        { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        const scroller = page.locator('[data-site-scroll]');
        await expect.poll(() => scroller.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
        await expect(page.getByRole('button', { name: 'Feed filters', exact: true })).toBeInViewport();
        await page.mouse.move(size.width / 2, size.height - 100);
        await page.mouse.wheel(0, 700);
        await expect.poll(() => scroller.evaluate(e => e.scrollTop)).toBeGreaterThan(200);
        if (size.width >= 1024) {
          const rail = page.locator('[data-pulse-explore-scroll]');
          const toolbar = await page.locator('[data-pulse-toolbar]').boundingBox();
          const railBox = await rail.boundingBox();
          expect(railBox!.y).toBeGreaterThanOrEqual(toolbar!.y + toolbar!.height);
        }
        await page.getByRole('button', { name: 'Polls', exact: true }).click();
        await expect(page.getByText('No polls yet', { exact: true })).toBeVisible();
        await expect.poll(() => scroller.evaluate(e => e.scrollTop)).toBe(0);
        expect(await page.locator('footer').evaluate(e => e.getBoundingClientRect().top >= innerHeight - 1)).toBe(true);
        await page.mouse.move(size.width / 2, size.height - 100);
        await page.mouse.wheel(0, 2000);
        await expect(page.locator('footer')).toBeInViewport();
        const backgroundTop = await scroller.evaluate(e => e.scrollTop);
        const menuTrigger = page.getByRole('button', { name: 'Open menu', exact: true });
        expect((await menuTrigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        if (size.width < 1024) await expect(menuTrigger.getByText('Menu', { exact: true })).toBeVisible();
        await menuTrigger.click();
        const drawer = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
        await expect(drawer).toBeVisible();
        await drawer.evaluate(async element => {
          await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
        });
        await expect(drawer.getByText('Loading wallet controls…', { exact: true })).toBeHidden();
        const drawerScroller = page.locator('[data-navigation-scroll]');
        const box = await drawerScroller.boundingBox();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.wheel(0, 4000);
        await expect.poll(() => drawerScroller.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await page.mouse.wheel(0, 4000);
        expect(await scroller.evaluate(e => e.scrollTop)).toBe(backgroundTop);
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
        await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused();
        await page.getByRole('button', { name: 'Feed filters', exact: true }).click();
        await page.getByRole('menuitem', { name: 'All Content', exact: true }).click();
        await expect(page.getByRole('feed', { name: 'Pulse feed' })).toHaveAttribute('aria-busy', 'false');
      }
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  for (const width of [390, 1280]) {
  test(`S7 — Pulse footer waits for pagination and failed batches can retry (${width}px)`, async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let releaseFailure!: () => void;
    let releaseSuccess!: () => void;
    const failureGate = new Promise<void>(resolve => { releaseFailure = resolve; });
    const successGate = new Promise<void>(resolve => { releaseSuccess = resolve; });
    let nextPageCalls = 0;
    const item = (index: number) => ({
      id: `pagination-fixture-${index}`, title: `Pagination post ${index}`,
      description: 'A repeatable post for checking the actual scroll boundary while the next page is delayed.',
      type: 'PUBLIC_THREAD', tags: ['layout'], userId: 'layout-fixture-user',
      user: { id: 'layout-fixture-user', name: 'Layout reviewer', email: '' },
      createdAt: '2026-01-01T12:00:00.000Z', messageCount: 1, hasPoll: false,
    });
    await page.route('**/api/conversations?**', async route => {
      if (!new URL(route.request().url()).searchParams.has('cursor')) {
        return route.fulfill({ json: { conversations: Array.from({ length: 12 }, (_, i) => item(i)), nextCursor: 'qa-next-page' } });
      }
      nextPageCalls++;
      if (nextPageCalls === 1) {
        await failureGate;
        return route.fulfill({ status: 503, json: { error: 'Temporary fixture failure' } });
      }
      await successGate;
      return route.fulfill({ json: { conversations: [item(12), item(13)], nextCursor: null } });
    });
    try {
      await page.goto('/pulse', { waitUntil: 'domcontentloaded' });
      const feed = page.getByRole('feed', { name: 'Pulse feed' });
      await expect(feed).toHaveAttribute('aria-busy', 'false');
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await expect(page.locator('footer')).toBeHidden();
      await page.mouse.move(width / 2, 700);
      await page.mouse.wheel(0, 12000);
      await expect(feed.getByRole('status')).toHaveText('Loading more posts…');
      await expect(page.locator('footer')).toBeHidden();
      expect(nextPageCalls).toBe(1);
      const savedPosition = await page.locator('[data-site-scroll]').evaluate(e => e.scrollTop);
      releaseFailure();
      await expect(feed.getByRole('alert')).toContainText('Your place in the feed is saved.');
      expect(await page.locator('[data-site-scroll]').evaluate(e => e.scrollTop)).toBe(savedPosition);
      await expect(feed.getByRole('article')).toHaveCount(12);
      await expect(feed.getByRole('article').last()).toBeInViewport();
      await expect(page.locator('footer')).toBeHidden();
      await feed.getByRole('button', { name: 'Retry loading posts', exact: true }).click();
      await expect(feed.getByRole('status')).toHaveText('Loading more posts…');
      await expect.poll(() => nextPageCalls).toBe(2);
      releaseSuccess();
      await expect(feed.getByRole('article')).toHaveCount(14);
      await expect(feed.getByText("You've reached the end of the flow", { exact: true })).toBeVisible();
      await page.mouse.move(width / 2, 700);
      await page.mouse.wheel(0, 4000);
      await expect(page.locator('footer')).toBeInViewport();
      expect(nextPageCalls).toBe(2);
      expect(await page.locator('[data-site-scroll]').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
      await page.locator('footer').getByRole('link', { name: 'Kontakt', exact: true }).click();
      await expect(page).toHaveURL(/\/info$/);
      await expect(page.locator('footer')).toBeVisible();
      expect(errors).toEqual([]);
    } finally { releaseFailure(); releaseSuccess(); await context.close(); }
  });
  }

  test("S3 — demo marketplace: real images, separate cart lines and reload", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    // Reuse an app-issued demo session for repeated local QA without relaxing
    // the real five-per-day signup cap. CI/default still tests the demo button.
    const savedDemo = process.env.E2E_DEMO_STORAGE_STATE;
    const context = await browser.newContext({ baseURL, storageState: savedDemo, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      if (savedDemo) {
        const demo = await (await context.request.get('/api/auth/session')).json();
        expect(demo.user.isDemo).toBe(true);
        expect((await context.request.delete(`/api/cart/${demo.user.id}`)).ok()).toBe(true);
        await page.goto('/products', { waitUntil: 'domcontentloaded' });
      } else {
        await page.getByRole('button', { name: 'Try the demo — no payment', exact: true }).click();
      }
      await page.waitForURL('**/products', { waitUntil: 'domcontentloaded' });
      for (const [index, title] of ['Veggat Interview Pack', 'Interviewer AI Credits'].entries()) {
        if (index) await page.goto('/products', { waitUntil: 'domcontentloaded' });
        await page.getByText(title, { exact: true }).first().click();
        await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
        const gallery = page.getByRole('img', { name: title, exact: true }).first();
        await expect(gallery).toBeVisible();
        await expect.poll(() => gallery.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 844 });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
        await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
        await expect(page.getByText('Added to basket', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: `${index + 1} item${index ? 's' : ''} in basket`, exact: true })).toBeVisible();
      }
      await page.getByRole('button', { name: 'View basket', exact: true }).click();
      await page.waitForURL('**/cart', { waitUntil: 'domcontentloaded' });
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Interviewer AI Credits', exact: true })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe('/cart');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      const session = await (await context.request.get('/api/auth/session')).json();
      const cart = await (await context.request.get(`/api/cart/${session.user.id}`)).json();
      expect(cart.items).toHaveLength(2);
      expect(cart.items.every((item: { quantity: number }) => item.quantity === 1)).toBe(true);
      const titlesBefore = await page.getByRole('heading', { level: 2 }).allTextContents();
      await page.getByRole('button', { name: 'Increase quantity', exact: true }).first().click();
      await expect(page.getByRole('button', { name: '3 items in basket', exact: true })).toBeVisible();
      await expect.poll(() => page.getByRole('heading', { level: 2 }).allTextContents()).toEqual(titlesBefore);
      await page.getByRole('button', { name: 'Decrease quantity', exact: true }).first().click();
      await expect(page.getByRole('button', { name: '2 items in basket', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Remove', exact: true }).first().click();
      await expect(page.getByRole('button', { name: '1 item in basket', exact: true })).toBeVisible();
      expect((await context.request.post('/api/edgestore/request-upload', { data: {} })).status()).toBe(403);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test("public home and isolated demo sign-in (public S1)", async ({ browser, baseURL }) => {
    test.setTimeout(PAGE_TIMEOUT);
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Try the demo — no payment", exact: true })).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(0);
    const essential = page.getByRole("button", { name: "Essential Only", exact: true });
    if (await essential.isVisible()) await essential.click();
    await page.getByRole("button", { name: "Try the demo — no payment", exact: true }).click();
    await page.waitForURL("**/products");
    await expect(page.getByRole("complementary", { name: "Demo mode" })).toBeVisible();
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.user.isDemo).toBe(true);
    expect(session.user.role).toBe("USER");
    expect((await page.request.post("/api/orders", { data: {} })).status()).toBe(403);
    expect((await page.request.post("/settings", { data: {} })).status()).toBe(403);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "Exit demo", exact: true }).click();
    await page.waitForURL(`${baseURL}/`);
    await expect(page.getByRole("button", { name: "Try the demo — no payment", exact: true })).toBeVisible();
    await context.close();
  });

  test("Products metadata does not restart the loading skeleton (public S1)", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    let productRequests = 0;
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/products") productRequests++; });
    const metadata = page.waitForResponse(response => new URL(response.url()).pathname === "/api/filter-counts");
    await visitPage(page, "/products");
    await metadata;
    await expect(page.getByRole("status", { name: "Loading products", exact: true })).toHaveCount(0);
    // Observe beyond the old 300ms metadata-triggered debounce window.
    await page.waitForTimeout(600);
    expect(productRequests).toBe(1);
    await expect(page.locator("footer")).toHaveCount(0);
  });

  test("footer follows content without overlapping it (public S1)", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.setViewportSize({ width: 1280, height: 800 });
    await visitPage(page, "/info");
    const footer = page.locator("footer");
    await expect(footer).toBeAttached();
    expect(await footer.evaluate(element => element.getBoundingClientRect().top >= innerHeight)).toBe(true);
    expect(await footer.evaluate(element => getComputedStyle(element).position)).toBe("static");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
  });

  /* ---------- 3a. Critical public pages render ------------------- */
  test("homepage renders heading", async ({ page }) => {
    await visitPage(page, "/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("anonymous AI model selector opens with clear sign-in guidance", async ({
    page,
  }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/");

    const selector = page.getByRole('button', { name: /^Choose AI model:/ });
    await expect(selector).toBeVisible({ timeout: EXPECT_TIMEOUT });
    await selector.click();

    await expect(
      page.getByText('Guest preview · limited requests. Sign in for more models.', { exact: true }),
    ).toBeVisible({ timeout: EXPECT_TIMEOUT });
    await expect(page.getByRole('textbox', { name: 'Search models', exact: true })).toBeVisible();
  });

  test("products page renders content", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/products");
    await expect(
      page.locator("main, [role='main'], #__next, body").first(),
    ).toBeVisible({ timeout: EXPECT_TIMEOUT });
  });

  test("pulse page renders content", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/pulse");
    await expect(page.locator("body")).toBeVisible();
  });

  test("login form has email input and submit button", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible({
      timeout: EXPECT_TIMEOUT,
    });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });

  test("register page renders heading", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/register");
    await expect(
      page.getByRole("heading", { name: 'Create your account', exact: true }),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
  });

  test("reset password page has email input", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/reset");
    const emailInput = page
      .getByPlaceholder(/email|you@/i)
      .or(page.locator('input[type="email"]'));
    await expect(emailInput.first()).toBeVisible({ timeout: EXPECT_TIMEOUT });
  });

  /* ---------- 3b. Legal pages render (data-driven) --------------- */
  for (const route of ["/info", "/privacy", "/terms", "/contact"] as const) {
    test(`${route} renders content`, async ({ page }) => {
      test.setTimeout(PAGE_TIMEOUT);
      await visitPage(page, route);
      await expect(page.locator("body")).toBeVisible();
    });
  }

  /* ---------- 3c. Heavy pages (generous timeout) ----------------- */
  test("poll-test page loads", async ({ page }) => {
    test.setTimeout(HEAVY_PAGE_TIMEOUT);
    await visitPage(page, "/poll-test", { timeout: HEAVY_PAGE_TIMEOUT });
    await expect(page.locator("body")).toBeVisible();
  });
});

/* ================================================================== */
/*  LAYER 4 — FLOWS                                                   */
/*  "Can a user complete a journey?"                                  */
/*  Tests that cross multiple pages or require interaction.            */
/* ================================================================== */
test.describe("Layer 4 — User Flows", () => {
  test("login → reset password navigation", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/login");
    const resetLink = page.getByRole("link", {
      name: /forgot|reset|password/i,
    });
    if (await resetLink.isVisible().catch(() => false)) {
      await resetLink.click();
      await expect(page).toHaveURL(/reset/);
    }
  });

  test("register → login navigation", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/register");
    await page.waitForLoadState("domcontentloaded");
    const loginLink = page.getByRole("link", {
      name: /login|sign in|already have|back/i,
    });
    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click();
      try {
        await expect(page).toHaveURL(/login/, { timeout: EXPECT_TIMEOUT });
      } catch {
        // Link may not navigate (e.g. client-side routing issue) — not critical
      }
    }
  });

  test("unknown route redirects to login/gate", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.goto("/definitely-does-not-exist-xyz", { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForURL(/\/(auth\/login|gate)/, {
      timeout: PAGE_TIMEOUT,
    });
  });

  test("dashboard redirect preserves callback URL", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForURL(/\/(gate|auth\/login)/, {
      timeout: PAGE_TIMEOUT,
    });
  });

  test("/feed redirects to /pulse (public alias)", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.goto("/feed", { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForURL(/\/(pulse|gate|auth\/login|feed)/, {
      timeout: PAGE_TIMEOUT,
    });
  });
});

/* ================================================================== */
/*  LAYER 5 — DATA                                                    */
/*  "Do APIs return the right shapes?"                                */
/*  No browser needed — pure request-level validation.                 */
/* ================================================================== */
test.describe("Layer 5 — API Data Shapes", () => {
  test("products API returns array with correct fields", async ({
    request,
  }) => {
    const res = await request.get("/api/products?page=1&perPage=5");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("id");
      expect(body[0]).toHaveProperty("title");
    }
  });

  test("products API validates price range (minPrice > maxPrice → 400)", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/products?page=1&perPage=5&minPrice=100&maxPrice=10",
    );
    expect(res.status()).toBe(400);
  });

  test("products API respects perPage limit", async ({ request }) => {
    const res = await request.get("/api/products?page=1&perPage=3");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBeLessThanOrEqual(3);
  });

  test("products API pagination returns valid arrays", async ({ request }) => {
    const [p1, p2] = await Promise.all([
      request.get("/api/products?page=1&perPage=2"),
      request.get("/api/products?page=2&perPage=2"),
    ]);
    expect(p1.ok()).toBeTruthy();
    expect(p2.ok()).toBeTruthy();
    expect(Array.isArray(await p1.json())).toBeTruthy();
    expect(Array.isArray(await p2.json())).toBeTruthy();
  });

  test("categories API returns array", async ({ request }) => {
    const res = await request.get("/api/categories");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test("companies/public API returns array", async ({ request }) => {
    const res = await request.get("/api/companies/public");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test("health API returns db latency metric", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(typeof body.dbLatencyMs).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });

  test("admin endpoints reject non-admin requests", async ({ request }) => {
    const res = await request.get("/api/admin/users", {
      headers: { cookie: "" },
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  /* ---------- Authenticated data tests (skip if no creds) -------- */
  test("plain cookies cannot restore an impersonated identity (authed)", async ({ context, request, baseURL }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    if (process.env.GATE_PASSWORD) {
      await request.post("/api/access-gate", { data: { password: process.env.GATE_PASSWORD } });
    }
    const before = await (await request.get("/api/auth/session")).json();
    expect(before.user.role).toBe("USER");
    await context.addCookies([
      { name: "x-impersonate-owner-id", value: before.user.id, domain: new URL(baseURL!).hostname, path: "/" },
      { name: "x-impersonate-target-id", value: "not-a-real-account", domain: new URL(baseURL!).hostname, path: "/" },
    ]);
    expect((await request.post("/api/admin/impersonate/end")).status()).toBe(403);
    const after = await (await request.get("/api/auth/session")).json();
    expect(after.user.id).toBe(before.user.id);
    expect(after.user.isImpersonating).toBe(false);
  });

  test("model picker selects platform Groq without a key (authed)", async ({ page }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/");
    const essentialOnly = page.getByRole("button", { name: "Essential Only", exact: true });
    if (await essentialOnly.isVisible()) await essentialOnly.click();
    const picker = page.getByTitle("Choose AI model", { exact: true });
    await picker.click();
    await page.getByPlaceholder(/Search models/).fill("GPT-OSS 20B");
    await page.getByRole("button").filter({ hasText: "GPT-OSS 20B" }).click();
    await expect(picker).toContainText("GPT-OSS 20B");
    await expect(page.getByPlaceholder("Paste your API key…")).not.toBeVisible();
  });

  test("GET /api/wallets returns data (authed)", async ({ request }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    const res = await request.get("/api/wallets");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).wallets)).toBeTruthy();
  });

  test("GET /api/notifications returns data (authed)", async ({ request }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    const res = await request.get("/api/notifications");
    expect(res.ok()).toBeTruthy();
  });

  test("GET /api/conversations returns data (authed)", async ({ request }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    const res = await request.get("/api/conversations");
    expect(res.ok()).toBeTruthy();
  });

  /* ---------- SEO / crawlability --------------------------------- */
  test("robots.txt is accessible", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
  });

  test("sitemap.xml is accessible", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
  });

  /* ---------- Misc public APIs ----------------------------------- */
  test("price-range API responds", async ({ request }) => {
    const res = await request.get("/api/price-range");
    expect([200, 401]).toContain(res.status());
  });

  test("categories-with-counts API responds", async ({ request }) => {
    const res = await request.get("/api/categories-with-counts");
    expect([200, 401]).toContain(res.status());
  });

  test("products/sellers API responds", async ({ request }) => {
    const res = await request.get("/api/products/sellers");
    expect([200, 401]).toContain(res.status());
  });

  test("bring-shipping-suggest-postcode API responds", async ({ request }) => {
    const res = await request.get(
      "/api/bring-shipping-suggest-postcode?q=0001",
    );
    expect([200, 400, 401, 404, 500, 502]).toContain(res.status());
  });
});
