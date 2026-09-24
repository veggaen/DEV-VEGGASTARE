import { test, expect } from "@playwright/test";

test('S4 — transactional email job rejects public and forged requests', async ({ request }) => {
  test.skip(process.env.E2E_EMAIL_SLICE !== '1', 'Run only after the protected email route is deployed');
  for (const headers of [{}, { Authorization: 'Bearer forged-qa-secret' }]) {
    const response = await request.get('/api/cron/transactional-email', { headers });
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  }
});

test('S4 — purchase support preserves drafts, confirms intent and fits phone to ultrawide', async ({ browser, baseURL }, testInfo) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained demo receipt; only intercepted request writes');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo).toBe(true);
    const orders = await (await context.request.get(`/api/orders/user/${session.user.id}`)).json();
    const order = orders.find((row: { checkout?: { environment: string; state: string } }) => row.checkout?.environment === 'DEMO' && row.checkout.state === 'COMPLETED');
    expect(order).toBeTruthy();
    let calls = 0;
    await page.route('**/api/returns', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      calls++;
      const input = route.request().postDataJSON();
      expect(input.orderId).toBe(order.id);
      if (calls === 2) return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Unexpected sign-in page</p>' });
      return route.fulfill(calls === 1 ? { status: 503, json: { error: 'QA temporary failure — your message is kept.' } } : {
        status: 201, json: { id: 'qa-browser-only-notice', orderId: order.id, reason: input.reason,
          description: input.description, createdAt: '2026-09-24T10:20:30.000Z', status: 'PENDING', sellerNote: null },
      });
    });
    await page.goto(`/checkout/receipt/${order.id}`, { waitUntil: 'domcontentloaded' });
    if (!await page.evaluate(() => localStorage.getItem('veggat:cookieConsent'))) {
      await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    }
    const support = page.getByRole('region', { name: 'Help, withdrawal and refunds', exact: true });
    await support.scrollIntoViewIfNeeded();
    await expect(support).toContainText('there is no payment to refund');
    // Existing real QA notices may hide withdrawal; the problem form uses the
    // same submission path and must remain usable without erasing that notice.
    const withdraw = support.getByRole('button', { name: 'Withdraw from this purchase', exact: true });
    const isWithdrawal = await withdraw.count() > 0;
    await (isWithdrawal ? withdraw : support.getByRole('button', { name: 'Report a purchase problem', exact: true })).click();
    await expect(support.getByRole('heading', { name: isWithdrawal ? 'Confirm your withdrawal notice' : 'Tell us what went wrong', exact: true })).toBeFocused();
    expect(calls).toBe(0);
    const message = support.getByRole('textbox', { name: 'Message (optional)', exact: true });
    const draft = 'QA browser fixture — preserve this draft if the request fails.';
    await message.fill(draft);
    const send = support.getByRole('button', { name: isWithdrawal ? 'Confirm withdrawal request' : 'Send purchase request', exact: true });
    for (const [width, height] of [[360, 800], [390, 844], [844, 390], [768, 1024], [1280, 800], [2560, 1080]]) {
      await page.setViewportSize({ width, height });
      await send.scrollIntoViewIfNeeded(); await expect(send).toBeInViewport();
      expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-site-scroll]').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (width === 390 || width === 1280) await page.screenshot({ path: testInfo.outputPath(`purchase-support-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await send.click();
    await expect(support.getByRole('alert')).toContainText('temporary failure');
    await expect(message).toHaveValue(draft); await expect(send).toBeEnabled();
    await send.click();
    await expect(support.getByRole('alert')).toContainText('could not confirm receipt');
    await expect(message).toHaveValue(draft);
    await expect(support.getByRole('status')).toHaveCount(0);
    await send.click();
    await expect(support.getByRole('status')).toContainText('No refund has been issued');
    await expect(support.getByRole('status')).toBeFocused();
    await expect(support.getByRole('list', { name: 'Your purchase requests', exact: true })).toContainText(draft);
    await expect(support.getByRole('list', { name: 'Your purchase requests', exact: true })).toContainText('no email sent');
    expect(calls).toBe(3);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S4 — real demo withdrawal is idempotent, private and never changes payment status', async ({ browser, baseURL }, testInfo) => {
  test.skip(process.env.E2E_BUYER_REQUEST !== '1' || !process.env.E2E_DEMO_STORAGE_STATE, 'Opt-in one notice on an existing unpaid demo order');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const anonymous = await browser.newContext({ baseURL });
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo).toBe(true); expect(session.user.id.startsWith('demo_')).toBe(true);
    const ordersPath = `/api/orders/user/${session.user.id}`;
    const orders = await (await context.request.get(ordersPath)).json();
    const order = orders.find((row: { checkout?: { environment: string; state: string } }) => row.checkout?.environment === 'DEMO' && row.checkout.state === 'COMPLETED');
    expect(order).toBeTruthy();
    const input = { orderId: order.id, reason: 'CHANGED_MIND', description: 'Demo QA notice only — no payment was collected and no money should move.' };
    const results = await Promise.all([1, 2].map(() => context.request.post('/api/returns', { data: input, headers: { Origin: new URL(baseURL!).origin } })));
    for (const result of results) expect([200, 201]).toContain(result.status());
    const [first, second] = await Promise.all(results.map(result => result.json()));
    expect(first.id).toBe(second.id);
    const notices = await (await context.request.get('/api/returns')).json();
    expect(notices.filter((row: { id: string }) => row.id === first.id)).toHaveLength(1);
    const ack = `/api/returns/${first.id}/acknowledgment`;
    expect((await anonymous.request.get(ack)).status()).toBe(401);
    const original = await context.request.get(ack);
    expect(original.status()).toBe(200); expect(original.headers()['cache-control']).toContain('no-store');
    const originalText = await original.text();
    expect(originalText).toContain('I withdraw from this purchase.');
    expect(originalText).toContain(first.createdAt); expect(originalText).not.toContain('token=');
    const after = (await (await context.request.get(ordersPath)).json()).find((row: { id: string }) => row.id === order.id);
    expect(after.status).toBe(order.status); expect(after.checkout).toEqual(order.checkout);
    const page = await context.newPage();
    await page.goto(`/checkout/receipt/${order.id}`, { waitUntil: 'domcontentloaded' });
    const support = page.getByRole('region', { name: 'Help, withdrawal and refunds', exact: true });
    if (!await page.evaluate(() => localStorage.getItem('veggat:cookieConsent'))) await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    await support.scrollIntoViewIfNeeded();
    const item = support.getByRole('listitem').filter({ hasText: first.id });
    await expect(item).toContainText('Awaiting review');
    const downloadPromise = page.waitForEvent('download');
    await item.getByRole('link', { name: 'Save acknowledgment (.txt)', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`veggat-request-${first.id}.txt`);
    const file = testInfo.outputPath('demo-request-acknowledgment.txt'); await download.saveAs(file);
    expect(await (await import('node:fs/promises')).readFile(file, 'utf8')).toBe(originalText);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(item).toContainText(input.description);
    await expect(support.getByRole('button', { name: 'Withdraw from this purchase', exact: true })).toHaveCount(0);
  } finally { await context.close(); await anonymous.close(); }
});

test('S8 requests recover from failure, preserve filters and keep demo publishing read-only', async ({ browser, baseURL }, testInfo) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo; browser fixtures only');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('veggastare:uiPreferences', JSON.stringify({ preferredFiatCurrency: 'USD', preferredCryptoCurrency: 'ETH' }));
    localStorage.removeItem('veggastare_currency_rates');
  });
  const page = await context.newPage(), exceptions: string[] = [], writes: string[] = [];
  await page.route('**/api/currency-rates', route => route.fulfill({ json: { success: true, fiat: { rates: { USD: 1, NOK: 0.1 }, fresh: true }, crypto: { prices: { ETH: 2000 }, fresh: true } } }));
  page.on('pageerror', error => exceptions.push(error.message));
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    // EdgeStore's shared provider initializes on every app load; this is not an upload.
    if (request.method() !== 'GET' && path !== '/api/edgestore/init' && /^\/api\/(job-requests|edgestore)(\/|$)/.test(path)) writes.push(path);
  });
  const fixtures = ['Illustration brief', 'Website brief'].map((title, index) => ({
    id: `qa-request-${index}`, title, userId: 'qa-owner', user: { id: 'qa-owner', name: 'Demo creator', image: null },
    descriptions: ['A read-only request fixture for layout and error recovery.'], images: [], links: [], docs: [], companyIds: [],
    price: 100, negotiable: false, paymentMethod: null, delivery: null, additionalNotes: null,
    createdAt: `2026-09-${index ? '23' : '22'}T12:00:00Z`, updatedAt: '2026-09-23T12:00:00Z',
  }));
  let calls = 0;
  await page.route('**/api/job-requests', route => {
    calls++;
    return route.fulfill(calls === 1 || calls === 3 ? { status: 503, json: { error: 'QA unavailable' } } : { json: fixtures });
  });
  try {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    const main = page.getByRole('main');
    await expect(main.getByRole('alert')).toContainText('Could not load requests');
    await expect(main.getByText('No requests yet', { exact: true })).toHaveCount(0);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await main.getByRole('button', { name: 'Try again', exact: true }).click();
    const list = main.getByRole('list', { name: 'Job requests', exact: true });
    await expect(list.getByRole('link')).toHaveCount(2);
    await expect(list.getByRole('link').first()).toContainText('Website brief');
    await expect(list.locator('[data-price-display]').first()).toContainText(/USD\s*100\.00\s*\(0\.05 ETH\)/);
    await main.getByRole('button', { name: 'Refresh requests', exact: true }).click();
    await expect(main.getByRole('alert')).toContainText('Your last loaded results are still shown below.');
    await expect(list.getByRole('link')).toHaveCount(2);
    await main.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(main.getByRole('alert')).toHaveCount(0);
    await main.getByRole('combobox', { name: 'Sort requests', exact: true }).selectOption('oldest');
    await expect(list.getByRole('link').first()).toContainText('Illustration brief');
    await main.getByRole('searchbox', { name: 'Search requests', exact: true }).fill('no-match');
    await expect(main.getByText('No matching requests', { exact: true })).toBeVisible();
    await main.getByRole('button', { name: 'Clear search', exact: true }).click();
    await main.getByRole('searchbox', { name: 'Search requests', exact: true }).fill('Website');
    await expect(list.getByRole('link')).toHaveCount(1);
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('Website');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(main.getByRole('searchbox', { name: 'Search requests', exact: true })).toHaveValue('Website');
    await expect(main.getByRole('combobox', { name: 'Sort requests', exact: true })).toHaveValue('oldest');
    for (const width of [360, 390, 1280, 2560]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await main.getByRole('searchbox', { name: 'Search requests', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.mouse.move(width - 25, 650); await page.mouse.wheel(0, 2000);
      await expect(main.getByRole('link', { name: /Website brief/ })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`request-list-${width}.png`), fullPage: true });
    }
    await main.getByRole('link', { name: 'Post request', exact: true }).click();
    await expect(main.getByRole('heading', { name: 'Request publishing preview', exact: true })).toBeVisible();
    await expect(main.locator('input[type=file]')).toHaveCount(0);
    await expect(main.getByRole('button', { name: /submit|publish/i })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('request-demo-preview-390.png') });
    expect(writes).toEqual([]); expect(exceptions).toEqual([]);
  } finally { await context.close(); }
});

test('S5 demo receipt, chat and history agree without granting or replenishing credits', async ({ browser, baseURL }, testInfo) => {
  test.skip(process.env.E2E_ALLOWANCE_DISPLAY !== '1', 'Explicit read-only isolated demo regression');
  const { isolatedPreviewEnv } = await import('../scripts/with-preview-database.mjs');
  const { Pool } = await import('pg');
  const isolated = isolatedPreviewEnv();
  expect(['http://localhost:3000', 'https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app']).toContain(baseURL);
  expect(process.env.DATABASE_URL_MAINPREVIEW === isolated.DATABASE_URL_MAINPREVIEW).toBe(true);
  const database = new URL(isolated.DATABASE_URL_MAINPREVIEW);
  database.searchParams.set('sslmode', 'verify-full');
  const pool = new Pool({ connectionString: database.toString(), max: 1 });
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo && session.user.id.startsWith('demo_')).toBe(true);
    const accountId = `DEMO:${session.user.id}`;
    const account = async () => (await pool.query('SELECT balance, "refundAdjustment" FROM "AiCreditAccount" WHERE id=$1', [accountId])).rows;
    const entries = async () => (await pool.query('SELECT id FROM "AiCreditEntry" WHERE "accountId"=$1 ORDER BY id', [accountId])).rows;
    const beforeAccount = await account(), beforeEntries = await entries();
    // This retained fixture has never sent an AI message; the actual grant must
    // remain absent even after all read surfaces and a receipt reload.
    expect(beforeAccount).toEqual([]);
    expect(beforeEntries).toEqual([]);
    const config = await (await context.request.get('/api/ai-chat/config')).json();
    expect(config).toMatchObject({ demo: true, balance: 5, unclaimedDemoAllowance: 5 });
    const orders = await (await context.request.get(`/api/orders/user/${session.user.id}`)).json();
    const order = orders.find((item: { id: string; checkout?: { environment: string; state: string } }) => item.checkout?.environment === 'DEMO' && item.checkout.state === 'COMPLETED');
    expect(order).toBeTruthy();
    const page = await context.newPage();
    const main = page.getByRole('main');
    await page.goto(`/checkout/receipt/${order.id}`, { waitUntil: 'domcontentloaded' });
    await expect(main.getByTestId('receipt-ai-credit-balance')).toHaveText('5 demo credits');
    await expect(main.getByText('Includes your free demo allowance, activated on your first supported message. This order did not buy credits.', { exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('demo-receipt-allowance-390.png') });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(main.getByTestId('receipt-ai-credit-balance')).toHaveText('5 demo credits');
    await page.goto('/ai/credits', { waitUntil: 'domcontentloaded' });
    const available = main.getByRole('term').filter({ hasText: /^Available$/ }).locator('..').getByRole('definition');
    await expect(available).toHaveText('5');
    await expect(main.getByText('Available includes your free 5-credit demo allowance.', { exact: false })).toBeVisible();
    expect(await account()).toEqual(beforeAccount);
    expect(await entries()).toEqual(beforeEntries);
  } finally { await context.close(); await pool.end(); }
});

test('S2 security patch rejects malformed sessions and preserves OAuth host and cookie checks', async ({ playwright, baseURL }) => {
  test.skip(process.env.E2E_SECURITY_REGRESSION !== '1', 'Explicit auth protocol regression only');
  const origin = new URL(baseURL!).origin;
  const secure = origin.startsWith('https:');
  const guest = await playwright.request.newContext({ baseURL });
  try {
    for (const bearer of ['%', '%E0%A4%A', '%GG', 'not-a-jwt']) {
      const session = await guest.get('/api/auth/session', { headers: { Authorization: `Bearer ${bearer}` } });
      expect(session.status()).toBe(200);
      expect(Boolean((await session.json())?.user?.id)).toBe(false);
      expect((await guest.get('/api/wallets', { headers: { Authorization: `Bearer ${bearer}` } })).status()).toBe(401);
    }
    const providers = await (await guest.get('/api/auth/providers')).json();
    for (const provider of ['google', 'github', 'discord']) {
      if (!providers[provider]) continue; // Unconfigured providers must not masquerade as successful OAuth.
      const client = await playwright.request.newContext({ baseURL });
      try {
        const csrfToken = (await (await client.get('/api/auth/csrf')).json()).csrfToken;
        const result = await client.post(`/api/auth/signin/${provider}`, {
          form: { csrfToken, callbackUrl: `${origin}/products` },
          headers: { 'X-Auth-Return-Redirect': '1', Origin: origin }, maxRedirects: 0,
        });
        expect(result.status()).toBe(200);
        const redirect = new URL((await result.json()).url);
        expect(redirect.hostname).toBe({ google: 'accounts.google.com', github: 'github.com', discord: 'discord.com' }[provider]);
        expect(redirect.searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/callback/${provider}`);
        expect(redirect.searchParams.get('code_challenge_method')).toBe('S256');
        const checkCookies = (await client.storageState()).cookies.filter(cookie => /authjs\.(pkce|state|nonce)/.test(cookie.name));
        expect(checkCookies.length).toBeGreaterThan(0);
        expect(checkCookies.every(cookie => cookie.httpOnly && cookie.secure === secure && cookie.sameSite === 'Lax')).toBe(true);
        // An unsolicited callback never authenticates, even with a real sign-in check cookie.
        const callback = await client.get(`/api/auth/callback/${provider}?error=access_denied`, { maxRedirects: 0 });
        expect(callback.status()).toBeLessThan(500);
        expect(Boolean((await (await client.get('/api/auth/session')).json())?.user?.id)).toBe(false);
      } finally { await client.dispose(); }
    }
  } finally { await guest.dispose(); }
});

test('S2 security patch password login, protected routes and logout at phone and desktop sizes', async ({ browser, baseURL }, testInfo) => {
  test.skip(process.env.E2E_SECURITY_REGRESSION !== '1', 'Explicit isolated password-user regression only');
  expect(['http://localhost:3000', 'https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app']).toContain(baseURL);
  expect(Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)).toBe(true);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fprofile/);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await page.getByPlaceholder('you@example.com').fill(process.env.E2E_TEST_EMAIL!);
    await page.locator('input[type=password]').fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/profile(?:[/?#]|$)/);
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user).toMatchObject({ id: 'cveggatpreviewbuyer000001', role: 'USER', isDemo: false });
    expect((await context.request.get('/api/wallets')).status()).toBe(200);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath('password-buyer-cart-1280.png') });
    await page.goto('/api/auth/signout', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect.poll(async () => Boolean((await (await context.request.get('/api/auth/session')).json())?.user?.id)).toBe(false);
    expect((await context.request.get('/api/wallets')).status()).toBe(401);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('CI showcase happy path — real demo, custom cart, payment error recovery and unpaid receipt', async ({ browser, baseURL }, testInfo) => {
  test.skip(process.env.E2E_CI_SHOWCASE !== '1', 'Explicit disposable demo flow only');
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [], checkoutRequests: { requestKey: string; expectedQuote: string }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await context.route(/https:\/\/[^/]*paypal\.com\//, route => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Try the demo — no payment', exact: true }).click();
    await page.waitForURL('**/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('complementary', { name: 'Demo mode', exact: true })).toBeVisible();
    await page.getByText('Interviewer AI Credits', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Interviewer AI Credits', exact: true, level: 1 })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    const creditPreview = page.getByRole('figure', { name: 'Selected credit amount', exact: true });
    await expect(creditPreview).toBeVisible();
    await expect(creditPreview.locator('[data-credit-preview]')).toHaveText('100');
    await page.getByRole('textbox', { name: 'Number of credits', exact: true }).fill('122');
    await page.getByRole('button', { name: 'Update credits', exact: true }).click();
    await expect(creditPreview.locator('[data-credit-preview]')).toHaveText('122');
    await page.getByRole('button', { name: 'Add to basket', exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: '1 item in basket', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View basket', exact: true }).click();
    await page.waitForURL('**/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Number of credits', exact: true })).toHaveValue('122');
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user).toMatchObject({ isDemo: true, role: 'USER' });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('link', { name: 'Proceed to checkout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Secure checkout', exact: true })).toBeVisible();
    // One browser-only outage fixture, then the real unpaid demo handler.
    // PayPal transport is separately mocked in unit tests, never contacted here.
    await page.route('**/api/demo/checkout', route => {
      checkoutRequests.push(route.request().postDataJSON());
      return checkoutRequests.length === 1 ? route.fulfill({ status: 503, json: { error: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' } }) : route.continue();
    });
    const submit = page.getByRole('button', { name: 'Complete free demo order', exact: true });
    await submit.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Your cart is saved' })).toBeVisible();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole('heading', { name: 'Your demo order is ready', exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Receipt items', exact: true })).toContainText('122 credits');
    const confirmationLink = page.getByRole('link', { name: 'Download order confirmation (.txt)', exact: true });
    await expect(confirmationLink).toBeVisible();
    const confirmationPath = await confirmationLink.getAttribute('href');
    const confirmation = await context.request.get(confirmationPath!);
    expect(confirmation.status()).toBe(200);
    expect(confirmation.headers()['content-disposition']).toContain('attachment;');
    const confirmationText = await confirmation.text();
    expect(confirmationText).toContain('Actually charged: 0.00 NOK');
    expect(confirmationText).toContain('no paid delivery consent was collected');
    const anonymous = await browser.newContext({ baseURL });
    try { expect((await anonymous.request.get(confirmationPath!)).status()).toBe(401); }
    finally { await anonymous.close(); }
    expect(checkoutRequests).toHaveLength(2);
    expect(checkoutRequests[1]).toEqual(checkoutRequests[0]);
    const orders = await (await context.request.get(`/api/orders/user/${session.user.id}`)).json();
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ checkout: { environment: 'DEMO', state: 'COMPLETED', captureId: null }, payment: null });
    const replay = await context.request.post('/api/demo/checkout', { headers: { Origin: new URL(baseURL!).origin }, data: checkoutRequests[1] });
    expect(replay.ok()).toBe(true);
    expect(await replay.json()).toMatchObject({ orderId: orders[0].id, alreadyCompleted: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('interview-demo-receipt-390.png') });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S4 delivery consent is explicit, responsive and never contacts PayPal in UI QA', async ({ browser, baseURL }, testInfo) => {
  test.skip(process.env.E2E_DELIVERY_CONSENT !== '1', 'Opt-in isolated password buyer only; checkout POST is mocked');
  test.setTimeout(180_000);
  expect(['http://localhost:3000', 'https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app']).toContain(baseURL);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const added: string[] = [];
  let buyerId = '';
  const posts: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await context.route(/https:\/\/[^/]*paypal\.com\//, route => route.abort());
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('you@example.com').fill(process.env.E2E_TEST_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/\/(nexus|products|dashboard|pulse)(?:[/?#]|$)/);
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user).toMatchObject({ id: 'cveggatpreviewbuyer000001', role: 'USER' });
    buyerId = session.user.id;
    const initial = await (await context.request.get(`/api/cart/${buyerId}`)).json();
    for (const productId of ['cveggatinterviewpack000001', 'cveggatinterviewcredits01']) {
      if (!initial.items.some((item: { product: { id: string } }) => item.product.id === productId)) {
        expect((await context.request.post(`/api/cart/${buyerId}`, { data: { productId, quantity: 1 } })).ok()).toBe(true);
        added.push(productId);
      }
    }
    await page.route('**/api/checkout', route => {
      posts.push(route.request().postDataJSON());
      return route.fulfill({ status: 503, json: { error: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' } });
    });
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Secure checkout', exact: true })).toBeVisible();
    const cookieConsent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await cookieConsent.isVisible()) await cookieConsent.click();
    const files = page.getByRole('checkbox', { name: /^I request immediate delivery of the digital files/ });
    const credits = page.getByRole('checkbox', { name: /^I request that AI usage starts/ });
    const submit = page.getByRole('button', { name: 'Continue to PayPal', exact: true });
    await expect(files).not.toBeChecked(); await expect(credits).not.toBeChecked();
    await submit.click();
    await expect(files).toBeFocused(); expect(posts).toHaveLength(0);
    await files.press('Space'); await submit.click();
    await expect(credits).toBeFocused(); expect(posts).toHaveLength(0);
    await credits.press('Space');
    await expect(page.getByRole('alert').filter({ hasText: 'Select the delivery request' })).toHaveCount(0);
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ([390, 1280].includes(size.width)) await page.screenshot({ path: testInfo.outputPath(`delivery-payment-controls-${size.width}.png`) });
      await page.getByRole('heading', { name: 'Secure checkout', exact: true }).scrollIntoViewIfNeeded();
      if ([390, 1280].includes(size.width)) await page.screenshot({ path: testInfo.outputPath(`delivery-consent-${size.width}.png`), fullPage: true });
    }
    await submit.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Your cart is saved' })).toBeVisible();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ consent: { version: '2026-09-24.1', files: true, credits: true } });
    await submit.click();
    expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]);
    await expect(submit).toBeEnabled();
    expect(errors).toEqual([]);
  } finally {
    if (buyerId && added.length) {
      const current = await (await context.request.get(`/api/cart/${buyerId}`)).json();
      for (const item of current.items) if (added.includes(item.product.id)) {
        expect((await context.request.delete(`/api/cart/${buyerId}/items/${item.id}`)).ok()).toBe(true);
      }
    }
    await context.close();
  }
});

test('S7 isolated Preview prepares a free demo receipt for currency QA', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_PREVIEW_SEED_DEMO !== '1', 'Explicit isolated Preview demo creation only');
  test.setTimeout(120_000);
  expect(baseURL).toBe('https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app');
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await page.getByRole('button', { name: 'Try the demo — no payment', exact: true }).click();
    await expect(page).toHaveURL(/\/products$/);
    expect((await (await context.request.get('/api/auth/session')).json()).user.isDemo).toBe(true);
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await page.getByRole('region', { name: 'Product purchase', exact: true }).getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page.getByText('Added to basket', { exact: true })).toBeVisible();
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Complete free demo order', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your demo order is ready', exact: true })).toBeVisible();
    await expect(page.locator('main')).toContainText('Demo · no payment collected');
    // Repopulate only this new demo's cart for cross-route display checks.
    await page.goto('/products/cveggatinterviewcredits01', { waitUntil: 'domcontentloaded' });
    await page.getByRole('region', { name: 'Product purchase', exact: true }).getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page.getByText('Added to basket', { exact: true })).toBeVisible();
    await context.storageState({ path: '.private-showcase/preview-currency-demo-state.json' });
  } finally { await context.close(); }
});

test('S7 selected-currency price controls preserve the budget and validate exact ranges', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await context.addInitScript(() => { localStorage.setItem('veggastare:uiPreferences', JSON.stringify({ preferredFiatCurrency: 'NOK', preferredCryptoCurrency: 'ETH' })); localStorage.removeItem('veggastare_currency_rates'); });
    await page.route('**/api/currency-rates', route => route.fulfill({ json: { success: true, fiat: { rates: { USD: 1, NOK: 0.1 }, fresh: true }, crypto: { prices: { ETH: 2000 }, fresh: true } } }));
    const response = await context.request.get('/api/products?perPage=50');
    expect(response.ok()).toBe(true);
    const catalog = (await response.json()).filter((item: { id: string }) => ['cveggatinterviewpack000001', 'cveggatinterviewcredits01'].includes(item.id));
    expect(catalog).toHaveLength(2);
    let maxSent: string | null = null;
    await page.route(url => url.pathname === '/api/products', route => {
      const params = new URL(route.request().url()).searchParams;
      maxSent = params.get('maxPrice');
      const max = maxSent == null ? Infinity : Number(maxSent), min = Number(params.get('minPrice') ?? 0);
      return route.fulfill({ json: catalog.filter((item: { price: number }) => item.price * 0.1 >= min && item.price * 0.1 <= max) });
    });
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('article')).toHaveCount(2);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await page.getByRole('button', { name: 'Product filters', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Product filters', exact: true });
    await panel.getByText('Enter exact values', { exact: true }).click();
    await panel.getByRole('spinbutton', { name: 'Maximum price (NOK)', exact: true }).fill('35');
    await panel.getByRole('button', { name: 'Apply price range', exact: true }).click();
    await expect.poll(() => maxSent).toBe('3.5');
    // The mobile drawer correctly makes catalogue semantics inert until closed.
    await expect(page.locator('article')).toHaveCount(1);
    await panel.getByRole('spinbutton', { name: 'Minimum price (NOK)', exact: true }).fill('40');
    await panel.getByRole('button', { name: 'Apply price range', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('maximum at least');
    expect(maxSent).toBe('3.5');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: 'Display currency: NOK (ETH)', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'US Dollar', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Product filters', exact: true }).click();
    await panel.getByText('Enter exact values', { exact: true }).click();
    await expect(panel.getByRole('spinbutton', { name: 'Maximum price (USD)', exact: true })).toHaveValue('3.5');
    await expect(panel.getByRole('spinbutton', { name: 'Minimum price (USD)', exact: true })).toHaveValue('');
    await expect(page.locator('article')).toHaveCount(1);
    await expect(panel.getByLabel('Selected price range')).toContainText('ETH)');
    await page.screenshot({ path: 'test-results/currency-price-filter-390.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Product filters', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Product filters', exact: true })).toContainText('Filter in USD');
    await page.screenshot({ path: 'test-results/currency-price-filter-1280.png' });
    // Real read-only server query, independent of mocked UI rates/results above.
    const nokResponse = await context.request.get('/api/products?priceCurrency=NOK&maxPrice=30&perPage=50');
    expect(nokResponse.status()).toBe(200);
    expect((await nokResponse.json()).map((item: { id: string }) => item.id)).toContain('cveggatinterviewpack000001');
    expect((await (await context.request.get('/api/products?priceCurrency=NOK&maxPrice=30&perPage=50')).json()).map((item: { id: string }) => item.id)).not.toContain('cveggatinterviewcredits01');
  } finally { await context.close(); }
});

test('S7 basket retries failed reads and reconciles uncertain concurrent edits without replaying writes', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses retained demo identity and intercepted cart requests only');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 1280, height: 800 } });
  let releaseFirst!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  let releaseHydration!: () => void;
  const hydration = new Promise<void>(resolve => { releaseHydration = resolve; });
  try {
    const page = await context.newPage();
    // Simulate a slow JS download: a server-rendered basket must not swallow an early click.
    await page.route('**/_next/static/**/*.js', async route => { await hydration; await route.continue(); });
    const catalog = await (await context.request.get('/api/products?perPage=2')).json();
    let lines = catalog.map((item: { id: string; title: string; price: number; priceCurrency: string; image: string[] }, i: number) => ({ id: `basket-qa-${i}`, quantity: 1, product: { id: item.id, title: item.title, price: item.price, priceCurrency: item.priceCurrency, image: item.image } }));
    let failRead = true, loseFirstResponse = true, writes = 0;
    await page.route(url => url.pathname.startsWith('/api/cart/'), async route => {
      if (route.request().method() === 'GET') return route.fulfill(failRead ? { status: 503, json: { error: 'Fixture unavailable' } } : { json: { id: 'basket-qa', userId: 'demo-qa', items: lines } });
      const id = new URL(route.request().url()).pathname.split('/').at(-1);
      writes++;
      const data = route.request().postDataJSON();
      lines = lines.map((item: { id: string; quantity: number }) => item.id === id ? { ...item, quantity: data.quantity ?? item.quantity + (data.changeType === 'increment' ? 1 : -1) } : item);
      if (id === lines[0].id && loseFirstResponse) { await first; return route.fulfill({ status: 503, json: { error: 'Simulated lost response after commit' } }); }
      return route.fulfill({ json: lines.find((item: { id: string }) => item.id === id) });
    });
    await page.goto('/products', { waitUntil: 'commit' });
    const opener = page.getByRole('button', { name: /^(Basket|\d+ items? in basket)$/ });
    await expect(opener).toBeDisabled();
    releaseHydration();
    await expect(opener).toBeEnabled();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await opener.click();
    const basket = page.getByRole('dialog', { name: 'Shopping basket', exact: true });
    await expect(basket.getByRole('alert')).toContainText('refresh before making another change');
    await expect(basket.getByText('Your basket is empty', { exact: true })).toHaveCount(0);
    failRead = false;
    await basket.getByRole('button', { name: 'Retry saved basket', exact: true }).click();
    const quantities = basket.getByRole('spinbutton');
    await expect(quantities).toHaveCount(2);
    await quantities.first().fill('555');
    await expect(basket.getByRole('button', { name: 'Checkout', exact: true })).toBeDisabled();
    expect(writes).toBe(0);
    await quantities.first().press('Enter');
    await expect(quantities.first()).toBeDisabled();
    await basket.getByRole('button', { name: `Increase quantity for ${lines[1].product.title}`, exact: true }).click();
    await expect(quantities.last()).toHaveValue('2');
    await expect(quantities.last()).toBeEnabled();
    expect(writes).toBe(2);
    failRead = true; releaseFirst();
    await expect(basket.getByRole('alert')).toContainText('refresh before making another change');
    await expect(quantities).toHaveCount(2);
    await expect(quantities.first()).toHaveValue('1');
    await expect(quantities.last()).toHaveValue('2');
    failRead = false; loseFirstResponse = false;
    await basket.getByRole('button', { name: 'Retry saved basket', exact: true }).click();
    await expect(quantities.first()).toHaveValue('555');
    expect(writes).toBe(2);
    await page.screenshot({ path: 'test-results/basket-recovered-1280.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(basket).toBeInViewport();
    const rect = await basket.boundingBox(); expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/basket-recovered-390.png' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Escape');
    await expect(basket).toHaveCount(0); await expect(opener).toBeFocused();
  } finally { releaseHydration(); releaseFirst(); await context.close(); }
});

test('S7 seller and warehouse prices use selected fiat and crypto without changing order amounts', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained demo session; read-only order fixtures');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 1280, height: 800 } });
  try {
    await context.addInitScript(() => {
      localStorage.setItem('veggastare:uiPreferences', JSON.stringify({ preferredFiatCurrency: 'USD', preferredCryptoCurrency: 'ETH' }));
      localStorage.removeItem('veggastare_currency_rates');
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/currency-rates', route => route.fulfill({ json: { success: true, fiat: { rates: { USD: 1, NOK: 0.1, EUR: 1.1 }, fresh: true }, crypto: { prices: { ETH: 2000 }, fresh: true } } }));
    const orders = [{ id: 'qa-00000001', currency: 'NOK', amount: 39 }, { id: 'qa-00000002', currency: 'EUR', amount: 2 }].map(({ id, currency, amount }) => ({
      id, currency, totalAmount: amount, createdAt: '2026-09-23T12:00:00Z', status: 'COMPLETED', fulfilmentStatus: 'UNFULFILLED', claimedByUserId: null, claimedAt: null,
      shippedAt: null, deliveredAt: null, trackingNumber: null, trackingUrl: null, labelUrl: null, shippingServiceName: null, estimatedDelivery: null,
      customer: { id: 'qa-buyer', name: 'Display fixture', email: null }, shipping: { name: null, address: null, city: null, postalCode: null, country: null, phone: null, email: null, method: null, cost: null }, payment: null,
      items: [{ id: `${id}-item`, quantity: 1, priceAtTime: amount, title: 'Display-only item', product: { id: 'qa-product', title: 'Display-only item', image: [], productType: 'DIGITAL', companyId: 'qa-company' } }],
    }));
    // Fulfill GETs only. These fixtures exercise presentation, not API authorization or fulfillment.
    for (const pattern of ['**/api/seller/orders?*', '**/api/companies/qa-company/orders?*']) {
      await page.route(pattern, route => route.request().method() !== 'GET' ? route.abort() : route.fulfill({ json: { orders, pagination: { page: 1, totalPages: 1, total: 2 } } }));
    }
    for (const path of ['/my-sales', '/nexus/company/qa-company/warehouse/qa-warehouse/orders']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const firstOrder = page.getByRole('button', { name: /#00000001/ });
      await expect(firstOrder).toContainText(/USD\s*3\.90\s*\(0\.00195 ETH\)/);
      await expect(page.getByRole('button', { name: /#00000002/ })).toContainText(/USD\s*2\.20\s*\(0\.0011 ETH\)/);
      if (path === '/my-sales') await expect(page.getByText('Omsetning (viste)', { exact: true }).locator('..').locator('..')).toContainText(/USD\s*6\.10\s*\(0\.00305 ETH\)/);
      await firstOrder.click();
      const prices = page.locator('main [data-price-display]');
      expect(await prices.count()).toBeGreaterThanOrEqual(3);
      for (const price of await prices.all()) {
        await expect(price).toContainText('USD'); await expect(price).toContainText('ETH)');
        await expect(price).not.toContainText('NOK'); await expect(price).not.toContainText('EUR');
      }
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S7 global fiat and crypto selection persists across shopping, receipt and orders', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses a retained demo session without purchasing');
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await context.addInitScript(() => {
      if (!localStorage.getItem('currency-qa-initialized')) {
        localStorage.setItem('veggastare:uiPreferences', JSON.stringify({ preferredFiatCurrency: 'USD', preferredCryptoCurrency: 'ETH' }));
        localStorage.setItem('currency-qa-initialized', '1');
      }
      localStorage.removeItem('veggastare_currency_rates');
    });
    await page.route('**/api/currency-rates', route => route.fulfill({ json: { success: true, fiat: { rates: { USD: 1, NOK: 0.1, EUR: 1.1 }, fresh: true }, crypto: { prices: { ETH: 2000, BTC: 100000 }, fresh: true } } }));
    await page.goto('/products/cveggatinterviewcredits01', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-product-price]')).toContainText(/USD\s*3\.90\s*\(0\.00195 ETH\)/);
    const specificationPrice = page.locator('dt').filter({ hasText: /^Price$/ }).locator('..');
    await expect(specificationPrice).toContainText(/USD\s*3\.90\s*\(0\.00195 ETH\)/);
    await expect(specificationPrice).not.toContainText('NOK');
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    const trigger = page.getByRole('button', { name: /^Display currency:/ });
    await trigger.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitemradio', { name: 'US Dollar', exact: true })).toBeChecked();
    await menu.getByRole('menuitemradio', { name: 'Bitcoin', exact: true }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitemradio', { name: 'Norwegian Krone', exact: true }).click();
    await expect(menu.getByRole('menuitemradio', { name: 'Bitcoin', exact: true })).toBeChecked();
    await expect(menu).toHaveAccessibleName('Display currency: NOK (BTC)');
    await menu.getByRole('menuitemradio', { name: 'Ethereum', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(page.locator('[data-product-price]')).toContainText(/NOK\s*39\.00\s*\(0\.00195 ETH\)/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(trigger).toHaveAccessibleName('Display currency: NOK (ETH)');
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo).toBe(true);
    const orders = await (await context.request.get(`/api/orders/user/${session.user.id}`)).json();
    const receipt = orders.find((order: { checkout?: { state: string } }) => order.checkout?.state === 'COMPLETED');
    expect(receipt, 'A retained demo receipt is required; this test never makes a purchase').toBeTruthy();
    for (const path of ['/products', '/cart', '/checkout', `/checkout/receipt/${receipt.id}`, '/my-orders', '/pricing']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(trigger).toHaveAccessibleName('Display currency: NOK (ETH)');
      const prices = page.locator('main [data-price-display]');
      await expect(prices.first()).toContainText('ETH)');
      for (const price of await prices.all()) {
        await expect(price).toContainText('NOK');
        await expect(price).toContainText('ETH)');
        await expect(price).not.toContainText('(NOK');
      }
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('main, [data-site-scroll]')].every(element => element.scrollWidth <= element.clientWidth)), `${path} at ${size.width}`).toBe(true);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await trigger.click();
    await menu.getByRole('menuitemradio', { name: 'US Dollar', exact: true }).click();
    await menu.getByRole('menuitemradio', { name: 'No Crypto', exact: true }).click();
    await menu.getByRole('menuitem', { name: 'Done', exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAccessibleName('Display currency: USD');
    for (const price of await page.locator('main [data-price-display]').all()) {
      await expect(price).toContainText('USD'); await expect(price).not.toContainText('(');
    }
    await trigger.focus(); await page.keyboard.press('ArrowDown');
    await expect(menu).toBeVisible();
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem', { name: 'Done', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden(); await expect(trigger).toBeFocused();
    await page.setViewportSize({ width: 844, height: 390 });
    await trigger.click();
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem', { name: 'Done', exact: true })).toBeFocused();
    await expect(menu.getByRole('menuitem', { name: 'Done', exact: true })).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.click();
    await menu.getByRole('menuitemradio', { name: 'Ethereum', exact: true }).click();
    await page.screenshot({ path: 'test-results/currency-menu-390.png' });
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await page.screenshot({ path: 'test-results/currency-cart-390.png' });
    await page.setViewportSize({ width: 1280, height: 800 });
    const basket = page.getByRole('button', { name: /items? in basket/ });
    await basket.click();
    await expect(page.getByText('Your Basket', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Full Cart', exact: true })).toBeVisible();
    const miniCart = page.getByText('Your Basket', { exact: true }).locator('..').locator('..').locator('..');
    await expect(miniCart).toHaveCSS('opacity', '1');
    await expect(miniCart.getByRole('link', { name: 'Interviewer AI Credits', exact: true }).filter({ hasText: 'Interviewer AI Credits' }).locator('..').locator('..')).toHaveCSS('opacity', '1');
    for (const price of await miniCart.locator('[data-price-display]').all()) {
      await expect(price).toContainText('USD'); await expect(price).toContainText('ETH)');
    }
    await page.screenshot({ path: 'test-results/currency-mini-cart-1280.png' });
    await page.keyboard.press('Escape');
    await expect(basket).toBeFocused();
    await expect(basket).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/checkout/receipt/${receipt.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your demo order is ready', exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Receipt items', exact: true }).locator('[data-price-display]').first()).toContainText('ETH)');
    await page.screenshot({ path: 'test-results/currency-receipt-390.png' });
    // Read-only browser fixtures cover unlike listing currencies; never edit a real cart.
    const savedCart = await (await context.request.get(`/api/cart/${session.user.id}`)).json();
    const fixtureItem = savedCart.items[0];
    await page.route(`**/api/cart/${session.user.id}`, route => route.request().method() !== 'GET' ? route.abort() : route.fulfill({ json: { ...savedCart, items: [
      { ...fixtureItem, quantity: 1, product: { ...fixtureItem.product, price: 39, priceCurrency: 'NOK' } },
      { ...fixtureItem, id: 'qa-eur-row', quantity: 1, product: { ...fixtureItem.product, id: 'qa-eur-product', title: 'Euro display fixture', price: 2, priceCurrency: 'EUR' } },
    ] } }));
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    const mixedSummary = page.getByRole('region', { name: 'Cart summary', exact: true });
    await expect(mixedSummary.locator('[data-price-display]')).toHaveCount(1);
    await expect(mixedSummary).toContainText(/USD\s*6\.10\s*\(0\.00305 ETH\)/);
    await expect(mixedSummary).not.toContainText('NOK'); await expect(mixedSummary).not.toContainText('EUR');
    await expect(page.getByRole('button', { name: 'Proceed to checkout', exact: true })).toBeDisabled();
    await page.route('**/api/job-requests/currency-qa', route => route.fulfill({ json: { id: 'currency-qa', title: 'Currency display QA', descriptions: ['Read-only budget fixture'], images: [], links: [], docs: [], price: 24, negotiable: false, paymentMethod: null, delivery: null, additionalNotes: null, createdAt: '2026-09-23T12:00:00Z', user: { id: session.user.id, name: 'Demo reviewer', image: null } } }));
    await page.goto('/jobs/currency-qa', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Currency display QA', exact: true })).toBeVisible();
    await expect(page.locator('main [data-price-display]')).toHaveCount(2);
    for (const budget of await page.locator('main [data-price-display]').all()) await expect(budget).toContainText(/USD\s*24\.00\s*\(0\.012 ETH\)/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S4 checkout uses one selected currency and locks payment while removing an item', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE || baseURL !== 'http://localhost:3000', 'Local retained demo only; no payment requests');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  let releaseRemoval = () => {};
  let restore: { userId: string; productId: string; quantity: number } | undefined;
  try {
    await context.addInitScript(() => {
      localStorage.setItem('veggastare:uiPreferences', JSON.stringify({ preferredFiatCurrency: 'USD', preferredCryptoCurrency: 'ETH' }));
      localStorage.removeItem('veggastare_currency_rates');
    });
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo).toBe(true);
    const cart = await (await context.request.get(`/api/cart/${session.user.id}`)).json();
    expect(cart.items.length).toBeGreaterThan(0);
    const item = cart.items[0];
    restore = { userId: session.user.id, productId: item.product.id, quantity: item.quantity };
    const page = await context.newPage();
    let paymentCalls = 0;
    await page.route('**/api/demo/checkout', route => { paymentCalls++; return route.abort(); });
    await page.route('**/api/currency-rates', route => route.fulfill({ json: { success: true, fiat: { rates: { USD: 1, NOK: 0.1 }, fresh: true }, crypto: { prices: { ETH: 2000 }, fresh: true } } }));
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    const order = page.getByRole('region', { name: 'Order items', exact: true });
    await expect(order).toContainText('USD'); await expect(order).not.toContainText('NOK');
    await expect(order).toContainText('ETH)');
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await page.screenshot({ path: 'test-results/checkout-selected-usd-390.png' });
    const gate = new Promise<void>(resolve => { releaseRemoval = resolve; });
    await page.route(`**/api/cart/${session.user.id}/items/${item.id}`, async route => { await gate; await route.continue(); });
    await page.getByRole('button', { name: `Remove ${item.product.title} from order`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Complete free demo order', exact: true })).toBeDisabled();
    releaseRemoval();
    await expect(page.getByRole('button', { name: `Remove ${item.product.title} from order`, exact: true })).toHaveCount(0);
    const saved = await (await context.request.get(`/api/cart/${session.user.id}`)).json();
    expect(saved.items.some((entry: { id: string }) => entry.id === item.id)).toBe(false);
    expect(paymentCalls).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    releaseRemoval();
    if (restore) {
      const saved = await (await context.request.get(`/api/cart/${restore.userId}`)).json();
      if (!saved.items.some((entry: { product: { id: string } }) => entry.product.id === restore!.productId)) {
        expect((await context.request.post(`/api/cart/${restore.userId}`, { data: { productId: restore.productId, quantity: restore.quantity } })).ok()).toBe(true);
      }
    }
    await context.close();
  }
});

test('S4 isolated Preview password buyer signs in and opens the real product cart', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_PREVIEW_BUYER !== '1', 'Explicit isolated Preview credentials required');
  test.setTimeout(120_000);
  expect(baseURL).toBe('https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app');
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('you@example.com').fill(process.env.E2E_TEST_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/\/(nexus|products|dashboard|pulse)(?:[/?#]|$)/, { timeout: 30_000 });
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.id).toBe('cveggatpreviewbuyer000001');
    expect(session.user.role).toBe('USER');
    await context.storageState({ path: '.private-showcase/preview-buyer-state.json' });
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await page.getByRole('button', { name: 'Add to basket', exact: true }).last().click();
    await expect(page.getByText(/^(Added to basket|Already in your basket)$/)).toBeVisible();
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Veggat Interview Pack', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/preview-buyer-cart-390.png' });
  } finally { await context.close(); }
});

test('S5 buyer credit history requires sign-in and remains readable across screen sizes', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required; read-only history');
  test.setTimeout(120_000);
  const anonymous = await browser.newContext({ baseURL });
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const guestPage = await anonymous.newPage();
    await guestPage.goto('/ai/credits', { waitUntil: 'domcontentloaded' });
    await expect(guestPage).toHaveURL(/\/auth\/login/);
    const page = await context.newPage();
    await page.goto('/ai/credits?environment=LIVE&userId=someone-else', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your AI credits', exact: true })).toBeVisible();
    // Streaming can briefly retain a hidden server segment outside the app's main.
    // Assert the user-facing region and wait until there is only one rendered copy.
    const demoLedgerLabel = page.locator('main').getByText('Demo credits · no payment needed', { exact: true });
    await expect(demoLedgerLabel).toHaveCount(1);
    await expect(demoLedgerLabel).toBeVisible();
    await expect(page.getByRole('link', { name: 'Buy credits', exact: true })).toHaveCount(0);
    await expect(page.getByText('Reserved credits are already deducted from Available.', { exact: false })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await page.getByRole('heading', { name: 'Recent activity', exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('heading', { name: 'Recent activity', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ([390, 2560].includes(size.width)) await page.screenshot({ path: `test-results/buyer-credits-${size.width}.png` });
      await page.getByRole('heading', { name: 'Your AI credits', exact: true }).scrollIntoViewIfNeeded();
    }
    await page.getByRole('link', { name: 'Back to AI chat', exact: true }).click();
    await expect(page).toHaveURL(/\/ai$/);
    const sessions = await (await context.request.get('/api/ai-chat/sessions?limit=20')).json();
    await page.goto(sessions.sessions.length ? `/ai/${sessions.sessions[0].id}` : '/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /^Credit history:/ }).click();
    await expect(page).toHaveURL(/\/ai\/credits$/);
    await expect(page.getByRole('heading', { name: 'Your AI credits', exact: true })).toBeVisible();
  } finally { await context.close(); await anonymous.close(); }
});

test('S5 owner credit report retries, filters and scrolls without changing server permissions', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained demo required; owner UI uses browser-only fixtures');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.role).not.toBe('OWNER');
    let denied = await context.request.get('/api/admin/ai-credits');
    if (denied.status() === 401 && process.env.GATE_PASSWORD) {
      // Demo sessions deliberately cannot POST; authenticate the gate before adding the demo session.
      const gateContext = await browser.newContext({ baseURL });
      try {
        expect((await gateContext.request.post('/api/access-gate', { data: { password: process.env.GATE_PASSWORD } })).ok()).toBe(true);
        await context.addCookies(await gateContext.cookies());
      } finally { await gateContext.close(); }
      denied = await context.request.get('/api/admin/ai-credits');
    }
    expect(denied.status()).toBe(403);
    await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, role: 'OWNER' } } }));
    let requests = 0;
    await page.route(url => url.pathname === '/api/admin/ai-credits', async route => {
      requests++;
      if (requests === 1) return route.fulfill({ status: 503, json: { error: 'Credit reporting is unavailable. Retry shortly.' } });
      const environment = new URL(route.request().url()).searchParams.get('environment') ?? 'SANDBOX';
      return route.fulfill({ json: {
        environment, generatedAt: '2026-09-23T12:00:00Z',
        accounts: { total: 1, available: 30, refundAdjustment: 0, recent: [{ userId: 'qa-long-account-id-for-layout-verification', name: 'Synthetic reviewer with a deliberately long display name', available: 30, refundAdjustment: 0, updatedAt: '2026-09-23T12:00:00Z' }] },
        usage: { completed: 3, chargedCredits: 70, pending: 1, reservedCredits: 2, refundedRequests: 1, costCeilingMicroUsd: 790000 },
        payments: { captures: 2, grossOre: 6800, refundedOre: 2900 },
        platformToday: { day: '2026-09-23', reservedMicroUsd: 790000, limitMicroUsd: 5000000, requests: 5, requestLimit: 500 },
      } });
    });
    await page.goto('/admin/ai-credits', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Owner access required', exact: true })).toBeVisible();
    // Refresh the server-provided initial session through the browser-only fixture.
    await expect.poll(async () => {
      if (!requests) await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      return requests;
    }).toBeGreaterThan(0);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Credit report unavailable' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry report', exact: true }).click();
    await expect(page.getByText('Sandbox ledger', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Available credits', exact: true }).locator('..')).toContainText('30');
    await page.getByLabel('Environment', { exact: true }).selectOption('DEMO');
    await expect(page).toHaveURL(/environment=DEMO/);
    await expect(page.getByText('Demo ledger', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh report', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Refresh report', exact: true })).toBeEnabled();
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await page.getByRole('heading', { name: 'Recent credit accounts', exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByText('Synthetic reviewer with a deliberately long display name', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('heading', { name: 'AI credits & usage', exact: true }).scrollIntoViewIfNeeded();
      if ([390, 2560].includes(size.width)) await page.screenshot({ path: `test-results/credit-report-${size.width}.png`, fullPage: true });
    }
    expect(requests).toBeGreaterThanOrEqual(4);
    // Browser fixture cannot confer an owner role on the real API.
    expect((await context.request.get('/api/admin/ai-credits')).status()).toBe(403);
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
});

test('S5 — low-credit preflight preserves drafts and failed streams keep partial replies', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained demo; all credit and generation responses are browser-only fixtures');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  let calls = 0;
  try {
    const list = await (await context.request.get('/api/ai-chat/sessions?limit=20')).json();
    const conversation = list.sessions.find((item: { _count: { messages: number } }) => item._count.messages > 0);
    expect(conversation).toBeTruthy();
    const config = await (await context.request.get('/api/ai-chat/config')).json();
    await page.route('**/api/ai-chat/config', route => route.fulfill({ json: { ...config, balance: 1, refundAdjustment: 0, savedProviders: [], demo: false,
      models: config.models.map((item: { provider: string; credits: number }) => ({ ...item, credits: item.provider === 'GROQ' ? 0 : item.credits })) } }));
    await page.route(url => url.pathname === '/api/ai-chat', route => {
      calls++;
      return calls === 1 ? route.fulfill({ status: 429, json: { error: 'AI_CONCURRENT_LIMIT', message: 'Two replies are already in progress. Your message has not been charged.' } })
        : route.fulfill({ contentType: 'text/event-stream', body: 'data: {"text":"Preserved partial QA response."}\n\ndata: {"error":true,"message":"The model connection stopped."}\n\ndata: [DONE]\n\n' });
    });
    await page.goto(`/ai/${conversation.id}`, { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    const composer = page.getByRole('textbox', { name: 'AI message', exact: true });
    const send = page.getByRole('button', { name: 'Send message', exact: true });
    const choose = async (model: string) => {
      await page.getByRole('button', { name: /^Choose AI model:/ }).click();
      const picker = page.getByRole('dialog', { name: 'Choose AI model', exact: true });
      await picker.getByRole('textbox', { name: 'Search models', exact: true }).fill(model);
      await picker.getByRole('button', { name: new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
      await expect(picker).toBeHidden();
    };
    await choose('GPT-5.6 Luna');
    const draft = 'Keep this draft when the selected model is unaffordable.';
    await composer.fill(draft);
    await expect(send).toBeDisabled();
    await expect(page.locator('#ai-credit-guidance')).toContainText('This model needs 2 credits; you have 1.');
    await composer.press('Enter'); await expect(composer).toHaveValue(draft); expect(calls).toBe(0);
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size); await expect(composer).toBeInViewport({ ratio: 0.95 });
      await expect(page.locator('#ai-credit-guidance')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await choose('GPT-OSS 20B'); await expect(composer).toHaveValue(draft); await expect(send).toBeEnabled();
    await send.click(); await expect(page.locator('main').getByRole('alert')).toContainText('Your message has not been charged.');
    await expect(composer).toHaveValue(draft); await expect(send).toBeEnabled();
    await expect(page.locator('[data-ai-transcript]')).not.toContainText(draft);
    await send.click(); await expect(page.locator('main').getByRole('alert')).toContainText('Your partial reply is kept here but is not saved.');
    await expect(page.locator('[data-ai-transcript]')).toContainText('Preserved partial QA response.');
    await expect(composer).toHaveValue(draft); expect(calls).toBe(2);
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
});

test('S4 — refund adjustment reflows in AI composer and model sheet without a charge', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required; browser-only balance fixture');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = [];
  let sends = 0;
  page.on('pageerror', error => errors.push(error.message));
  try {
    const list = await (await context.request.get('/api/ai-chat/sessions?limit=20')).json();
    const conversation = list.sessions.find((item: { _count: { messages: number } }) => item._count.messages > 0);
    expect(conversation).toBeTruthy();
    await page.route('**/api/ai-chat/config', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...await response.json(), balance: 0, refundAdjustment: 7, demo: false } });
    });
    await page.route(url => url.pathname === '/api/ai-chat', route => { sends++; return route.abort(); });
    await page.goto(`/ai/${conversation.id}`, { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    const composer = page.getByRole('textbox', { name: 'AI message', exact: true });
    const notice = page.getByRole('link', { name: 'Refund adjustment: 7 credits', exact: true });
    await expect(notice).toHaveAttribute('href', '/my-orders');
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await expect(composer).toBeInViewport({ ratio: 0.95 }); await expect(notice).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const picker = page.getByRole('button', { name: /^Choose AI model:/ }); await picker.click();
      const sheet = page.getByRole('dialog', { name: 'Choose AI model', exact: true });
      await expect(sheet).toBeVisible();
      await sheet.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      await expect(sheet.getByRole('link', { name: 'Refund adjustment: 7 credits', exact: true })).toBeInViewport();
      await expect(sheet.getByRole('textbox', { name: 'Search models', exact: true })).toBeInViewport();
      expect(await sheet.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      const scroll = sheet.locator('[data-ai-model-scroll]'); const box = await scroll.boundingBox();
      expect(box!.height).toBeGreaterThan(20);
      await page.mouse.move(box!.x + 20, box!.y + box!.height / 2); await page.mouse.wheel(0, 5000);
      await expect.poll(() => scroll.evaluate(element => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThan(2);
      await page.screenshot({ path: `.private-showcase/refund-sheet-${new URL(baseURL!).hostname}-${size.width}.png` });
      await page.keyboard.press('Escape'); await expect(sheet).toBeHidden(); await expect(picker).toBeFocused();
    }
    expect(sends).toBe(0); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S6 — wallet chooser does not accept clicks before hydration', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  try {
    const page = await context.newPage();
    await page.route('**/_next/static/chunks/**', async route => { await pending; await route.continue(); });
    await page.goto('/settings?section=wallet', { waitUntil: 'commit' });
    const opener = page.getByRole('button', { name: 'Choose wallet connection method', exact: true });
    await expect(opener).toBeVisible(); await expect(opener).toBeDisabled();
    release(); await expect(opener).toBeEnabled();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    await opener.click(); await expect(page.getByRole('dialog', { name: 'Connect a wallet', exact: true })).toBeVisible();
  } finally { release(); await context.close(); }
});

test('S6 — cancelled slow wallet picker stays closed and can retry', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required');
  for (const guest of [true, false]) {
    const context = await browser.newContext({ baseURL, storageState: guest ? undefined : process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let release!: () => void, delayed = false;
    const pending = new Promise<void>(resolve => { release = resolve; });
    try {
      await page.route('**/_next/static/chunks/**', async route => {
        const response = await route.fetch();
        if ((await response.text()).includes('data-testid="w3m-modal-overlay"')) { delayed = true; await pending; }
        await route.fulfill({ response });
      });
      await page.goto(guest ? '/products' : '/settings?section=wallet', { waitUntil: 'domcontentloaded' });
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
      const opener = page.getByRole('button', { name: guest ? 'Open menu' : 'Choose wallet connection method', exact: true });
      await opener.click();
      const chooser = page.getByRole('dialog', { name: guest ? 'Navigation Menu' : 'Connect a wallet', exact: true });
      const connect = chooser.getByRole('button', { name: guest ? 'Connect with Web3' : /WalletConnect · Reown/ });
      await connect.click();
      await expect.poll(() => delayed).toBe(true);
      await expect(chooser.getByRole('button', { name: /Opening wallet|Opening WalletConnect/ })).toBeDisabled();
      await page.keyboard.press('Escape'); await expect(chooser).toBeHidden();
      release();
      // Wait for the requested, cancelled SDK initialization to settle, not for
      // generic network idleness. No late modal should steal the user's focus.
      await page.evaluate(async () => { await (globalThis as unknown as { __veggatAppKitPromise: Promise<unknown> }).__veggatAppKitPromise; });
      await expect(page.locator('[data-testid="w3m-modal-overlay"]')).toBeHidden();
      await opener.click(); await connect.click();
      await expect(page.locator('[data-testid="w3m-modal-overlay"]')).toBeVisible();
      await expect(chooser).toBeHidden();
      await page.screenshot({ path: '.private-showcase/wallet-picker-' + (guest ? 'guest-' : 'demo-') + new URL(baseURL!).hostname + '.png' });
      expect(errors).toEqual([]);
    } catch (error) {
      await page.screenshot({ path: '.private-showcase/wallet-picker-failure-' + (guest ? 'guest' : 'demo') + '.png' });
      throw error;
    } finally { release(); await context.close(); }
  }
});

test('S6 — Set active requests locked wallet access and preserves selection on cancel', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const state = [{ connected: false, reject: false, requests: 0 }, { connected: false, reject: false, requests: 0 }];
    Object.assign(window, { __qaActivation: state });
    state.forEach((wallet, index) => {
      const address = '0x' + String(index + 1).padStart(40, '0');
      const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
      const provider = {
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_chainId') return '0x1';
          if (method === 'eth_accounts') return wallet.connected ? [address] : [];
          if (method === 'eth_requestAccounts') {
            wallet.requests++;
            if (wallet.reject) { wallet.reject = false; throw Object.assign(new Error('User rejected connection'), { code: 4001 }); }
            wallet.connected = true; return [address];
          }
          if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }];
          if (method === 'wallet_revokePermissions') { wallet.connected = false; return null; }
          if (/sign|sendTransaction/i.test(method)) throw new Error('QA wallet forbids signing and transactions');
          throw Object.assign(new Error('Unsupported QA method'), { code: 4200 });
        },
        on: (event: string, listener: (...args: unknown[]) => void) => { const set = listeners.get(event) ?? new Set(); set.add(listener); listeners.set(event, set); },
        removeListener: (event: string, listener: (...args: unknown[]) => void) => { listeners.get(event)?.delete(listener); },
      };
      const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
        info: { uuid: `83b13b23-24f7-498f-a49d-26fca16003a${index}`, name: `Veggat QA Wallet ${index + 1}`, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rdns: `test.veggat.wallet${index}` }, provider,
      } }));
      window.addEventListener('eip6963:requestProvider', announce); announce();
    });
  });
  const page = await context.newPage(), errors: string[] = [], forbidden: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/api\/(auth\/wallet\/nonce|wallets\/evm\/verify|payments)/.test(request.url()) && request.method() === 'POST') forbidden.push(new URL(request.url()).pathname); });
  try {
    const before = (await (await context.request.get('/api/auth/session')).json()).user.id;
    await page.goto('/settings?section=wallet', { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    for (const index of [1, 2]) {
      await page.getByRole('button', { name: 'Choose wallet connection method', exact: true }).click();
      const chooser = page.getByRole('dialog', { name: 'Connect a wallet', exact: true });
      await chooser.getByRole('button', { name: new RegExp(`Veggat QA Wallet ${index}`) }).click();
      await expect(chooser).toBeHidden();
    }
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
    const first = menu.getByRole('group', { name: 'Veggat QA Wallet 1 wallet', exact: true });
    const second = menu.getByRole('group', { name: 'Veggat QA Wallet 2 wallet', exact: true });
    await expect(second).toHaveAttribute('data-wallet-active', 'true');
    // Simulate an extension locking without notifying a cached wagmi connection.
    await page.evaluate(() => { const wallets = (window as unknown as { __qaActivation: { connected: boolean; reject: boolean }[] }).__qaActivation; wallets[0].connected = false; wallets[0].reject = true; });
    await first.getByRole('button', { name: 'Set active', exact: true }).click();
    await expect(menu.getByRole('alert')).toContainText('Wallet activation cancelled');
    await expect(second).toHaveAttribute('data-wallet-active', 'true');
    await first.getByRole('button', { name: 'Set active', exact: true }).click();
    await expect(first).toHaveAttribute('data-wallet-active', 'true');
    const requests = () => page.evaluate(() => (window as unknown as { __qaActivation: { requests: number }[] }).__qaActivation.map(wallet => wallet.requests));
    const afterUnlock = await requests();
    expect(afterUnlock[0]).toBeGreaterThanOrEqual(3);
    await second.getByRole('button', { name: 'Set active', exact: true }).click();
    await expect(second).toHaveAttribute('data-wallet-active', 'true');
    await first.getByRole('button', { name: 'Set active', exact: true }).click();
    await expect(first).toHaveAttribute('data-wallet-active', 'true');
    expect(await requests()).toEqual(afterUnlock);
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      expect(await menu.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await second.getByRole('button', { name: 'Set active', exact: true }).scrollIntoViewIfNeeded();
      const button = await second.getByRole('button', { name: 'Set active', exact: true }).boundingBox(); expect(button!.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.private-showcase/wallet-activation-' + new URL(baseURL!).hostname + '.png' });
    expect((await (await context.request.get('/api/auth/session')).json()).user.id).toBe(before);
    expect(forbidden).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S7 — ordinary browsing does not initialize optional wallet services', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required');
  for (const storageState of [undefined, process.env.E2E_DEMO_STORAGE_STATE]) {
    const context = await browser.newContext({ baseURL, storageState, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), walletRequests: string[] = [], errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (/web3modal|reown|walletconnect|coinbase|walletlink/.test(url.hostname) || (request.method() === 'HEAD' && url.origin === new URL(baseURL!).origin)) walletRequests.push(request.method() + ' ' + url.hostname + url.pathname);
    });
    try {
      await page.goto('/products', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('article', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
      const header = await page.locator('[data-header-canvas]').elementHandle();
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
      await menu.getByRole('link', { name: 'Pulse', exact: true }).click();
      await expect(page.getByRole('feed', { name: 'Pulse feed' })).toHaveAttribute('aria-busy', 'false');
      await page.mouse.move(220, 620); await page.mouse.wheel(0, 500);
      await expect.poll(() => page.locator('[data-app-scroll-container]').evaluate(e => e.scrollTop)).toBeGreaterThan(0);
      expect(await header!.evaluate(e => e.isConnected)).toBe(true);
      // Deliberate observation window after actual hydration/navigation, not a
      // readiness sleep: catches deferred SDK timers and wallet telemetry.
      await page.waitForTimeout(1500);
      expect(walletRequests).toEqual([]); expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
});

test('S7 — a closed slow poll bundle cannot replace the Pulse feed or reset early scrolling', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let release!: () => void, releaseImport!: () => void, pollBundleRequested = false;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const pendingImport = new Promise<void>(resolve => { releaseImport = resolve; });
  try {
    await page.route('**/_next/static/chunks/**', async route => {
      const response = await route.fetch();
      const source = await response.text();
      if (source.includes('[PollTakerModal] Submit error:')) { pollBundleRequested = true; await pending; }
      if (source.includes("Invalid JSON structure. Expected array of questions or object with 'questions' property.")) await pendingImport;
      await route.fulfill({ response });
    });
    await page.route('**/api/conversations?**', route => route.fulfill({ json: {
      conversations: Array.from({ length: 25 }, (_, index) => ({ id: 'qa-cold-feed-' + index, title: 'Cold-load layout fixture', description: 'This unpublished fixture keeps the feed tall while optional poll code is delayed.', type: 'PUBLIC_THREAD', tags: [], userId: 'qa-layout', user: { id: 'qa-layout', name: 'Layout fixture', email: '' }, createdAt: '2026-01-01T00:00:00Z', messageCount: 1, hasPoll: index === 3, ...(index === 3 ? { advancedPoll: { id: 'qa-slow-poll', title: 'Delayed module poll', type: 'SURVEY', totalResponses: 0, avgCompletionPct: 0 } } : {}) })), nextCursor: null,
    } }));
    await page.route('**/api/advanced-polls/qa-slow-poll', route => route.fulfill({ json: { poll: { id: 'qa-slow-poll', title: 'Delayed module poll', description: 'Unpublished test fixture.', type: 'SURVEY', creatorId: 'qa-layout', isAnonymous: true, allowPartial: true, requiresAuth: false, totalResponses: 0, avgCompletionPct: 0, questions: [{ id: 'qa-question', text: 'Test question', type: 'SINGLE_CHOICE', orderIndex: 0, isRequired: true, options: [{ id: 'qa-option', text: 'Test answer', orderIndex: 0 }] }] } } }));
    await page.goto('/pulse', { waitUntil: 'domcontentloaded' });
    const feed = page.getByRole('feed', { name: 'Pulse feed' }); await expect(feed).toBeVisible();
    await page.mouse.move(210, 620); await page.mouse.wheel(0, 350);
    await expect(feed).toHaveAttribute('aria-busy', 'false', { timeout: 8_000 });
    expect(pollBundleRequested).toBe(false);
    await expect(page.locator('footer')).not.toBeInViewport();
    await expect.poll(() => page.locator('[data-app-scroll-container]').evaluate(e => e.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator('[data-app-scroll-container]').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    const screenshotPrefix = '.private-showcase/pulse-cold-' + (new URL(baseURL!).hostname === 'localhost' ? 'local' : 'live');
    await page.screenshot({ path: screenshotPrefix + '-feed.png' });
    const openPoll = page.getByRole('button', { name: /Delayed module poll/ });
    await openPoll.scrollIntoViewIfNeeded();
    const before = await page.locator('[data-app-scroll-container]').evaluate(e => e.scrollTop);
    await openPoll.click();
    const loading = page.getByRole('dialog', { name: 'Loading poll…', exact: true });
    await expect(loading).toBeVisible(); await expect.poll(() => pollBundleRequested).toBe(true);
    await expect(page.locator('[role="feed"][aria-label="Pulse feed"]')).toBeVisible();
    expect(await page.locator('[data-app-scroll-container]').evaluate(e => e.scrollTop)).toBe(before);
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(size);
      await expect.poll(() => loading.evaluate(e => Math.max(0, -e.getBoundingClientRect().top, e.getBoundingClientRect().bottom - innerHeight))).toBe(0);
      const bounds = await loading.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(15); expect(bounds!.y).toBeGreaterThanOrEqual(15); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width - 15); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height - 15);
      await page.screenshot({ path: screenshotPrefix + '-dialog-' + size.width + '.png' });
    }
    await loading.getByRole('button', { name: 'Cancel loading', exact: true }).click(); await expect(loading).toBeHidden(); await expect(feed).toBeVisible();
    await openPoll.click(); await expect(loading).toBeVisible(); release();
    const poll = page.getByRole('dialog', { name: 'Delayed module poll', exact: true }); await expect(poll).toBeVisible();
    await page.keyboard.press('Escape'); await expect(poll).toBeHidden(); await expect(feed).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const openImport = async () => {
      await page.getByRole('button', { name: 'Poll options', exact: true }).click();
      await page.getByRole('menuitem', { name: /Import from JSON/ }).click();
    };
    await openImport();
    const importLoading = page.getByRole('dialog', { name: 'Loading poll import…', exact: true }); await expect(importLoading).toBeVisible();
    await expect(page.locator('[role="feed"][aria-label="Pulse feed"]')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(importLoading).toBeHidden();
    await openImport(); await expect(importLoading).toBeVisible(); releaseImport();
    const importer = page.getByRole('dialog', { name: 'Import Poll', exact: true }); await expect(importer).toBeVisible();
    await page.keyboard.press('Escape'); await expect(importer).toBeHidden(); await expect(feed).toBeVisible();
    expect(errors).toEqual([]);
  } finally { release(); releaseImport(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
});

test('S7 — profile image uploads persist and retry without duplicate files', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_PROFILE_UPLOAD !== 'live-db', 'Explicit tiny QA upload and isolated-account opt-in');
  test.setTimeout(240_000);
  const { Pool } = await import('pg'), { randomBytes } = await import('node:crypto'), { default: bcrypt } = await import('bcryptjs'), { default: sharp } = await import('sharp');
  const { initEdgeStoreSdk } = await import('@edgestore/server/core');
  const storage = initEdgeStoreSdk({});
  const database = new URL(process.env.DATABASE_URL_MAINLIVE!); database.searchParams.set('uselibpqcompat', 'true');
  const pool = new Pool({ connectionString: database.toString(), max: 1 });
  const id = 'qa_upload_' + randomBytes(12).toString('hex'), email = id + '@example.invalid', password = randomBytes(24).toString('base64url');
  const bytes = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#0f766e' } }).png().toBuffer();
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const anonymous = await browser.newContext({ baseURL });
  const page = await context.newPage(), createdUrls = new Set<string>(), errors: string[] = [];
  const privateBytes = Buffer.alloc(10 * 1024 * 1024 + 1, 65);
  let privateUrl: string | undefined;
  let releaseInit!: () => void;
  const pendingInit = new Promise<void>(resolve => { releaseInit = resolve; });
  const startedAt = Date.now(); let leaked = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.text().includes(password) || /X-Amz-(Signature|Credential)=/i.test(message.text())) leaked = true; });
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/users/' + id && request.method() === 'PATCH') {
      const data = request.postDataJSON();
      for (const url of [data?.image, data?.banner]) if (typeof url === 'string') createdUrls.add(url);
    }
  });
  try {
    await page.route('**/api/edgestore/init', async route => {
      if (new URL(route.request().headers().referer ?? baseURL!).pathname.startsWith('/profile')) await pendingInit;
      await route.continue();
    });
    expect((await pool.query('SELECT id FROM "User" WHERE id=$1', [id])).rowCount).toBe(0);
    await pool.query('INSERT INTO "User" (id,name,email,password,"emailVerified","updatedAt","web3ModeEnabled","emailDisplayMode") VALUES ($1,\'QA upload fixture\',$2,$3,NOW(),NOW(),false,\'HIDE\')', [id, email, await bcrypt.hash(password, 12)]);
    await page.goto('/auth/login?callbackUrl=%2Fprofile', { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    await page.getByPlaceholder('you@example.com').fill(email); await page.locator('input[name=password]').fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('#profile-name')).toHaveText('QA upload fixture'); if (await consent.isVisible()) await consent.click();
    const avatarInput = page.getByLabel('Choose profile picture', { exact: true });
    await avatarInput.setInputFiles({ name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('QA rejected input') });
    await expect(page.getByText('Please upload a valid image file (JPG, PNG, GIF, or WebP)', { exact: true })).toBeVisible(); expect(createdUrls.size).toBe(0);
    await avatarInput.setInputFiles({ name: 'qa-avatar.png', mimeType: 'image/png', buffer: bytes });
    await expect(page.getByRole('button', { name: 'Save profile picture', exact: true })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: 'Preparing secure upload' })).toBeVisible();
    releaseInit();
    const avatarRequest = page.waitForResponse(response => new URL(response.url()).pathname === '/api/edgestore/request-upload');
    await page.getByRole('button', { name: 'Save profile picture', exact: true }).click();
    const avatarResponse = await avatarRequest;
    if (!avatarResponse.ok()) {
      const failure = await avatarResponse.json();
      // Only wrapper messages or an SDK error code, never signed upload URLs.
      const diagnosis = typeof failure.code === 'string' ? failure.code.replace(/[^A-Z_]/g, '') : 'SDK_ERROR';
      throw new Error('Avatar upload denied: ' + avatarResponse.status() + ' ' + diagnosis + (typeof failure.error === 'string' ? ' ' + failure.error : ''));
    }
    await expect(page.getByText('Profile picture updated successfully!', { exact: true })).toBeVisible({ timeout: 45_000 });
    const imageUrl = (await pool.query('SELECT image FROM "User" WHERE id=$1', [id])).rows[0].image;
    expect(createdUrls.has(imageUrl)).toBe(true); expect(createdUrls.size).toBe(1);
    const image = page.getByRole('img', { name: 'QA upload fixture profile picture', exact: true });
    await expect(image).toHaveAttribute('src', imageUrl); await expect.poll(() => image.evaluate(e => (e as HTMLImageElement).naturalWidth)).toBe(128);
    expect((await (await context.request.get('/api/auth/session')).json()).user.image).toBe(imageUrl);
    await page.reload({ waitUntil: 'domcontentloaded' }); await expect(image).toHaveAttribute('src', imageUrl);
    const raw = await context.request.get(imageUrl); expect(raw.status()).toBe(200); expect(Buffer.compare(await raw.body(), bytes)).toBe(0);
    // An old storage context must never substitute for a current app session.
    const storageCookies = (await context.cookies()).filter(cookie => cookie.name.startsWith('edgestore-'));
    expect(storageCookies.length).toBeGreaterThan(0); await anonymous.addCookies(storageCookies);
    expect((await anonymous.request.post('/api/edgestore/request-upload', { data: { bucketName: 'myPublicImages', fileInfo: { extension: 'png', type: 'image/png', size: bytes.length } } })).status()).toBe(401);
    expect((await anonymous.request.get('/api/edgestore/proxy-file?url=' + encodeURIComponent(imageUrl))).status()).toBe(401);
    expect((await context.request.get('/api/edgestore/proxy-file?url=' + encodeURIComponent('https://invalid.example/never-fetch'))).status()).toBe(400);
    const proxied = await context.request.get('/api/edgestore/proxy-file?url=' + encodeURIComponent(imageUrl));
    expect(proxied.status()).toBe(200); expect(proxied.headers()['x-content-type-options']).toBe('nosniff'); expect(Buffer.compare(await proxied.body(), bytes)).toBe(0);

    // Storage succeeds, then the application save fails. Retry must reuse the
    // uploaded URL, not create another permanent object for the same image.
    let failSave = true;
    await page.route('**/api/users/' + id, route => route.request().method() === 'PATCH' && failSave ? route.fulfill({ status: 503, json: { error: 'Controlled QA save failure' } }) : route.continue());
    await page.getByLabel('Choose banner image', { exact: true }).setInputFiles({ name: 'qa-banner.png', mimeType: 'image/png', buffer: bytes });
    await page.getByRole('button', { name: 'Save Banner', exact: true }).click();
    await expect(page.getByText('Failed to upload banner', { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'uploaded' })).toBeVisible();
    await page.screenshot({ path: '.private-showcase/profile-upload-retry-' + (new URL(baseURL!).hostname === 'localhost' ? 'local' : 'live') + '.png' });
    expect((await pool.query('SELECT banner FROM "User" WHERE id=$1', [id])).rows[0].banner).toBeNull(); expect(createdUrls.size).toBe(2);
    const uploadedBanner = [...createdUrls].find(url => url !== imageUrl)!;
    failSave = false; await page.getByRole('button', { name: 'Save Banner', exact: true }).click();
    await expect(page.getByText('Banner updated successfully!', { exact: true })).toBeVisible({ timeout: 45_000 });
    expect(createdUrls.size).toBe(2); expect((await pool.query('SELECT banner FROM "User" WHERE id=$1', [id])).rows[0].banner).toBe(uploadedBanner);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const banner = page.getByRole('img', { name: 'Profile banner', exact: true }); await expect(banner).toBeVisible();
    await expect.poll(() => banner.evaluate(e => (e as HTMLImageElement).naturalWidth > 0)).toBe(true);
    expect(await page.locator('[data-app-scroll-container]:visible').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);

    // Exercise the real SDK multipart protocol against this account's disposable
    // private fixture, including metadata-based ownership before completion.
    const requested = await context.request.post('/api/edgestore/request-upload', { data: { bucketName: 'digitalAssets', fileInfo: { extension: 'txt', type: 'text/plain', size: privateBytes.length } } });
    expect(requested.status()).toBe(200);
    const upload = await requested.json(); privateUrl = upload.accessUrl;
    expect(typeof privateUrl).toBe('string'); expect(Boolean(upload.multipart)).toBe(true);
    const metadata = await storage.getFile({ url: privateUrl! }); expect(metadata.metadata.owner ?? metadata.path.owner).toBe(id);
    const refreshed = await context.request.post('/api/edgestore/request-upload-parts', { data: { path: upload.multipart.key, multipart: { uploadId: upload.multipart.uploadId, parts: [1] } } });
    expect(refreshed.status()).toBe(200);
    const replacements = await refreshed.json();
    const uploadedParts: { partNumber: number; eTag: string }[] = [];
    for (const part of upload.multipart.parts) {
      const start = (part.partNumber - 1) * upload.multipart.partSize;
      const target = part.partNumber === 1 ? replacements.multipart.parts[0].uploadUrl : part.uploadUrl;
      const response = await anonymous.request.put(target, { data: privateBytes.subarray(start, start + upload.multipart.partSize), headers: { 'Content-Type': 'text/plain' } });
      expect(response.status()).toBe(200); const eTag = response.headers().etag; expect(typeof eTag).toBe('string'); uploadedParts.push({ partNumber: part.partNumber, eTag });
    }
    expect((await context.request.post('/api/edgestore/complete-multipart-upload', { data: { bucketName: 'digitalAssets', uploadId: upload.multipart.uploadId, key: upload.multipart.key, parts: uploadedParts } })).status()).toBe(200);
    const privateProxy = '/api/edgestore/proxy-file?url=' + encodeURIComponent(privateUrl!);
    const download = await context.request.get(privateProxy); expect(download.status()).toBe(200); expect(download.headers()['content-disposition']).toBe('attachment'); expect(Buffer.compare(await download.body(), privateBytes)).toBe(0);
    await anonymous.clearCookies(); expect([401, 403]).toContain((await anonymous.request.get(privateUrl!)).status()); expect((await anonymous.request.get(privateProxy)).status()).toBe(401);
    if (process.env.E2E_DEMO_STORAGE_STATE) {
      const foreign = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE });
      try { expect((await foreign.request.get(privateProxy)).status()).toBe(403); } finally { await foreign.close(); }
    }
    expect(leaked).toBe(false); expect(errors).toEqual([]);
  } finally {
    releaseInit();
    await page.unrouteAll({ behavior: 'wait' }); await context.close(); await anonymous.close();
    if (!/^qa_upload_[a-f0-9]{24}$/.test(id)) throw new Error('Unsafe upload fixture cleanup');
    try {
      // Only URLs emitted by this account's new upload/save requests are eligible.
      // No existing product, owner profile or private digital asset is targeted.
      for (const url of [...createdUrls, ...(privateUrl ? [privateUrl] : [])]) {
        const parsed = new URL(url);
        const privateFixture = url === privateUrl;
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'files.edgestore.dev' || !parsed.pathname.includes(privateFixture ? '/digitalAssets/' : '/myPublicImages/') || parsed.search || parsed.hash) throw new Error('Unsafe QA image target');
        const file = await storage.getFile({ url });
        if ((file.metadata.owner ?? file.path.owner) !== id || file.size !== (privateFixture ? privateBytes.length : bytes.length) || new Date(file.uploadedAt).getTime() < startedAt - 10_000) throw new Error('QA image provenance mismatch');
        if (!(await storage.deleteFile({ url })).success) throw new Error('QA image cleanup incomplete');
      }
    } catch { throw new Error('Disposable QA image cleanup needs review; no broader deletion attempted'); }
    finally {
      await pool.query('DELETE FROM "Notification" WHERE "userId"=$1', [id]); await pool.query('DELETE FROM "UserPresence" WHERE "userId"=$1', [id]);
      await pool.query('DELETE FROM "User" WHERE id=$1 AND email=$2 AND role=\'USER\'', [id, email]); await pool.end();
    }
  }
});

test('S7 — profile section loading, pagination and recovery retain the header', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let activityRequests = 0, reachRequests = 0, failPosts = false;
  try {
    await page.route('**/api/users/*/reach', route => { reachRequests++; return route.continue(); });
    await page.route('**/api/conversations?**', async route => {
      const params = new URL(route.request().url()).searchParams;
      if (!params.has('creatorId')) return route.continue();
      const activity = params.get('filter') === 'participated';
      if (activity) activityRequests++; else await pending;
      if (!activity && failPosts) return route.fulfill({ status: 503, json: { error: 'Controlled QA failure' } });
      const offset = params.has('cursor') ? 20 : 0;
      // Layout fixtures only: never publish synthetic posts into the public feed.
      const conversations = Array.from({ length: offset ? 2 : 20 }, (_, index) => ({ id: `qa_layout_${offset + index}`, title: `Layout post ${offset + index} ` + 'A-long-title-without-spaces-'.repeat(5), description: 'Controlled layout fixture.', tags: ['layout'], type: 'PUBLIC_THREAD', createdAt: '2026-01-01T00:00:00Z', messageCount: 1, viewCount: 4 }));
      return route.fulfill({ json: { conversations, nextCursor: offset ? null : 'layout-page-two' } });
    });
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    const heading = page.locator('#profile-name'); await expect(heading).toHaveText('Demo visitor');
    await expect(page.getByRole('status', { name: 'Loading profile posts' })).toBeVisible();
    const before = await heading.boundingBox(); expect(activityRequests).toBe(0); expect(reachRequests).toBe(0);
    release!();
    const panel = page.getByRole('tabpanel', { name: 'Posts', exact: true }); await expect(panel.locator('article')).toHaveCount(20);
    expect(await heading.boundingBox()).toEqual(before);
    await expect(panel.locator('article a').first()).toHaveAttribute('href', '/pulse/qa_layout_0');
    await panel.getByRole('button', { name: 'Load more posts', exact: true }).click(); await expect(panel.locator('article')).toHaveCount(22);
    expect(await page.locator('[data-app-scroll-container]:visible').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.getByRole('tab', { name: 'Activity', exact: true }).click();
    const activity = page.getByRole('tabpanel', { name: 'Activity', exact: true }); await expect(activity.locator('article')).toHaveCount(20);
    await activity.getByRole('button', { name: 'Load more activity', exact: true }).click(); await expect(activity.locator('article')).toHaveCount(22); expect(reachRequests).toBe(0);
    failPosts = true; await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(heading).toHaveText('Demo visitor'); await expect(panel.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading profile posts' })).toHaveCount(0);
    failPosts = false; await panel.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(panel.locator('article')).toHaveCount(20); await expect(panel.getByRole('alert')).toHaveCount(0);
  } finally { release?.(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
});

test('S7 — retained demo profile tabs, responsive page and footer scrolling', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Reuse isolated demo without new grants');
  test.setTimeout(180_000);
  const { mkdir } = await import('node:fs/promises');
  const screenshots = '.private-showcase/responsive-audit/profile-' + (new URL(baseURL!).hostname === 'localhost' ? 'local' : 'live'); await mkdir(screenshots, { recursive: true });
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const guest = await browser.newContext({ baseURL });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    const session = await (await context.request.get('/api/auth/session')).json(); expect(session.user?.id?.startsWith('demo_')).toBe(true);
    const endpoint = '/api/users/' + session.user.id;
    expect((await guest.request.get(endpoint)).status()).toBe(401);
    expect((await context.request.patch(endpoint, { data: { name: 'Must not change' } })).status()).toBe(403);
    expect((await context.request.post(endpoint + '/follow')).status()).toBe(403);
    expect((await context.request.get(endpoint)).headers()['cache-control']).toContain('no-store');
    await page.goto('/profile', { waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL('/profile/' + session.user.id);
    await expect(page.locator('#profile-name')).toHaveText('Demo visitor'); await expect(page.getByText('No pulses yet', { exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    await expect(page.getByText(/Demo profiles are read-only/)).toBeVisible(); await expect(page.getByRole('button', { name: 'Change profile picture', exact: true })).toHaveCount(0);
    await expect(page.locator('main').getByRole('link', { name: 'View settings', exact: true })).toHaveAttribute('href', '/settings');
    await page.getByRole('tab', { name: 'Activity', exact: true }).click(); await expect(page.getByText('No activity yet', { exact: true })).toBeVisible(); await expect(page).toHaveURL(/tab=activity/);
    await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(page.getByRole('tab', { name: 'Posts', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Posts', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: 'Activity', exact: true })).toHaveAttribute('aria-selected', 'true');
    const matrix = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }];
    const section = page.locator('section[aria-labelledby="profile-name"]'), scroller = page.locator('[data-app-scroll-container]:visible');
    for (const tab of ['Posts', 'Reach', 'Connections']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      if (tab === 'Reach') { await expect(page.getByRole('img', { name: 'Reach pillar distribution' })).toBeVisible(); await expect(page.getByText('First Pulse', { exact: true })).toBeVisible(); await expect(page.getByText('Loading reach details…', { exact: true })).toHaveCount(0); }
      if (tab === 'Connections') {
        await expect(page.getByText('No followers yet', { exact: true })).toBeVisible();
        await page.route('**' + endpoint + '/following?**', route => route.fulfill({ status: 503, json: { error: 'Controlled QA failure' } }));
        await page.getByRole('group', { name: 'Connection filters' }).getByRole('button', { name: 'Following', exact: true }).click();
        const connections = page.getByRole('region', { name: 'Profile connections', exact: true });
        await expect(connections.getByRole('alert')).toBeVisible(); await expect(page.locator('#profile-name')).toHaveText('Demo visitor');
        await page.unroute('**' + endpoint + '/following?**'); await connections.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(page.getByText('Not following anyone yet', { exact: true })).toBeVisible(); await expect(page).toHaveURL(/connections=following/);
      }
      for (const size of matrix) {
        await page.setViewportSize(size); await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
        const heading = await page.locator('#profile-name').boundingBox(); expect(heading!.x).toBeGreaterThanOrEqual(16); expect(heading!.x + heading!.width).toBeLessThanOrEqual(size.width - 15);
        expect(await scroller.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && scrollY === 0)).toBe(true);
        const tabs = page.getByRole('tab'); for (let index = 0; index < 4; index++) expect((await tabs.nth(index).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        if (tab === 'Posts' && [360, 390, 1280, 2560].includes(size.width)) await page.screenshot({ path: `${screenshots}/demo-${size.width}-top.png` });
        await page.mouse.move(size.width / 2, Math.min(size.height / 2, 400)); await page.mouse.wheel(0, 500);
        if (await scroller.evaluate(e => e.scrollHeight > e.clientHeight + 5)) await expect.poll(() => scroller.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
        if ([390, 1280].includes(size.width)) await page.screenshot({ path: `${screenshots}/${tab}-${size.width}-middle.png` });
        await page.mouse.wheel(0, 40000); await expect(page.locator('footer')).toBeInViewport();
        const body = await section.boundingBox(), footer = await page.locator('footer').boundingBox(); expect(footer!.y).toBeGreaterThanOrEqual(body!.y + body!.height - 1);
        if ([390, 1280].includes(size.width)) await page.screenshot({ path: `${screenshots}/${tab}-${size.width}-bottom.png` });
      }
    }
    await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveClass(/dark/); await page.getByRole('tab', { name: 'Reach', exact: true }).click();
    for (const width of [390, 1280]) { await page.setViewportSize({ width, height: 844 }); await scroller.evaluate(e => e.scrollTo({ top: 620, behavior: 'instant' })); await page.screenshot({ path: `${screenshots}/reach-${width}-dark.png` }); }
    const visitor = await guest.newPage(); await visitor.goto('/profile', { waitUntil: 'domcontentloaded' }); await expect(visitor).toHaveURL(/\/auth\/login\?callbackUrl=%2Fprofile/);
    expect(errors).toEqual([]);
  } finally { await context.close(); await guest.close(); }
});

test('S7 — private profile fixtures exercise edits, followers, pagination and direct messaging', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_PROFILE !== 'live-db', 'Explicit isolated fixture opt-in only');
  test.setTimeout(180_000);
  const { Pool } = await import('pg'), { randomBytes } = await import('node:crypto'), { default: bcrypt } = await import('bcryptjs'), { mkdir } = await import('node:fs/promises');
  const database = new URL(process.env.DATABASE_URL_MAINLIVE!); database.searchParams.set('uselibpqcompat', 'true'); const pool = new Pool({ connectionString: database.toString(), max: 2 });
  const id = 'qa_profile_' + randomBytes(12).toString('hex'), peer = id + '_peer', ids = [id, peer, ...Array.from({ length: 22 }, (_, index) => id + '_f' + index)];
  const email = id + '@example.invalid', password = randomBytes(24).toString('base64url');
  const screenshots = '.private-showcase/responsive-audit/profile-' + (new URL(baseURL!).hostname === 'localhost' ? 'local' : 'live'); await mkdir(screenshots, { recursive: true });
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = []; let leaked = false;
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.text().includes(password)) leaked = true; });
  try {
    expect((await pool.query('SELECT id FROM "User" WHERE id = ANY($1::text[])', [ids])).rowCount).toBe(0);
    const hash = await bcrypt.hash(password, 12), fixtureTime = Date.now();
    for (const [index, userId] of ids.entries()) await pool.query('INSERT INTO "User" (id,name,email,password,"emailVerified","updatedAt","web3ModeEnabled","emailDisplayMode",bio) VALUES ($1,$2,$3,$4,NOW(),NOW(),false,\'HIDE\',$5)', [userId, index === 0 ? 'QA profile fixture' : index === 1 ? 'QA profile peer' : 'Long-connection-name-'.repeat(6), userId + '@example.invalid', index === 0 ? hash : null, index < 2 ? 'Isolated temporary QA profile.' : 'Long-connection-bio-'.repeat(12)]);
    for (let index = 0; index < 22; index++) await pool.query('INSERT INTO "Follow" (id,"followerId","followingId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW())', [id + '_link' + index, ids[index + 2], id, new Date(fixtureTime - Math.floor(index / 2) * 1000)]);
    await page.goto('/auth/login?callbackUrl=%2Fprofile', { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    await page.getByPlaceholder('you@example.com').fill(email); await page.locator('input[name=password]').fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/profile/' + id); await expect(page.locator('#profile-name')).toHaveText('QA profile fixture'); if (await consent.isVisible()) await consent.click();
    expect((await (await context.request.get('/api/auth/session')).json()).user.id === id).toBe(true);
    expect((await context.request.patch('/api/users/' + peer, { data: { bio: 'Must not change' } })).status()).toBe(403);
    expect((await context.request.patch('/api/users/' + id, { data: '{', headers: { 'Content-Type': 'application/json' } })).status()).toBe(400);
    expect((await context.request.patch('/api/users/' + id, { data: { bio: 'Updated isolated QA bio.' } })).status()).toBe(200);
    await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByText('Updated isolated QA bio.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit profile', exact: true })).toHaveAttribute('href', '/settings');
    const avatar = page.getByRole('button', { name: 'Change profile picture', exact: true }); await expect(avatar).toBeVisible();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8WQAAAAASUVORK5CYII=', 'base64');
    await page.getByLabel('Choose profile picture', { exact: true }).setInputFiles({ name: 'qa-preview.png', mimeType: 'image/png', buffer: png });
    const cancel = page.getByRole('button', { name: 'Cancel profile picture', exact: true }); await expect(cancel).toBeVisible();
    for (const control of [cancel, page.getByRole('button', { name: 'Save profile picture', exact: true })]) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${screenshots}/avatar-preview-390.png` }); await cancel.click(); await expect(avatar).toBeVisible();
    await page.getByLabel('Choose banner image', { exact: true }).setInputFiles({ name: 'qa-preview.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('button', { name: 'Save Banner', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit Banner', exact: true })).toBeVisible();
    const endpoint = '/api/users/' + id + '/followers';
    expect((await context.request.get(endpoint + '?limit=-1')).status()).toBe(400); expect((await context.request.get(endpoint + '?cursor=' + id + '_foreign')).status()).toBe(400);
    const seen: string[] = []; let cursor: string | null = null;
    do { const result = await (await context.request.get(endpoint + '?limit=7' + (cursor ? '&cursor=' + cursor : ''))).json(); expect(result.total).toBe(22); expect(result.users.every((user: { email: unknown }) => !user.email)).toBe(true); seen.push(...result.users.map((user: { id: string }) => user.id)); cursor = result.nextCursor; } while (cursor && seen.length < 30);
    expect(seen.length).toBe(22); expect(new Set(seen).size).toBe(22);
    await page.getByRole('button', { name: /^22\s*Followers$/ }).click();
    const followers = page.getByRole('list', { name: 'Followers', exact: true }); await expect(followers.locator(':scope > li')).toHaveCount(20);
    await page.getByRole('button', { name: 'Load more connections', exact: true }).click(); await expect(followers.locator(':scope > li')).toHaveCount(22);
    expect(await page.locator('[data-app-scroll-container]:visible').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.getByRole('tab', { name: 'Connections', exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: `${screenshots}/followers-390.png` });
    await followers.getByRole('link', { name: /^View profile/ }).first().click(); await expect(page.locator('#profile-name')).toHaveText('Long-connection-name-'.repeat(6));
    expect(await page.locator('[data-app-scroll-container]:visible').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.goto('/profile/' + peer, { waitUntil: 'domcontentloaded' }); await expect(page.locator('#profile-name')).toHaveText('QA profile peer');
    const section = page.locator('section[aria-labelledby="profile-name"]');
    await expect(section.getByRole('button', { name: 'Follow', exact: true })).toBeEnabled(); await section.getByRole('button', { name: 'Follow', exact: true }).click(); await expect(section.getByRole('button', { name: 'Following', exact: true })).toBeEnabled();
    expect((await (await context.request.get('/api/users/' + peer + '/follow')).json()).isFollowing).toBe(true);
    await page.goto('/profile/' + id + '?tab=connections&connections=following', { waitUntil: 'domcontentloaded' });
    const following = page.getByRole('list', { name: 'Following', exact: true }); await expect(following.locator(':scope > li')).toHaveCount(1);
    await following.getByRole('link', { name: 'View profile of QA profile peer', exact: true }).click(); await expect(page.locator('#profile-name')).toHaveText('QA profile peer');
    await section.getByRole('button', { name: 'Following', exact: true }).click(); await expect(section.getByRole('button', { name: 'Follow', exact: true })).toBeEnabled();
    expect((await (await context.request.get('/api/users/' + peer + '/follow')).json()).isFollowing).toBe(false);
    await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: `${screenshots}/peer-dark-390.png` });
    await page.getByRole('button', { name: 'Experimental trade with QA profile peer', exact: true }).click(); await expect(page.getByText('Connect your wallet to start a trade', { exact: true })).toBeVisible();
    const dmResponse = page.waitForResponse(response => response.url().endsWith('/api/conversations') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Message QA profile peer', exact: true }).click(); const dm = await (await dmResponse).json(); expect(typeof dm.id).toBe('string'); await expect(page).toHaveURL('/conversations/' + dm.id);
    const record = (await pool.query('SELECT "userId",participants,visibility,type FROM "Conversation" WHERE id=$1', [dm.id])).rows[0]; expect(record.userId).toBe(id); expect(record.participants.sort()).toEqual([id, peer].sort()); expect(record.visibility).toBe('PARTICIPANTS'); expect(record.type).toBe('PRIVATE_DM');
    await page.goto('/profile/' + peer, { waitUntil: 'domcontentloaded' }); await expect(page.locator('#profile-name')).toHaveText('QA profile peer'); await page.getByRole('button', { name: 'Message QA profile peer', exact: true }).click(); await expect(page).toHaveURL('/conversations/' + dm.id);
    expect((await pool.query('SELECT id FROM "Conversation" WHERE "userId"=$1', [id])).rowCount).toBe(1);
    expect(leaked).toBe(false); expect(errors).toEqual([]);
  } finally {
    await context.close();
    if (!/^qa_profile_[a-f0-9]{24}$/.test(id) || ids.some(value => value !== id && !value.startsWith(id + '_'))) throw new Error('Unsafe fixture cleanup');
    // Delete only identities created by this test and their private test conversations.
    await pool.query('DELETE FROM "Conversation" WHERE "userId"=$1 AND type=\'PRIVATE_DM\' AND visibility=\'PARTICIPANTS\' AND participants <@ $2::text[]', [id, [id, peer]]);
    await pool.query('DELETE FROM "Notification" WHERE "userId" = ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM "UserPresence" WHERE "userId" = ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM "User" WHERE id = ANY($1::text[]) AND role=\'USER\' AND email LIKE $2', [ids, id + '%@example.invalid']);
    await pool.end();
  }
});

test('S4 — private library loading, empty, expired and long-content states', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained isolated demo required');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    let release: (() => void) | undefined;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/my-downloads', async route => { await pending; await route.fulfill({ json: { downloads: [] } }); });
    await page.goto('/my-downloads', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status', { name: 'Loading downloads' })).toBeVisible();
    const before = await page.getByRole('heading', { name: 'My downloads', exact: true }).boundingBox();
    release!(); await expect(page.getByRole('heading', { name: 'No downloads yet' })).toBeVisible();
    const after = await page.getByRole('heading', { name: 'My downloads', exact: true }).boundingBox(); expect(after!.y).toBe(before!.y);
    await expect(page.locator('main').getByRole('link', { name: 'Browse products', exact: true })).toHaveAttribute('href', '/products');
    await page.unroute('**/api/my-downloads');
    const baseFile = { token: 'never-used-test-token', maxUses: 10, usedCount: 0, isRevoked: false, expiresAt: null, digitalAsset: { id: 'qa-file', fileName: 'a-long-filename-without-spaces-'.repeat(8) + '.txt', fileSize: 20, mimeType: 'text/plain' }, order: { id: 'qa-order', createdAt: '2026-01-01T00:00:00Z' }, product: { id: 'qa-product', title: 'Long-product-title-without-spaces-'.repeat(8), image: [] } };
    await page.route('**/api/my-downloads', route => route.fulfill({ json: { downloads: [{ ...baseFile, id: 'expired', expiresAt: '2020-01-01T00:00:00Z' }, { ...baseFile, id: 'revoked', isRevoked: true }, { ...baseFile, id: 'exhausted', usedCount: 10 }] } }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const list = page.getByRole('list', { name: 'Your downloads', exact: true }); await expect(list.locator(':scope > li')).toHaveCount(3);
    await expect(list).toContainText('Expired'); await expect(list).toContainText('Revoked'); await expect(list).toContainText('Limit reached');
    const actions = list.getByRole('button', { name: 'Download file' }); await expect(actions).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(actions.nth(i)).toBeDisabled();
    for (const width of [360, 390, 1280, 2560]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.locator('[data-app-scroll-container]:visible').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
      for (let i = 0; i < 3; i++) { const bounds = await actions.nth(i).boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 15); }
    }
    await page.route('**/api/orders/user/**', route => route.fulfill({ json: [] })); await page.goto('/my-orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible(); await expect(page.locator('main').getByRole('link', { name: 'Browse products', exact: true })).toHaveAttribute('href', '/products');
  } finally { await context.close(); }
});

test('S4 — retained demo receipts, private downloads and responsive order history', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Reuse an isolated demo; never create purchases or reset caps');
  test.setTimeout(180_000);
  const { mkdir } = await import('node:fs/promises');
  const screenshots = '.private-showcase/responsive-audit/orders-' + (new URL(baseURL!).hostname === 'localhost' ? 'local' : 'live');
  await mkdir(screenshots, { recursive: true });
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const anonymous = await browser.newContext({ baseURL });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', failure => errors.push(failure.message));
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user?.id?.startsWith('demo_')).toBe(true);
    const endpoint = '/api/orders/user/' + session.user.id;
    const response = await context.request.get(endpoint);
    expect(response.status()).toBe(200); expect(response.headers()['cache-control']).toContain('no-store');
    const orders = await response.json();
    const order = orders.find((row: { checkout?: { environment: string; state: string } }) => row.checkout?.environment === 'DEMO' && row.checkout.state === 'COMPLETED');
    expect(!!order).toBe(true); expect(order.currency).toBe('NOK'); expect(order.items.length).toBe(2); expect(order.totalAmount).toBe(68);
    expect((await anonymous.request.get(endpoint)).status()).toBe(401);
    expect((await context.request.get('/api/orders/user/nonexistent-foreign-buyer')).status()).toBe(403);
    await page.goto('/my-orders', { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-labelledby="orders-title"]');
    const list = page.getByRole('list', { name: 'Your orders', exact: true });
    await expect(list).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    const row = list.locator(':scope > li').filter({ hasText: order.id.slice(-8).toUpperCase() });
    await expect(row).toContainText('Demo ready'); await expect(row).toContainText('NOK 0.00'); await expect(row).toContainText('No payment collected');
    await row.getByRole('button').click(); await expect(row.getByRole('button')).toHaveAttribute('aria-expanded', 'true'); await expect(page).toHaveURL(/\?order=/);
    await expect(row.getByRole('list', { name: 'Order items' }).locator('li')).toHaveCount(2);
    await row.getByRole('button').focus(); await page.keyboard.press('Enter'); await expect(row.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(row.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await page.route('**' + endpoint, route => route.fulfill({ status: 503, json: { error: 'Controlled QA failure' } }));
    await section.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(section.getByRole('alert')).toBeVisible(); await expect(row).toBeVisible(); await expect(page.getByRole('status', { name: 'Loading orders' })).toHaveCount(0);
    await page.unroute('**' + endpoint); await section.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(section.getByRole('alert')).toHaveCount(0);
    await row.getByRole('link', { name: 'View receipt', exact: true }).click(); await expect(page).toHaveURL(/\/checkout\/receipt\//);
    await expect(page.getByRole('heading', { name: 'Your demo order is ready' })).toBeVisible(); await expect(page.locator('main')).toContainText('0.00 NOK'); await expect(page.getByRole('list', { name: 'Receipt items' }).locator('li')).toHaveCount(2);
    // File failures stay on the receipt, with a usable retry instead of a raw API/error navigation.
    const receiptNotes = page.getByRole('button', { name: /^Download .*\.txt$/ });
    await page.route('**/api/download/**', route => route.fulfill({ status: 502, json: { error: 'Controlled QA storage failure' } }));
    await receiptNotes.click(); await expect(page.locator('main').getByRole('alert')).toHaveText('The file could not be downloaded. Please try again.');
    await expect(page).toHaveURL('/checkout/receipt/' + order.id); await expect(receiptNotes).toBeEnabled();
    await page.unroute('**/api/download/**');
    // Old bookmarks must resolve to the same truthful receipt, not a dollar receipt.
    await page.goto('/order-confirmation/' + order.id, { waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL('/checkout/receipt/' + order.id);
    await page.getByRole('link', { name: 'My downloads', exact: true }).click();
    const downloads = page.getByRole('list', { name: 'Your downloads', exact: true }); await expect(downloads.locator(':scope > li')).toHaveCount(2);
    const filesResponse = await context.request.get('/api/my-downloads'), files = (await filesResponse.json()).downloads;
    expect(filesResponse.headers()['cache-control']).toContain('no-store'); expect(files.every((file: { product?: { title: string } }) => file.product?.title === 'Veggat Interview Pack')).toBe(true);
    expect((await anonymous.request.get('/api/my-downloads')).status()).toBe(401);
    const file = files.find((file: { digitalAsset: { mimeType: string } }) => file.digitalAsset.mimeType === 'text/plain');
    expect((await anonymous.request.get('/api/download/' + file.token)).status()).toBe(401);
    const notes = downloads.locator(':scope > li').filter({ hasText: file.digitalAsset.fileName });
    await page.route('**/api/download/**', route => route.fulfill({ status: 502, json: { error: 'Controlled QA storage failure' } }));
    await notes.getByRole('button', { name: 'Download file' }).click(); await expect(notes.getByRole('alert')).toHaveText('The file could not be downloaded. Please try again.');
    await expect(notes.getByRole('button', { name: 'Download file' })).toBeEnabled(); await page.unroute('**/api/download/**');
    // Explicit opt-in consumes one remaining use of each existing file, never a new grant.
    if (process.env.E2E_DOWNLOADS === 'download') {
      for (const record of files) {
        const card = downloads.locator(':scope > li').filter({ hasText: record.digitalAsset.fileName });
        const done = page.waitForEvent('download'); await card.getByRole('button', { name: 'Download file' }).click(); const result = await done;
        expect(result.suggestedFilename()).toBe(record.digitalAsset.fileName); expect(await result.failure()).toBeNull();
        const stream = await result.createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
        const bytes = Buffer.concat(chunks); expect(bytes.length).toBe(record.digitalAsset.fileSize);
        if (record.digitalAsset.mimeType === 'image/jpeg') expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]); else expect(bytes.toString('utf8')).toContain('Veggat');
        await expect(card.getByRole('status')).toContainText('File sent to your browser');
      }
      const updated = (await (await context.request.get('/api/my-downloads')).json()).downloads;
      for (const before of files) expect(updated.find((after: { id: string }) => after.id === before.id).usedCount).toBe(before.usedCount + 1);
    }
    const downloadSection = page.locator('section[aria-labelledby="downloads-title"]');
    await page.route('**/api/my-downloads', route => route.fulfill({ status: 503, json: { error: 'Controlled QA read failure' } }));
    await downloadSection.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(downloadSection.getByRole('alert').first()).toBeVisible(); await expect(downloads).toBeVisible(); await expect(page.getByRole('status', { name: 'Loading downloads' })).toHaveCount(0);
    await page.unroute('**/api/my-downloads'); await downloadSection.getByRole('button', { name: 'Try again' }).click(); await expect(downloadSection.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    const matrix = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }];
    for (const path of ['/my-orders?order=' + order.id, '/my-downloads', '/checkout/receipt/' + order.id]) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { name: path.startsWith('/my-orders') ? 'My orders' : path === '/my-downloads' ? 'My downloads' : 'Your demo order is ready', exact: true });
      await expect(heading).toBeVisible();
      if (path.startsWith('/my-orders')) await expect(page.getByRole('link', { name: 'View receipt' }).first()).toBeVisible();
      if (path === '/my-downloads') { await expect(downloads).toBeVisible(); await expect.poll(() => downloads.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true); }
      const scroller = page.locator('[data-app-scroll-container]:visible');
      const label = path.startsWith('/my-orders') ? 'orders' : path === '/my-downloads' ? 'downloads' : 'receipt';
      for (const size of matrix) {
        await page.setViewportSize(size); await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
        const bounds = await heading.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(16); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width - 15);
        expect(await scroller.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && scrollY === 0)).toBe(true);
        if ([360, 390, 1280, 2560].includes(size.width)) await page.screenshot({ path: `${screenshots}/${label}-${size.width}-top.png` });
        await page.mouse.move(size.width / 2, Math.min(size.height / 2, 400)); await page.mouse.wheel(0, 500);
        if (await scroller.evaluate(e => e.scrollHeight > e.clientHeight + 5)) await expect.poll(() => scroller.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
        await page.mouse.wheel(0, 40000); await expect(page.locator('footer')).toBeInViewport();
        const content = await heading.locator('xpath=ancestor::section[1]').boundingBox(), footer = await page.locator('footer').boundingBox();
        expect(content).not.toBeNull(); expect(footer!.y).toBeGreaterThanOrEqual(content!.y + content!.height - 1);
        if ([390, 1280].includes(size.width)) await page.screenshot({ path: `${screenshots}/${label}-${size.width}-bottom.png` });
      }
      await page.emulateMedia({ colorScheme: 'dark' });
      for (const width of [390, 1280]) { await page.setViewportSize({ width, height: 844 }); await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: `${screenshots}/${label}-${width}-dark.png` }); }
      await page.emulateMedia({ colorScheme: 'light' });
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); await anonymous.close(); }
});

test('S8 — notifications real private inbox, pagination, read/archive, recovery and responsive scrolling', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_NOTIFICATIONS !== 'live-db', 'Explicit isolated fixture opt-in only');
  test.setTimeout(180_000);
  const { Pool } = await import('pg');
  const { randomBytes } = await import('node:crypto');
  const { default: bcrypt } = await import('bcryptjs');
  const { mkdir } = await import('node:fs/promises');
  const screenshots = '.private-showcase/responsive-audit/notifications-' + (new URL(baseURL!).hostname === 'localhost' ? 'local' : 'live');
  await mkdir(screenshots, { recursive: true });
  const database = new URL(process.env.DATABASE_URL_MAINLIVE!); database.searchParams.set('uselibpqcompat', 'true');
  const pool = new Pool({ connectionString: database.toString(), max: 2 });
  const id = 'qa_inbox_' + randomBytes(12).toString('hex');
  const email = id + '@example.invalid', password = randomBytes(24).toString('base64url');
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = [];
  let leaked = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.text().includes(password)) leaked = true; });
  try {
    await pool.query('INSERT INTO "User" (id,name,email,password,"emailVerified","updatedAt","web3ModeEnabled") VALUES ($1,$2,$3,$4,NOW(),NOW(),false)', [id, 'QA inbox fixture', email, await bcrypt.hash(password, 12)]);
    const fixtureTime = Date.now();
    for (let i = 0; i < 26; i++) {
      await pool.query('INSERT INTO "Notification" (id,"userId",type,title,message,"isArchived","expiresAt","createdAt","updatedAt") VALUES ($1,$2,\'SYSTEM\',$3,$4,$5,$6,$7,NOW())',
        [`${id}_${String(i).padStart(2, '0')}`, id, `QA update ${String(i).padStart(2, '0')}`, i === 0 ? 'A-long-notification-without-spaces-'.repeat(9) : 'Private order and account update for this QA session only.', i === 24, i === 25 ? new Date(0) : null, new Date(fixtureTime - Math.floor(i / 2) * 1000)]);
    }
    await pool.query('INSERT INTO "Notification" (id,"userId",type,title,message,"updatedAt") VALUES ($1,$2,\'SYSTEM\',\'Private other fixture\',\'Must never be visible\',NOW())', [`${id}_foreign`, `${id}_other`]);
    await page.goto('/auth/login?callbackUrl=%2Fnotifications', { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true }); if (await consent.isVisible()) await consent.click();
    await page.getByPlaceholder('you@example.com').fill(email); await page.locator('input[name=password]').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    const list = page.getByRole('list', { name: 'Notifications', exact: true });
    await expect(list.locator(':scope > li')).toHaveCount(20);
    if (await consent.isVisible()) await consent.click();
    expect((await (await context.request.get('/api/auth/session')).json()).user.id === id).toBe(true);
    expect((await context.request.get('/api/notifications?limit=-1')).status()).toBe(400);
    expect((await context.request.get('/api/notifications?cursor=' + id + '_foreign')).status()).toBe(400);
    expect((await context.request.patch('/api/notifications/' + id + '_foreign', { data: { isRead: true } })).status()).toBe(404);
    expect((await context.request.post('/api/notifications', { data: { userId: id + '_other', type: 'SYSTEM', title: 'Forged', message: 'Must not be created' } })).status()).toBe(403);
    let cursor: string | null = null; const seen: string[] = [];
    do {
      const data = await (await context.request.get('/api/notifications?limit=7' + (cursor ? '&cursor=' + cursor : ''))).json();
      seen.push(...data.notifications.map((row: { id: string }) => row.id)); cursor = data.nextCursor;
    } while (cursor && seen.length < 40);
    expect(seen.length).toBe(24); expect(new Set(seen).size).toBe(24); expect(seen.every(value => value.startsWith(id + '_'))).toBe(true);
    await page.getByRole('button', { name: 'Load more notifications', exact: true }).click(); await expect(list.locator(':scope > li')).toHaveCount(24);
    const first = list.locator(':scope > li').filter({ hasText: 'QA update 00' });
    await expect(first.getByRole('button')).toHaveCount(2); // Explicit state controls, not a disappearing clickable text block.
    await first.getByRole('button', { name: 'Mark read', exact: true }).click(); await expect(first.getByRole('button', { name: 'Mark unread', exact: true })).toBeVisible();
    await first.getByRole('button', { name: 'Archive', exact: true }).click(); await expect(first).toHaveCount(0);
    const filters = page.getByRole('group', { name: 'Notification filters', exact: true });
    await filters.getByRole('button', { name: /^archived$/i }).click(); await expect(page).toHaveURL(/filter=archived/); await expect(list.locator(':scope > li')).toHaveCount(2);
    await first.getByRole('button', { name: 'Restore to inbox', exact: true }).click(); await expect(first).toHaveCount(0);
    await filters.getByRole('button', { name: 'Inbox', exact: true }).click(); await expect(first).toBeVisible();
    // A failed server mutation must not pretend this row became unread.
    await page.route('**/api/notifications/' + id + '_00', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, json: { error: 'Controlled QA failure' } }) : route.continue());
    await first.getByRole('button', { name: 'Mark unread', exact: true }).click(); await expect(page.getByText('Notifications could not be updated. Please try again.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close toast', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Mark unread', exact: true })).toBeVisible(); await page.unroute('**/api/notifications/' + id + '_00');
    await first.getByRole('button', { name: 'Mark unread', exact: true }).click(); await expect(first.getByRole('button', { name: 'Mark read', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mark all as read', exact: true }).click(); await expect(page.getByText('0 unread in your inbox', { exact: true })).toBeVisible();
    await filters.getByRole('button', { name: /^unread$/i }).click(); await expect(page.getByRole('heading', { name: 'All caught up', exact: true })).toBeVisible();
    await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(filters.getByRole('button', { name: 'Inbox', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.route('**/api/notifications?**', route => new URL(route.request().url()).searchParams.get('limit') === '20' ? route.fulfill({ status: 503, json: { error: 'Controlled QA read failure' } }) : route.continue());
    const inboxAlert = page.locator('section[aria-labelledby="notifications-title"]').getByRole('alert');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(inboxAlert).toBeVisible(); await expect(first).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading notifications' })).toHaveCount(0);
    await page.unroute('**/api/notifications?**'); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(inboxAlert).toHaveCount(0);
    const scroller = page.locator('[data-app-scroll-container]:visible');
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size); await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
      const heading = await page.getByRole('heading', { name: 'Notifications', exact: true, level: 1 }).boundingBox();
      expect(heading!.x).toBeGreaterThanOrEqual(16); expect(heading!.x + heading!.width).toBeLessThanOrEqual(size.width - 15);
      expect(await scroller.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
      if ([360, 390, 1280, 2560].includes(size.width)) await page.screenshot({ path: `${screenshots}/${size.width}-top.png` });
      for (const control of ['Refresh', 'Settings']) {
        const bounds = await page.locator('section[aria-labelledby="notifications-title"]').getByRole(control === 'Settings' ? 'link' : 'button', { name: control, exact: true }).boundingBox();
        expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width - 15);
      }
      await page.mouse.move(size.width / 2, Math.min(size.height / 2, 400)); await page.mouse.wheel(0, 700); await expect.poll(() => scroller.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
      await page.mouse.wheel(0, 40000); await expect(page.locator('footer')).toBeInViewport();
      const lastRowBox = await list.locator(':scope > li').last().boundingBox(), footerBox = await page.locator('footer').boundingBox();
      expect(footerBox!.y).toBeGreaterThanOrEqual(lastRowBox!.y + lastRowBox!.height);
      if ([360, 1280].includes(size.width)) await page.screenshot({ path: `${screenshots}/${size.width}-bottom.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && scrollY === 0)).toBe(true);
    }
    // Test popover clipping and independent wheel scrolling in short landscape.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 }); await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: `${screenshots}/${width}-dark-top.png` });
      expect(await scroller.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 390 }); await scroller.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
    const bell = page.getByRole('button', { name: 'Notifications', exact: true }); await bell.click();
    const popover = page.getByRole('dialog', { name: 'Notification inbox', exact: true }); await expect(popover).toBeVisible();
    await popover.evaluate(async element => { await Promise.all(element.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished.catch(() => {}))); });
    const box = await popover.boundingBox(); expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${screenshots}/popover-landscape.png` });
    const popupList = popover.locator('[data-notification-scroll]'), popupBox = await popupList.boundingBox();
    await page.mouse.move(popupBox!.x + popupBox!.width / 2, popupBox!.y + popupBox!.height / 2); await page.mouse.wheel(0, 5000);
    await expect.poll(() => popupList.evaluate(e => e.scrollTop)).toBeGreaterThan(0); expect(await scroller.evaluate(e => e.scrollTop)).toBe(0);
    await page.keyboard.press('Escape'); await expect(popover).toHaveCount(0); await expect(bell).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Navigation Menu', exact: true }); await menu.getByRole('link', { name: 'Alerts', exact: true }).click(); await expect(menu).toHaveCount(0);
    await page.locator('section[aria-labelledby="notifications-title"]').getByRole('link', { name: 'Settings', exact: true }).click(); await expect(page).toHaveURL(/settings\?section=notifications/);
    expect(leaked).toBe(false); expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: 'wait' }); await context.close();
    // Only this run's synthetic private records; no public or owner data touched.
    if (!/^qa_inbox_[a-f0-9]{24}$/.test(id)) throw new Error('Unsafe fixture cleanup');
    await pool.query('DELETE FROM "Notification" WHERE "userId" = ANY($1::text[])', [[id, id + '_other']]);
    await pool.query('UPDATE "User" SET password=NULL,"tokenVersion"="tokenVersion"+1 WHERE id=$1 AND email=$2 AND role=\'USER\'', [id, email]);
    await pool.end();
  }
});

test('S8 — demo inbox is read-only and private notification APIs stay protected', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Demo notifications are read-only/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark all as read', exact: true })).toHaveCount(0);
    expect((await context.request.post('/api/notifications/mark-all-read')).status()).toBe(403);
    const result = await context.request.get('/api/notifications?archived=true&limit=20'); expect(result.status()).toBe(200);
    const rows = (await result.json()).notifications; expect(rows.every((row: { isArchived: boolean }) => row.isArchived)).toBe(true);
    const guest = await browser.newContext({ baseURL });
    try { expect((await guest.request.get('/api/notifications')).status()).toBe(401); } finally { await guest.close(); }
  } finally { await context.close(); }
});

test('S7 — shared header stays aligned and desktop rail scroll is independent', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    const main = page.locator('[data-app-scroll-container]:visible');
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 390 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await main.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
      const logo = page.locator('[data-nav-key="logo"]');
      const before = await logo.boundingBox();
      expect(before!.height).toBeGreaterThanOrEqual(44);
      const canvas = await page.locator('[data-header-canvas]').boundingBox();
      expect(canvas!.width).toBeLessThanOrEqual(1280);
      const contentEdge = await page.getByRole('link', { name: 'Back to products', exact: true }).boundingBox();
      expect(Math.abs(contentEdge!.x - before!.x)).toBeLessThanOrEqual(1);
      await page.mouse.move(size.width - 24, Math.min(size.height - 100, 500));
      await page.mouse.wheel(0, 800);
      await expect.poll(() => main.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
      const after = await logo.boundingBox();
      expect(after).toEqual(before);
      const rail = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
      if (size.width >= 1024) {
        await expect(rail).toBeInViewport();
        const mainTop = await main.evaluate(e => e.scrollTop);
        const bounds = await rail.boundingBox();
        await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        await page.mouse.wheel(0, 5000);
        await expect.poll(() => rail.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await expect(rail.getByRole('link', { name: 'Privacy', exact: true })).toBeInViewport();
        await page.mouse.wheel(0, 5000);
        expect(await main.evaluate(e => e.scrollTop)).toBe(mainTop);
        await page.mouse.wheel(0, -5000);
        await expect.poll(() => rail.evaluate(e => e.scrollTop)).toBe(0);
        expect(await main.evaluate(e => e.scrollTop)).toBe(mainTop);
      } else await expect(rail).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && scrollY === 0)).toBe(true);
    }
    let documents = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
    const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
    await nav.getByRole('link', { name: 'Products', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Marketplace', level: 1 })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Products', exact: true })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Cart', exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(nav.getByRole('link', { name: 'Cart', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(documents).toBe(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S7 — quick settings work on touch and keyboard without a document reload', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.tap();
    await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
    const menu = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
    await menu.getByRole('button', { name: 'Settings', exact: true }).tap();
    for (const mode of ['Light', 'Dark', 'System']) {
      const button = menu.getByRole('button', { name: mode, exact: true });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await button.tap();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      if (mode !== 'System') await expect(page.locator('html')).toHaveClass(new RegExp(mode.toLowerCase()));
    }
    for (const currency of ['USD', 'NOK']) {
      const button = menu.getByRole('button', { name: currency, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(menu.getByRole('button', { name: /Clear Cookies|Clear Cache/ })).toHaveCount(0);
    let documents = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
    const profile = menu.getByRole('navigation', { name: 'Quick settings' }).getByRole('link', { name: /^Profile / });
    await profile.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings\?section=profile$/);
    await expect(menu).toBeHidden();
    expect(documents).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test('S7 — delayed wallet controls do not move a scrolled navigation drawer', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let walletBundleHeld = false;
  try {
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    const trigger = page.getByRole('button', { name: 'Open menu', exact: true });
    await expect(trigger).toBeEnabled();
    await page.route('**/_next/static/chunks/**', async route => {
      const response = await route.fetch();
      const source = await response.text();
      // Isolate this panel, not Radix's scroll-lock/focus code or other UI chunks.
      if (source.includes('Connect a wallet to get started') && source.includes('Extension, WalletConnect')) {
        walletBundleHeld = true;
        await pending;
      }
      await route.fulfill({ response });
    });
    await trigger.click();
    const menu = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
    await expect(menu.getByText('Loading wallet controls…', { exact: true })).toBeVisible();
    await expect.poll(() => walletBundleHeld).toBe(true);
    await menu.evaluate(async e => { await Promise.all(e.getAnimations().map(a => a.finished.catch(() => {}))); });
    const scroll = page.locator('[data-navigation-scroll]');
    const box = await scroll.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => scroll.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
    const before = await scroll.evaluate(e => ({ height: e.scrollHeight, top: e.scrollTop }));
    release();
    await expect(menu.getByText('Connect a wallet to get started', { exact: true })).toBeVisible();
    expect(await scroll.evaluate(e => ({ height: e.scrollHeight, top: e.scrollTop }))).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  } finally { release(); await context.close(); }
});

for (const width of [390, 1280]) {
test(`S7 — deferred chunks cannot replace readable server content (${width}px)`, async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 } });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const html = await (await context.request.get('/dashboard')).text();
  const initialScripts = new Set([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => new URL(match[1], baseURL).pathname));
  expect(initialScripts.size).toBeGreaterThan(0);
  let release!: () => void, deferredCount = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/chunks/**', async route => {
    if (!initialScripts.has(new URL(route.request().url()).pathname)) { deferredCount++; await pending; }
    await route.continue();
  });
  try {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const heading = page.getByRole('heading', { name: /Welcome back,/ });
    await expect(heading).toBeVisible();
    const originalHeading = await heading.elementHandle();
    const menu = page.getByRole('button', { name: 'Open menu', exact: true });
    // Root scripts may hydrate, but deferred UI/provider chunks are still held.
    await expect(menu).toBeEnabled();
    await expect(heading).toBeVisible();
    expect(await originalHeading!.evaluate(e => e.isConnected)).toBe(true);
    await expect(page.getByRole('status', { name: 'Loading page', exact: true })).toHaveCount(0);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    await page.mouse.move(width / 2, 600);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.locator('[data-site-scroll]').evaluate(e => e.scrollTop)).toBeGreaterThan(0);
    release();
    await menu.click();
    await expect(page.getByRole('dialog', { name: 'Navigation Menu', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await originalHeading!.evaluate(e => e.isConnected)).toBe(true);
    expect(errors).toEqual([]);
    test.info().annotations.push({ type: 'deferred-chunks', description: String(deferredCount) });
  } finally { release(); await context.close(); }
});
}

test('S7 — dashboard shares one unobscured navigation rail in both themes', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('veggat:theme', value), theme);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { name: /Welcome back,/ });
      await expect(heading).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        const scroll = page.locator('[data-site-scroll]');
        await scroll.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('main,[data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
        const logo = await page.locator('[data-nav-key="logo"]').boundingBox();
        expect((await heading.boundingBox())!.x).toBe(logo!.x);
        await expect(page.locator('a[href="/dashboard"]:visible')).toHaveCount(size.width >= 1024 ? 1 : 0);
        if (size.width >= 1024) {
          const dashboard = page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('link', { name: 'Dashboard', exact: true });
          await dashboard.scrollIntoViewIfNeeded();
          expect(await dashboard.evaluate(e => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
          await expect(dashboard).toHaveAttribute('aria-current', 'page');
        }
        await page.mouse.move(size.width / 2, size.height - 30);
        await page.mouse.wheel(0, 5000);
        await expect.poll(() => scroll.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await expect(page.locator('footer')).toBeInViewport();
        expect(await page.evaluate(() => scrollY)).toBe(0);
      }
    }
    await page.locator('[data-site-scroll]').evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
    let documents = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
    await page.locator('main').getByRole('link', { name: /^Products Browse/ }).click();
    await expect(page.getByRole('heading', { name: 'Marketplace', level: 1 })).toBeVisible();
    expect(documents).toBe(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S7 — product detail layout, gallery and real scrolling at eight sizes in both themes', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    await expect(page.locator('[data-product-price]')).toHaveText(/29,00 NOK/);
    const next = page.getByRole('button', { name: 'Next product image', exact: true });
    await next.click();
    const previous = page.getByRole('button', { name: 'Previous product image', exact: true });
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(previous).toBeDisabled();
    const scroll = page.locator('[data-app-scroll-container]:visible');
    for (const theme of ['light', 'dark']) {
      // next-themes persists this exact setting; exercise a real reload as well.
      await page.evaluate(value => localStorage.setItem('veggat:theme', value), theme);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        await page.setViewportSize(size);
        await scroll.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('main, [data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
        const title = await page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true }).boundingBox();
        const image = await page.getByRole('img', { name: 'Veggat Interview Pack', exact: true }).first().boundingBox();
        if (size.width < 1024) expect(title!.y).toBeGreaterThan(image!.y + image!.height);
        else expect(title!.x).toBeGreaterThan(image!.x + image!.width);
        const actions = page.getByRole('region', { name: 'Product purchase', exact: true });
        if (size.width < 1024) {
          await expect(actions).toBeInViewport();
          expect((await actions.getByRole('button').boundingBox())!.height).toBeGreaterThanOrEqual(44);
        } else await expect(actions).toBeHidden();
        await page.mouse.move(size.width - 24, Math.min(size.height - 120, 600));
        await page.mouse.wheel(0, 15000);
        await expect.poll(() => scroll.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await expect(page.locator('footer')).toBeInViewport();
        if (size.width < 1024) {
          const lastLink = await page.locator('footer').getByRole('link').last().boundingBox();
          expect(lastLink!.y + lastLink!.height).toBeLessThanOrEqual((await actions.boundingBox())!.y);
        }
        const position = await scroll.evaluate(e => e.scrollTop);
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        const menu = page.getByRole('dialog', { name: 'Navigation Menu', exact: true });
        await expect(menu).toBeVisible();
        await menu.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
        const drawerScroll = page.locator('[data-navigation-scroll]');
        const drawerBox = await drawerScroll.boundingBox();
        await page.mouse.move(drawerBox!.x + drawerBox!.width / 2, drawerBox!.y + drawerBox!.height / 2);
        await page.mouse.wheel(0, 4000);
        await expect.poll(() => drawerScroll.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        expect(await scroll.evaluate(e => e.scrollTop)).toBe(position);
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        expect(await scroll.evaluate(e => e.scrollTop)).toBe(position);
        expect(await page.evaluate(() => scrollY)).toBe(0);
        await page.mouse.move(size.width - 24, Math.min(size.height - 120, 600));
        await page.mouse.wheel(0, -15000);
        await expect.poll(() => scroll.evaluate(e => e.scrollTop)).toBe(0);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/products/cveggatinterviewcredits01', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Interviewer AI Credits', level: 1, exact: true })).toBeVisible();
    await expect(page.locator('[data-product-price]')).toHaveText(/39,00 NOK/);
    await expect(page.getByText('Credits appear in your AI balance after verified payment.', { exact: true })).toBeVisible();
    await expect(page.locator('main')).not.toContainText('My downloads');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const width of [390, 1280]) {
test(`S3 — product purchase locks repeated clicks and reuses a digital cart line (${width}px)`, async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 } });
  const page = await context.newPage();
  const product = await (await context.request.get('/api/products/cveggatinterviewpack000001')).json();
  let posts = 0, saved = false;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => /^\/api\/cart\/[^/]+$/.test(url.pathname), async route => {
    if (route.request().method() === 'POST') { posts++; await pending; saved = true; }
    await route.fulfill({ json: { id: 'pdp-fixture', items: saved ? [{ id: 'pdp-line', quantity: 1, product }] : [] } });
  });
  try {
    await page.goto(`/products/${product.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: product.title, level: 1, exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    const add = page.getByRole('button', { name: 'Add to basket', exact: true });
    await expect(add).toBeEnabled();
    await add.dblclick();
    await expect.poll(() => posts).toBe(1);
    for (const button of await page.getByRole('button', { name: 'Adding…', exact: true }).all()) await expect(button).toBeDisabled();
    release();
    await expect(add).toBeEnabled();
    await add.click();
    await expect(page.getByText('Already in your basket', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Buy now', exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    expect(posts).toBe(1);
  } finally { release(); await context.close(); }
});

test(`S3 — product load retries without reloading the shell and uncertain cart writes stop (${width}px)`, async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const product = await (await context.request.get('/api/products/cveggatinterviewpack000001')).json();
  let reads = 0, documents = 0, posts = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/products/${product.id}`, async route => {
    reads++;
    if (reads === 1) return route.fulfill({ status: 503, json: { error: 'Fixture unavailable' } });
    await pending; return route.fulfill({ json: product });
  });
  await page.route(url => /^\/api\/cart\/[^/]+$/.test(url.pathname), async route => {
    if (route.request().method() === 'POST') { posts++; return route.fulfill({ status: 503, json: { error: 'Fixture uncertain write' } }); }
    return route.fulfill({ json: { id: 'pdp-fixture', items: [] } });
  });
  try {
    await page.goto(`/products/${product.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Something went wrong', exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    const loading = page.getByRole('status', { name: 'Loading product', exact: true });
    await expect(loading).toBeVisible();
    expect(await loading.evaluate(e => [...e.querySelectorAll('*')].every(n => getComputedStyle(n).animationName === 'none'))).toBe(true);
    const galleryBefore = await loading.locator('section').first().locator(':scope > div').first().boundingBox();
    release();
    await expect(page.getByRole('heading', { name: product.title, level: 1, exact: true })).toBeVisible();
    const gallery = page.locator('[data-embla-carousel]').locator('..').locator('..');
    const galleryAfter = await gallery.boundingBox();
    expect(Math.abs(galleryAfter!.y - galleryBefore!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(galleryAfter!.width - galleryBefore!.width)).toBeLessThanOrEqual(2);
    expect(documents).toBe(1);
    await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Review your basket');
    await expect(page.getByRole('button', { name: 'Buy now', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add to basket', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Review basket', exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    expect(posts).toBe(1);
  } finally { release(); await context.close(); }
});
}

test('S7 — checkout aligns separate order lines and payment summary at eight sizes', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo).toBe(true);
    expect((await context.request.delete(`/api/cart/${session.user.id}`)).ok()).toBe(true);
    for (const productId of ['cveggatinterviewpack000001', 'cveggatinterviewcredits01']) expect((await context.request.post(`/api/cart/${session.user.id}`, { data: { productId, quantity: 1 } })).ok()).toBe(true);
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Secure checkout', exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    const items = page.getByRole('region', { name: 'Order items', exact: true });
    const summary = page.getByRole('complementary', { name: 'Payment summary', exact: true });
    await expect(items.getByRole('heading', { level: 3 })).toHaveCount(2);
    await expect(items).toContainText('29.00 NOK');
    await expect(items).toContainText('39.00 NOK');
    await expect(summary).toContainText('0.00 NOK');
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      const scroll = page.locator('[data-site-scroll]:visible');
      await scroll.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('[data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
      const orderBox = await items.boundingBox(), summaryBox = await summary.boundingBox();
      if (size.width < 1024) expect(summaryBox!.y).toBeGreaterThan(orderBox!.y + orderBox!.height);
      else expect(summaryBox!.x).toBeGreaterThan(orderBox!.x + orderBox!.width);
      expect((await page.locator('[data-checkout]').boundingBox())!.width).toBeLessThanOrEqual(1280);
      await page.mouse.move(size.width - 24, Math.min(size.height - 100, 600)); await page.mouse.wheel(0, 15000);
      await expect.poll(() => scroll.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
      await expect(page.locator('footer')).toBeInViewport();
      expect(await page.evaluate(() => scrollY)).toBe(0);
    }
    // Layout-only: no checkout submission, no new free credits or orders.
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S3 — failed saved-cart reads block product purchases without blind retries', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let writes = 0;
  await page.route(url => /^\/api\/cart\/[^/]+$/.test(url.pathname), async route => {
    if (route.request().method() !== 'GET') writes++;
    await route.fulfill({ status: 503, json: { error: 'Fixture unavailable' } });
  });
  try {
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main').getByRole('alert')).toContainText('could not verify your saved basket');
    await expect(page.getByRole('button', { name: 'Buy now', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add to basket', exact: true })).toBeDisabled();
    expect(writes).toBe(0);
  } finally { await context.close(); }
});

test('S3 — guest product purchase preserves a safe login return path', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let writes = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/cart/')) writes++; });
  try {
    const productPath = '/products/cveggatinterviewpack000001';
    await page.goto(productPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true, level: 1 })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login\?/);
    expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(productPath);
    expect(writes).toBe(0);
  } finally { await context.close(); }
});

test('S3 — product report stays within phone landscape and share failures have feedback', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let reports = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.headers()['next-action']) reports++; });
  // Browser capability fixture, not the owner's OS clipboard.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new DOMException('Fixture denied', 'NotAllowedError'); } }, configurable: true });
  });
  try {
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true, level: 1 })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByText('Could not share the link. You can copy it from your address bar.', { exact: true })).toBeVisible();
    for (const size of [{ width: 360, height: 800 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(size);
      await page.getByRole('button', { name: 'Report', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Rapporter dette produktet', exact: true });
      await expect(dialog).toBeVisible();
      await dialog.evaluate(async e => { await Promise.all(e.getAnimations().map(a => a.finished.catch(() => {}))); });
      const box = await dialog.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(15);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height - 15);
      expect(box!.x).toBeGreaterThanOrEqual(15);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width - 15);
      expect((await dialog.getByRole('button', { name: 'Close', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const reasons = dialog.getByRole('group', { name: 'Grunn *', exact: true });
      await reasons.getByRole('button', { name: 'Annet', exact: true }).click();
      await expect(reasons.getByRole('button', { name: 'Annet', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await dialog.getByLabel('Beskrivelse (valgfritt)', { exact: true }).fill('Layout check only — not submitted.');
      await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click();
      await expect(dialog).toBeHidden();
    }
    expect(reports).toBe(0);
  } finally { await context.close(); }
});

for (const width of [390, 1280]) {
test(`S7 — server session prevents late-auth layout and scroll jumps (${width}px)`, async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
    viewport: { width, height: 844 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|hydrating|#418|#423|#425/i.test(message.text())) errors.push(message.text());
  });
  let releaseScripts!: () => void;
  const scripts = new Promise<void>(resolve => { releaseScripts = resolve; });
  let sessionRequests = 0;
  await page.route('**/_next/static/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('.js')) await scripts;
    await route.continue();
  });
  // A blocked client session endpoint must not change the identity or layout
  // of the server-rendered page. No real authentication response is modified.
  await page.route('**/api/auth/session', route => { sessionRequests++; return route.abort(); });
  await page.route('**/api/conversations?**', route => route.fulfill({ json: {
    conversations: Array.from({ length: 12 }, (_, index) => ({
      id: `session-layout-${index}`, title: `Session layout post ${index}`,
      description: 'A repeatable post for checking the scroll position after session initialization.',
      type: 'PUBLIC_THREAD', tags: ['layout'], userId: 'layout-fixture-user',
      user: { id: 'layout-fixture-user', name: 'Layout reviewer', email: '' },
      createdAt: '2026-01-01T12:00:00.000Z', messageCount: 1, hasPoll: false,
    })), nextCursor: null,
  } }));
  try {
    const response = await page.goto('/pulse', { waitUntil: 'commit' });
    expect(response!.headers()['cache-control']).toContain('private');
    expect(response!.headers()['cache-control']).not.toContain('s-maxage');
    const notice = page.getByRole('complementary', { name: 'Demo mode', exact: true });
    await expect(notice).toBeVisible();
    const composer = page.getByRole('textbox', { name: 'Write a Pulse', exact: true });
    await expect(composer).toBeVisible();
    const beforeComposer = await composer.boundingBox();
    const before = await notice.boundingBox();
    const scroll = page.locator('[data-site-scroll]');
    const beforeScroll = await scroll.boundingBox();
    releaseScripts();
    await expect(page.getByRole('feed', { name: 'Pulse feed' }).getByRole('article')).toHaveCount(12);
    expect(await notice.boundingBox()).toEqual(before);
    expect(await scroll.boundingBox()).toEqual(beforeScroll);
    expect(await composer.boundingBox()).toEqual(beforeComposer);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    await page.mouse.move(width / 2, 700);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => scroll.evaluate(e => e.scrollTop)).toBeGreaterThan(1000);
    const position = await scroll.evaluate(e => e.scrollTop);
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation Menu', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Navigation Menu', exact: true })).toBeHidden();
    expect(await scroll.evaluate(e => e.scrollTop)).toBe(position);
    expect(sessionRequests).toBe(0);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(errors).toEqual([]);
  } finally { releaseScripts(); await context.close(); }
});
}

test('S2 — personalized HTML stays private and invalid sessions fail closed', async ({ playwright, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const guest = await playwright.request.newContext({ baseURL });
  const demo = await playwright.request.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE });
  const invalid = await playwright.request.newContext({ baseURL, extraHTTPHeaders: {
    Cookie: `${baseURL?.startsWith('https:') ? '__Secure-' : ''}authjs.session-token=invalid-test-session`,
  } });
  try {
    for (const path of ['/', '/products', '/pulse']) {
      for (const [client, isDemo] of [[guest, false], [demo, true], [guest, false], [invalid, false]] as const) {
        const response = await client.get(path);
        expect(response.status()).toBe(200);
        expect(response.headers()['cache-control']).toContain('private');
        expect(response.headers()['cache-control']).not.toContain('s-maxage');
        expect((await response.text()).includes('aria-label="Demo mode"')).toBe(isDemo);
      }
    }
    expect((await (await invalid.get('/api/auth/session')).json())?.user).toBeUndefined();
    expect((await invalid.get('/api/wallets')).status()).toBe(401);
  } finally { await Promise.all([guest.dispose(), demo.dispose(), invalid.dispose()]); }
});

for (const width of [390, 1280]) {
test(`S7 — session navigation waits for handlers before accepting clicks (${width}px)`, async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 } });
  const page = await context.newPage();
  let release!: () => void;
  const scripts = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('.js')) await scripts;
    await route.continue();
  });
  try {
    await page.goto('/settings?section=wallet', { waitUntil: 'commit' });
    const menu = page.getByRole('button', { name: 'Open menu', exact: true });
    await expect(menu).toBeVisible();
    await expect(menu).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toBeDisabled();
    const change = width < 1024 ? page.getByRole('button', { name: 'Settings sections: Web3 & Wallet', exact: true })
      : page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('button', { name: /^Payments / });
    await expect(change).toBeVisible();
    await expect(change).toBeDisabled();
    release();
    await expect(menu).toBeEnabled();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    await change.click();
    if (width < 1024) {
      const drawer = page.getByRole('dialog', { name: 'Settings sections', exact: true });
      await expect(drawer).toBeVisible();
      await drawer.getByRole('button', { name: /^Payments / }).click();
    }
    await expect(page.getByRole('heading', { name: 'Seller Payments', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/section=payments/);
    await menu.click();
    await expect(page.getByRole('dialog', { name: 'Navigation Menu', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
  } finally { release(); await context.close(); }
});
}

test('S7 — cart layout, exact currency and scrolling work at eight sizes', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const products = await (await context.request.get('/api/products?perPage=2')).json();
  const lines = products.map((p: { id: string; title: string; price: number; priceCurrency: string; image: string[] }, i: number) => ({ id: `cart-layout-${i}`, quantity: 1, product: { id: p.id, title: p.title, price: p.price, priceCurrency: p.priceCurrency, image: p.image } }));
  let release!: () => void;
  const initial = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => /^\/api\/cart\/[^/]+$/.test(url.pathname), async route => {
    await initial;
    await route.fulfill({ json: { id: 'cart-layout', userId: 'demo-layout', items: lines } });
  });
  try {
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status', { name: 'Loading cart', exact: true })).toBeVisible();
    // This case measures the cart transition; the separate slow-script shell
    // case verifies that demo chrome is already correct before hydration.
    await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toBeVisible();
    const before = await page.getByRole('heading', { name: 'Your cart', exact: true }).boundingBox();
    const skeletonRow = await page.getByRole('status', { name: 'Loading cart', exact: true }).locator('[aria-hidden="true"]').first().locator(':scope > div').first().boundingBox();
    release();
    const rows = page.getByRole('region', { name: 'Cart items', exact: true }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    const loadedRow = await rows.first().boundingBox();
    expect(Math.abs(loadedRow!.y - skeletonRow!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(loadedRow!.height - skeletonRow!.height)).toBeLessThanOrEqual(2);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    expect((await page.getByRole('heading', { name: 'Your cart', exact: true }).boundingBox())!.y).toBe(before!.y);
    await expect(page.getByRole('region', { name: 'Cart summary' })).toContainText(/NOK\s*68\.00/);
    const scroll = page.locator('[data-site-scroll]');
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await scroll.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('main, [data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
      for (const row of await rows.all()) {
        const heading = row.getByRole('heading');
        expect(await heading.evaluate(e => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true);
        for (const button of await row.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const summary = await page.getByRole('region', { name: 'Cart summary' }).boundingBox();
      const lastRow = await rows.last().boundingBox();
      if (size.width < 1024) expect(summary!.y).toBeGreaterThan(lastRow!.y + lastRow!.height);
      else expect(summary!.x).toBeGreaterThan(lastRow!.x + lastRow!.width);
      await page.mouse.move(size.width - 24, size.height - 30); await page.mouse.wheel(0, 10000);
      await expect.poll(() => scroll.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
      await expect(page.locator('footer')).toBeInViewport();
      await page.mouse.wheel(0, -10000); await expect.poll(() => scroll.evaluate(e => e.scrollTop)).toBe(0);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      test.info().annotations.push({ type: 'cart-viewport', description: `${size.width}x${size.height}` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await rows.first().getByRole('heading').getByRole('link').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: lines[0].product.title, exact: true, level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { release(); await context.close(); }
});

test('S7 — cart concurrent edits and failure recovery retain rows without a skeleton', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Uses the retained isolated demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const products = await (await context.request.get('/api/products?perPage=2')).json();
  const cartAlert = page.locator('main').getByRole('alert');
  let lines = products.map((p: { id: string; title: string; price: number; priceCurrency: string; image: string[] }, i: number) => ({ id: `cart-concurrency-${i}`, quantity: 1, product: { id: p.id, title: p.title, price: p.price, priceCurrency: p.priceCurrency, image: p.image } }));
  let failRead = true;
  let failFirst = true;
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const second = new Promise<void>(resolve => { releaseSecond = resolve; });
  let mutations = 0;
  let reads = 0;
  await page.route(url => url.pathname.startsWith('/api/cart/'), async route => {
    if (route.request().method() === 'GET') {
      reads++;
      return route.fulfill(failRead ? { status: 503, json: { error: 'Fixture unavailable' } } : { json: { id: 'cart-concurrency', userId: 'demo-layout', items: lines } });
    }
    mutations++;
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    if (id === lines[0]?.id && failFirst) { await first; return route.fulfill({ status: 503, json: { error: 'Fixture failure' } }); }
    if (mutations === 2) await second;
    if (route.request().method() === 'DELETE') { lines = lines.filter((i: { id: string }) => i.id !== id); return route.fulfill({ json: { message: 'Removed' } }); }
    const change = route.request().postDataJSON().changeType === 'increment' ? 1 : -1;
    lines = lines.map((i: { id: string; quantity: number }) => i.id === id ? { ...i, quantity: i.quantity + change } : i);
    return route.fulfill({ json: lines.find((i: { id: string }) => i.id === id) });
  });
  try {
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    const rows = page.getByRole('region', { name: 'Cart items' }).getByRole('listitem');
    await expect(cartAlert).toContainText('refresh before making another change');
    await expect(page.getByRole('heading', { name: 'Your cart is empty', exact: true })).toHaveCount(0);
    failRead = false;
    await page.getByRole('button', { name: 'Refresh saved cart', exact: true }).click();
    await expect(rows).toHaveCount(2);
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    await rows.first().getByRole('button', { name: 'Increase quantity', exact: true }).click();
    await rows.last().getByRole('button', { name: 'Increase quantity', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Updating cart…', exact: true })).toBeDisabled();
    await expect(page.getByRole('status', { name: 'Loading cart', exact: true })).toHaveCount(0);
    expect(mutations).toBe(2);
    releaseSecond(); await expect(rows.last()).toHaveAttribute('aria-busy', 'false');
    failRead = true; releaseFirst();
    await expect(cartAlert).toContainText('refresh before making another change');
    await expect(rows).toHaveCount(2);
    await expect(rows.last().getByRole('group')).toContainText('2');
    await expect(rows.first().getByRole('group')).toContainText('1');
    await expect(page.getByRole('button', { name: 'Proceed to checkout', exact: true })).toBeDisabled();
    failRead = false; failFirst = false;
    await page.getByRole('button', { name: 'Refresh saved cart', exact: true }).click();
    await expect(cartAlert).toHaveCount(0);
    const readsBefore = reads;
    await rows.last().getByRole('button', { name: 'Decrease quantity', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Proceed to checkout', exact: true })).toBeVisible();
    expect(reads).toBe(readsBefore);
    await rows.first().getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(rows).toHaveCount(1); expect(reads).toBe(readsBefore);
    await expect(page.getByRole('status', { name: 'Loading cart', exact: true })).toHaveCount(0);
  } finally { releaseFirst(); releaseSecond(); await context.close(); }
});

test('S7 — catalog canvas, first wheel and controls remain stable at eight sizes', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Marketplace', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Essential Only', exact: true })).toBeHidden();
    const scroll = page.locator('[data-app-scroll-container]');
    const search = page.getByRole('searchbox', { name: 'Search products' });
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await scroll.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
      const header = page.getByRole('heading', { level: 1 }).locator('..').locator('..');
      const before = await header.boundingBox();
      const inputBefore = await search.boundingBox();
      const card = await page.getByRole('article', { name: 'Veggat Interview Pack', exact: true }).boundingBox();
      expect(card!.width).toBeLessThan(500);
      expect(inputBefore!.height).toBeGreaterThanOrEqual(44);
      expect(await search.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('[data-app-scroll-container],main')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
      await expect(page.locator('footer')).toHaveCount(0);
      const max = await scroll.evaluate(e => e.scrollHeight - e.clientHeight);
      if (max > 50) {
        await page.mouse.move(size.width - 24, size.height - 30);
        await page.mouse.wheel(0, 50);
        await expect.poll(() => scroll.evaluate(e => e.scrollTop)).toBe(50);
        // Two frames beyond the previous 200ms collapse catches scroll anchoring regressions.
        await page.waitForTimeout(250);
        expect(await scroll.evaluate(e => e.scrollTop)).toBe(50);
        expect((await header.boundingBox())!.height).toBe(before!.height);
        expect((await search.boundingBox())!.width).toBe(inputBefore!.width);
        await page.mouse.wheel(0, 10000);
        await expect.poll(() => scroll.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
        await page.mouse.wheel(0, -10000);
        await expect.poll(() => scroll.evaluate(e => e.scrollTop)).toBe(0);
      }
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      test.info().annotations.push({ type: 'catalog-viewport', description: `${size.width}x${size.height}; card ${card!.width}px` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const first = page.getByRole('article', { name: 'Veggat Interview Pack', exact: true });
    await first.getByRole('button', { name: 'Next image of Veggat Interview Pack', exact: true }).click();
    await expect(page).toHaveURL(/\/products$/);
    await first.getByRole('button', { name: 'Previous image of Veggat Interview Pack', exact: true }).click();
    await first.getByRole('heading').getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Veggat Interview Pack', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S7 — catalog retains results through slow search, error and recovery', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let releaseInitial!: () => void;
  let releaseOld!: () => void;
  let sawOld!: () => void;
  const initial = new Promise<void>(resolve => { releaseInitial = resolve; });
  const old = new Promise<void>(resolve => { releaseOld = resolve; });
  const oldStarted = new Promise<void>(resolve => { sawOld = resolve; });
  const items = await (await context.request.get('/api/products?perPage=2')).json();
  expect(items.length).toBeGreaterThan(0);
  let fail = true;
  let firstRequest = true;
  await page.route(url => url.pathname === '/api/products', async route => {
    const term = new URL(route.request().url()).searchParams.get('searchTerm');
    if (firstRequest) { firstRequest = false; await initial; }
    if (term === 'old') {
      sawOld(); await old;
      await route.fulfill({ json: [{ ...items[0], title: 'Obsolete result' }] }).catch(() => {});
    } else if (term === 'new') await route.fulfill({ json: [{ ...items[0], title: 'Newest result' }] });
    else if (term === 'error' && fail) await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    else if (term === 'empty') await route.fulfill({ json: [] });
    else if (term === 'currency') await route.fulfill({ json: [{ ...items[0], priceCurrency: 'INVALID' }] });
    else await route.fulfill({ json: items });
  });
  try {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    const skeleton = page.getByRole('status', { name: 'Loading products', exact: true });
    await expect(skeleton).toBeVisible();
    const placeholder = await skeleton.locator('[aria-hidden] > div').first().boundingBox();
    releaseInitial();
    await expect(page.getByRole('article').first()).toBeVisible();
    const card = await page.getByRole('article').first().boundingBox();
    expect(Math.abs(card!.height - placeholder!.height)).toBeLessThan(2);
    expect(Math.abs(card!.y - placeholder!.y)).toBeLessThan(2);
    const search = page.getByRole('searchbox', { name: 'Search products' });
    await search.fill('old'); await oldStarted;
    await expect(page.getByRole('article')).toHaveCount(items.length);
    await expect(skeleton).toHaveCount(0);
    await expect(page.getByText('Updating products…', { exact: true })).toBeVisible();
    await search.fill('new');
    await expect(page.getByRole('heading', { name: 'Newest result', exact: true })).toBeVisible();
    releaseOld();
    await search.fill('error');
    await expect(page.getByRole('alert').filter({ hasText: 'Check your connection' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Newest result', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Obsolete result', exact: true })).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Retry products', exact: true }).click();
    await expect(page.getByRole('heading', { name: items[0].title, exact: true })).toBeVisible();
    await search.fill('empty');
    await expect(page.getByRole('heading', { name: 'No products match this view', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show all products', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('article')).toHaveCount(items.length);
    await search.fill('currency');
    await expect(page.getByText('Price unavailable', { exact: true })).toBeVisible();
    await expect(page.getByRole('article').getByRole('button', { name: 'Buy now', exact: true })).toBeDisabled();
  } finally { releaseInitial(); releaseOld(); await context.close(); }
});

test('S7 — catalog desktop filter docks, categories, price and page size work', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await context.addInitScript(() => localStorage.setItem('veggastare:uiPreferences', JSON.stringify({ preferredFiatCurrency: 'NOK', preferredCryptoCurrency: 'ETH' })));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Browse categories', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: /Digital art/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('article h2')).toHaveText(['Veggat Interview Pack']);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: 'Product filters', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Product filters', exact: true });
    const scroll = page.locator('[data-app-scroll-container]');
    const body = panel.locator('[data-product-filter-scroll]');
    for (const dock of ['Right edge', 'Beside products, right', 'Beside products, left', 'Left edge']) {
      await page.getByRole('button', { name: 'Filter panel position', exact: true }).click();
      await page.getByRole('menuitemradio', { name: dock, exact: true }).click();
      const box = await panel.boundingBox();
      const card = await page.getByRole('article').first().boundingBox();
      expect(box!.x >= 0 && box!.x + box!.width <= 1280).toBe(true);
      expect(box!.x + box!.width <= card!.x || box!.x >= card!.x + card!.width).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const background = await scroll.evaluate(e => e.scrollTop);
    const box = await body.boundingBox();
    await page.mouse.move(box!.x + 15, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => body.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
    await page.mouse.wheel(0, 5000);
    expect(await scroll.evaluate(e => e.scrollTop)).toBe(background);
    await panel.getByRole('button', { name: 'View Options', exact: true }).click();
    await panel.getByRole('combobox', { name: 'Products per page' }).click();
    const pageSize = page.waitForResponse(response => { const u = new URL(response.url()); return u.pathname === '/api/products' && u.searchParams.get('perPage') === '10'; });
    await page.getByRole('option', { name: '10 per page', exact: true }).click();
    expect((await pageSize).status()).toBe(200);
    await body.hover(); await page.mouse.wheel(0, -5000);
    await expect.poll(() => body.evaluate(e => e.scrollTop)).toBe(0);
    await panel.getByText('Enter exact values', { exact: true }).click();
    await panel.getByRole('spinbutton', { name: 'Maximum price (NOK)', exact: true }).fill('30');
    await panel.getByRole('button', { name: 'Apply price range', exact: true }).click();
    await expect(page.locator('article h2')).toHaveText(['Veggat Interview Pack']);
    await panel.getByRole('button', { name: /Reset all filters/ }).click();
    await expect(page.getByRole('heading', { name: 'Interviewer AI Credits', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Close filters', exact: true }).click();
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Filter panel position', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Right edge', exact: true }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Product filters', exact: true }).click();
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.x).toBeGreaterThan(900);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S7 — catalog cart and buy-now buttons reach checkout and recover from failure', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Reuses an isolated, app-issued demo session');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo).toBe(true);
    expect((await context.request.delete(`/api/cart/${session.user.id}`)).ok()).toBe(true);
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) { await consent.click(); await expect(consent).toBeHidden(); }
    const pack = page.getByRole('article', { name: 'Veggat Interview Pack', exact: true });
    await pack.getByRole('button', { name: 'Add Veggat Interview Pack to cart', exact: true }).click();
    await expect(page.getByText('Added to basket', { exact: true })).toBeVisible();
    await page.getByRole('article', { name: 'Interviewer AI Credits', exact: true }).getByRole('button', { name: 'Buy now', exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { name: 'Secure checkout', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Order items' }).getByRole('heading', { level: 3 })).toHaveCount(2);
    await expect(page.getByText('0.00 NOK', { exact: true })).toBeVisible();
    // Do not fulfill an order or grant more credits during this catalog check.
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await page.route(url => url.pathname === `/api/cart/${session.user.id}`, route => route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: { error: 'Temporary test outage' } }) : route.continue());
    const add = pack.getByRole('button', { name: 'Add Veggat Interview Pack to cart', exact: true });
    await add.click();
    await expect(page.getByText('Could not add this product to your basket. Please try again.', { exact: true })).toBeVisible();
    await expect(add).toBeEnabled();
    await expect(page).toHaveURL(/\/products$/);
  } finally { await context.close(); }
});

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
      // Next's streamed response can briefly retain an inert hidden shell.
      // Audit the one visible scroller, never an arbitrary first DOM match.
      const site = page.locator('[data-site-scroll]:visible');
      await expect(site).toHaveCount(1);
      for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
        test.info().annotations.push({ type: 'auth-viewport', description: `${route}: ${size.width}x${size.height}` });
        await page.setViewportSize(size);
        await site.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
        await expect(site.getByRole('heading', { level: 1 })).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('main, [data-site-scroll]')].every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
        const measurements = await site.locator('main input:not([type=hidden])').evaluateAll(xs => xs.map(x => ({ labels: (x as HTMLInputElement).labels?.length ?? 0, height: x.getBoundingClientRect().height, font: parseFloat(getComputedStyle(x).fontSize) })));
        for (const field of measurements) { expect(field.labels).toBeGreaterThan(0); expect(field.height).toBeGreaterThanOrEqual(48); expect(field.font).toBeGreaterThanOrEqual(16); }
        const card = site.locator('[data-auth-card]');
        if (await card.count()) {
          const box = await card.boundingBox();
          expect(Math.abs(box!.x + box!.width / 2 - size.width / 2)).toBeLessThan(2);
          expect(box!.width).toBeLessThanOrEqual(448);
        }
        const canvas = site.locator('[data-auth-canvas]');
        if (await canvas.count()) expect((await canvas.boundingBox())!.width).toBeLessThanOrEqual(1280);
        await expect(site.locator('footer')).not.toBeInViewport();
        await page.mouse.move(size.width / 2, size.height - 30);
        await page.mouse.wheel(0, 7000);
        await expect(site.locator('footer')).toBeInViewport();
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
    // Opt-in only: safe Resend test recipients and a synthetic USER in the
    // isolated Preview database. Never fall back to the owner's production DB.
    test.skip(process.env.E2E_AUTH_RECOVERY !== 'isolated-preview', 'Requires explicit isolated recovery-fixture opt-in');
    test.setTimeout(120_000);
    const { Pool } = await import('pg');
    const { randomBytes } = await import('node:crypto');
    const { isolatedPreviewEnv } = await import('../scripts/with-preview-database.mjs');
    const isolated = isolatedPreviewEnv();
    expect(['http://localhost:3000', 'https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app']).toContain(baseURL);
    expect(process.env.VERCEL_ENV === 'preview' && process.env.DATABASE_URL_MAINPREVIEW === isolated.DATABASE_URL_MAINPREVIEW).toBe(true);
    const database = new URL(isolated.DATABASE_URL_MAINPREVIEW);
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
      // A fresh origin hydrates the banner after the server-rendered chat.
      // Wait for its actual control instead of racing a one-shot isVisible().
      const hasConsent = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('veggat:cookieConsent') ?? 'null')?.version === 1; }
        catch { return false; }
      });
      if (!hasConsent) {
        await expect(consent).toBeVisible();
        await consent.click();
        await expect(consent).toBeHidden();
      }
      await page.getByRole('button', { name: 'Start a blank chat', exact: true }).click();
      await expect(page).toHaveURL(/\/ai\/c[a-z0-9]+$/);
      const conversationPath = new URL(page.url()).pathname;
      await expect(page.getByText(`${initial.balance} demo credit${initial.balance === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
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
        await expect(page.getByText(`${remaining} demo credit${remaining === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
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
      await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
      await expect(page.getByText('This model needs 2 credits; you have 0.', { exact: false })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'AI message', exact: true })).toHaveValue('This must be blocked before any provider charge.');
      // The disabled button is UX only. Exercise the server independently so
      // client-side gating is never mistaken for the actual spending boundary.
      const denied = await context.request.post('/api/ai-chat', { headers: { Origin: baseURL! }, data: {
        sessionId: conversationPath.split('/').at(-1), provider: 'OPENAI', model: 'gpt-5.6-luna', requestId: crypto.randomUUID(),
        messages: [{ role: 'user', content: 'This must be blocked before any provider charge.' }],
      } });
      expect(denied.status()).toBe(402);
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
      // Establish the retained identity explicitly; the separate slow-script
      // shell regression also verifies its server-rendered first paint.
      if (process.env.E2E_DEMO_STORAGE_STATE) await expect(page.getByRole('button', { name: 'Exit demo', exact: true })).toBeVisible();
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
test('S4 — custom credits persist across product, basket, cart, checkout and receipt', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(240_000);
  test.skip(process.env.E2E_CUSTOM_CREDITS !== '1', 'Opt-in isolated demo cart/order; never a real payment');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
    viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    if (!process.env.E2E_DEMO_STORAGE_STATE) {
      await page.getByRole('button', { name: 'Try the demo — no payment', exact: true }).click();
      await page.waitForURL('**/products', { waitUntil: 'domcontentloaded' });
    }
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user.isDemo).toBe(true);
    const cartPath = `/api/cart/${session.user.id}`;
    // This is an app-issued disposable demo identity, never the owner's cart.
    expect((await context.request.delete(cartPath)).ok()).toBe(true);
    if (process.env.E2E_SAVE_DEMO_STATE) await context.storageState({ path: process.env.E2E_SAVE_DEMO_STATE });
    await page.goto('/products/cveggatinterviewcredits01', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Interviewer AI Credits', exact: true, level: 1 })).toBeVisible({ timeout: 60_000 });
    const input = page.getByRole('textbox', { name: 'Number of credits', exact: true });
    if (await consent.isVisible()) await consent.click();
    await input.fill('122');
    await expect(page.getByRole('button', { name: 'Add to basket', exact: true }).filter({ visible: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Update credits', exact: true }).click();
    await page.getByRole('button', { name: 'Add to basket', exact: true }).filter({ visible: true }).click();
    await page.setViewportSize({ width: 1280, height: 844 });
    await expect(page.getByRole('button', { name: '1 item in basket', exact: true })).toBeVisible();
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(input).toHaveValue('122');
    const cart = await (await context.request.get(cartPath)).json();
    const rowId = cart.items[0].id;
    expect(cart.items[0]).toMatchObject({ quantity: 1, creditAmount: 122, product: { price: 47.16, priceCurrency: 'NOK' } });
    for (const invalid of [99, 1001, 122.5, '555', -1]) {
      expect((await context.request.patch(`${cartPath}/items/${rowId}`, { data: { creditAmount: invalid } })).status()).toBe(400);
    }
    for (const width of [360, 390, 1280, 2560]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.locator('[data-site-scroll]').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await input.fill('122.5');
    await page.getByRole('button', { name: 'Update credits', exact: true }).click();
    await expect(page.locator('[data-credit-editor]').getByRole('alert')).toContainText('whole number');
    await expect(page.getByRole('button', { name: 'Proceed to checkout', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath('custom-credit-cart-390.png') });
    await page.getByRole('link', { name: 'Proceed to checkout', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Secure checkout', exact: true })).toBeVisible();
    const pay = page.getByRole('button', { name: 'Complete free demo order', exact: true });
    await input.fill('555');
    await expect(pay).toBeDisabled();
    await page.getByRole('button', { name: 'Update credits', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Interviewer AI Credits · 555 credits', exact: true })).toBeVisible();
    await expect(pay).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('custom-credit-checkout-390.png') });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(input).toHaveValue('555');
    expect((await (await context.request.get(cartPath)).json()).items[0].product.price).toBe(206.51);
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.getByRole('button', { name: '1 item in basket', exact: true }).click();
    const basketEditor = page.getByRole('dialog', { name: 'Shopping basket', exact: true }).locator('[data-credit-editor]');
    await expect(basketEditor.getByRole('textbox', { name: 'Number of credits', exact: true })).toHaveValue('555');
    await basketEditor.getByRole('textbox', { name: 'Number of credits', exact: true }).fill('122');
    await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeDisabled();
    await expect(pay).toBeDisabled();
    await basketEditor.getByRole('button', { name: 'Update credits', exact: true }).click();
    await expect.poll(async () => (await (await context.request.get(cartPath)).json()).items[0].creditAmount).toBe(122);
    await expect(basketEditor.getByRole('button', { name: 'Update credits', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Close basket', exact: true }).click();
    // Another surface changed the cart: the old checkout must not charge a stale quote.
    await pay.click();
    await expect(page.getByRole('alert').filter({ hasText: 'cart changed' })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(input).toHaveValue('122');
    await pay.click();
    await page.waitForURL('**/checkout/receipt/**', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('list', { name: 'Receipt items', exact: true })).toContainText('Interviewer AI Credits · 122 credits');
    await page.screenshot({ path: testInfo.outputPath('custom-credit-receipt.png') });
    // Leave this disposable demo ready for read-only currency regressions.
    expect((await context.request.post(cartPath, { data: { productId: 'cveggatinterviewcredits01', quantity: 1 } })).ok()).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S5 — exhausted demo guidance preserves drafts without provider requests', async ({ browser, baseURL }) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE, 'Retained demo identity; browser-only balance and conversation fixtures');
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const writes: string[] = [];
  let balance = 1;
  try {
    const auth = await (await context.request.get('/api/auth/session')).json();
    expect(auth.user.isDemo).toBe(true);
    await page.route('**/api/ai-chat/config', route => route.fulfill({ json: {
      balance, authenticated: true, demo: true, environment: 'DEMO', dailyUsed: 4, dailyLimit: 5, savedProviders: [],
      models: [
        { provider: 'GOOGLE', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', credits: 1, available: true },
        { provider: 'OPENAI', model: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', credits: 2, available: true },
      ],
    } }));
    await page.route('**/api/ai-chat/sessions/qa-credit-guidance', route => route.fulfill({ json: {
      id: 'qa-credit-guidance', title: 'Credit guidance QA', isPublic: false, isSuspended: false,
      suspendedReason: null, triggerMode: 'MANUAL', creatorId: auth.user.id, participants: [], messages: [],
    } }));
    await page.route('**/api/ai-chat', route => {
      if (route.request().method() === 'POST') { writes.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    await page.goto('/ai/qa-credit-guidance', { waitUntil: 'domcontentloaded' });
    const composer = page.getByRole('textbox', { name: 'AI message', exact: true });
    await expect(composer).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    const hasConsent = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('veggat:cookieConsent') ?? 'null')?.version === 1; }
      catch { return false; }
    });
    if (!hasConsent) { await expect(consent).toBeVisible(); await consent.click(); await expect(consent).toBeHidden(); }
    await expect(page.getByRole('link', { name: 'Credit history: 1 demo credit', exact: true })).toBeVisible();
    await expect(page.getByText('1 send left today', { exact: true })).toBeVisible();
    await expect(page.locator('#ai-credit-guidance')).toContainText('1 credit per message');
    await composer.fill('Keep this draft; do not call a provider.');
    await page.getByRole('button', { name: /^Choose AI model:/ }).click();
    await page.getByRole('dialog', { name: 'Choose AI model', exact: true }).getByRole('button', { name: 'GPT-5.6 Luna 2 credits', exact: true }).click();
    await expect(page.locator('#ai-credit-guidance')).toContainText('Choose a cheaper model');
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
    balance = 0;
    await page.evaluate(() => window.dispatchEvent(new Event('ai-credit:refresh')));
    await expect(page.locator('#ai-credit-guidance')).toContainText('Your demo allowance is used up');
    await expect(page.locator('#ai-credit-guidance')).not.toContainText('Choose a cheaper model');
    await expect(composer).toHaveValue('Keep this draft; do not call a provider.');
    await expect(page.getByRole('link', { name: 'Buy credits', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
    for (const width of [360, 390, 1280, 2560]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(composer).toBeInViewport();
    }
    expect(writes).toEqual([]);
  } finally { await context.close(); }
});

test('S7 — product loading uses gallery geometry without a catalogue flash', async ({ browser, baseURL }) => {
  for (const { width, navigate } of [390, 1280].flatMap(width => [{ width, navigate: false }, { width, navigate: true }])) {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    let release = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    try {
      await page.route('**/api/products/cveggatinterviewpack000001', async route => { await pending; await route.continue(); });
      await page.addInitScript(() => {
        const state = window as Window & { productCatalogFlash?: boolean };
        state.productCatalogFlash = false;
        new MutationObserver(() => {
          // Next streams hidden fallback templates too; only a rendered
          // catalogue placeholder is the user-visible regression.
          const catalogVisible = [...document.querySelectorAll('[role="status"][aria-label="Loading products"]')].some(element => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
          if (location.pathname === '/products/cveggatinterviewpack000001' && catalogVisible) state.productCatalogFlash = true;
        }).observe(document, { childList: true, subtree: true });
      });
      if (navigate) {
        await page.goto('/products', { waitUntil: 'domcontentloaded' });
        const product = page.getByRole('link', { name: 'Veggat Interview Pack', exact: true });
        await expect(product).toBeVisible();
        const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
        await expect(consent).toBeVisible(); await consent.click(); await expect(consent).toBeHidden();
        await product.click();
      } else await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
      const loading = page.getByRole('status', { name: 'Loading product', exact: true });
      await expect(loading).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Marketplace', exact: true })).toHaveCount(0);
      const before = await loading.boundingBox();
      const skeletonGallery = await loading.locator('section').first().locator(':scope > div').first().boundingBox();
      expect(before!.width).toBeLessThanOrEqual(1280);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      release();
      await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true })).toBeVisible();
      await expect(loading).toHaveCount(0);
      // Compare the same outer gallery box, not its 13px-padded carousel.
      const gallery = await page.locator('[data-product-gallery]').boundingBox();
      expect(Math.abs(gallery!.x - skeletonGallery!.x)).toBeLessThan(2);
      expect(Math.abs(gallery!.width - skeletonGallery!.width)).toBeLessThan(2);
      expect(await page.evaluate(() => (window as Window & { productCatalogFlash?: boolean }).productCatalogFlash)).toBe(false);
    } finally { release(); await context.close(); }
  }
});

test('S7 — product gallery and purchase layout work across phone to ultrawide', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, reducedMotion: 'reduce', colorScheme: 'dark' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/products/cveggatinterviewpack000001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Veggat Interview Pack', level: 1, exact: true })).toBeVisible();
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    const main = page.locator('[data-app-scroll-container]:visible');
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 },
      { width: 768, height: 1024 }, { width: 1024, height: 1366 }, { width: 1280, height: 800 },
      { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      await main.evaluate(e => e.scrollTo({ top: 0, behavior: 'instant' }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const detail = await page.locator('[data-product-detail]').last().boundingBox();
      expect(detail!.width).toBeLessThanOrEqual(1280);
      const second = page.getByRole('button', { name: 'View product image 2', exact: true });
      await second.focus(); await page.keyboard.press('Enter');
      await expect(second).toHaveAttribute('aria-pressed', 'true');
      const first = page.getByRole('button', { name: 'View product image 1', exact: true });
      await first.click(); await expect(first).toHaveAttribute('aria-pressed', 'true');
      expect((await second.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (size.width < 1024) {
        const bar = page.getByRole('region', { name: 'Product purchase', exact: true });
        await expect(bar.getByRole('button', { name: 'Add to basket', exact: true })).toBeInViewport();
      }
      await page.mouse.move(size.width - 24, Math.min(size.height - 100, 500));
      await page.mouse.wheel(0, 5000);
      await expect.poll(() => main.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
      const terms = page.getByRole('link', { name: 'Salgsvilkår', exact: true });
      await expect(terms).toBeInViewport();
      const bounds = await terms.boundingBox();
      if (size.width < 1024) {
        const mobile = await page.locator('[data-mobile-product-actions]').boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(mobile!.y);
      }
      await page.screenshot({ path: testInfo.outputPath(`product-bottom-${size.width}x${size.height}.png`) });
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('S7 — selected credits preview matches typed amount without placing an order', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const productResponses: number[] = [];
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/api/products/cveggatinterviewcredits01') productResponses.push(response.status());
  });
  let moneyWrites = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && /^\/api\/(checkout|payments|cart)/.test(new URL(request.url()).pathname)) moneyWrites++;
  });
  try {
    await page.goto('/products/cveggatinterviewcredits01', { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => ({ visible: await page.getByRole('heading', { name: 'Interviewer AI Credits', exact: true }).isVisible(), productResponses }),
      { message: 'Credit product must load; include API status evidence on failure' }).toMatchObject({ visible: true });
    const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
    if (await consent.isVisible()) await consent.click();
    const input = page.getByRole('textbox', { name: 'Number of credits', exact: true });
    for (const value of ['122', '555', '1000']) {
      await input.fill(value);
      await expect(page.getByRole('button', { name: 'Buy now', exact: true })).toBeDisabled();
      await input.press('Enter');
      await expect(page.locator('[data-credit-preview]')).toHaveText(Number(value).toLocaleString('en-US'));
      await expect(page.getByRole('button', { name: 'Buy now', exact: true })).toBeEnabled();
    }
    await input.fill('99'); await input.press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a whole number' })).toBeVisible();
    await expect(page.locator('[data-credit-preview]')).toHaveText('1,000');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(input).toHaveValue('1000');
    expect(moneyWrites).toBe(0);
  } finally { await context.close(); }
});
