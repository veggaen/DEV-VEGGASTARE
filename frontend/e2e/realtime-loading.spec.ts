import { expect, test, type WebSocketRoute } from '@playwright/test';

test('guest homepage does not open a realtime connection', async ({ page }) => {
  const connections: string[] = [];
  await page.routeWebSocket(/pusher\.com/, socket => { connections.push(socket.url()); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Essential Only', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
  expect(connections).toHaveLength(0);
});

for (const width of [390, 1280]) {
  test(`real SDK delivers a cart refresh and survives navigation (${width}px)`, async ({ browser, baseURL }) => {
    const state = process.env.E2E_DEMO_STORAGE_STATE;
    expect(state, 'Provide an isolated, already authenticated demo session').toBeTruthy();
    const context = await browser.newContext({ baseURL, storageState: state, viewport: { width, height: 844 } });
    try {
      const session = await (await context.request.get('/api/auth/session')).json();
      expect(session?.user?.isDemo).toBe(true);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      let socket: WebSocketRoute | undefined;
      const subscribed: string[] = [];
      let refreshes = 0;
      await page.route(`**/api/cart/${session.user.id}`, async route => {
        expect(route.request().method()).toBe('GET');
        refreshes++;
        await route.fulfill({ json: { items: [] } });
      });
      // The production SDK runs unchanged. Only its remote transport is mocked:
      // no event is published to Pusher and no persistent cart is mutated.
      await page.routeWebSocket(/pusher\.com/, ws => {
        socket = ws;
        ws.send(JSON.stringify({ event: 'pusher:connection_established', data: JSON.stringify({ socket_id: '123.456', activity_timeout: 120 }) }));
        ws.onMessage(raw => {
          const message = JSON.parse(String(raw));
          if (message.event === 'pusher:subscribe') {
            subscribed.push(message.data.channel);
            ws.send(JSON.stringify({ event: 'pusher_internal:subscription_succeeded', channel: message.data.channel, data: '{}' }));
          }
          if (message.event === 'pusher:ping') ws.send(JSON.stringify({ event: 'pusher:pong', data: '{}' }));
        });
      });
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      await expect.poll(() => subscribed.filter(name => name.endsWith(`UserChannel_${session.user.id}`)).length).toBe(1);
      const channel = subscribed.find(name => name.endsWith(`UserChannel_${session.user.id}`))!;
      const before = refreshes;
      socket!.send(JSON.stringify({ event: 'cart-update', channel, data: JSON.stringify({ userId: session.user.id }) }));
      await expect.poll(() => refreshes).toBeGreaterThan(before);
      if (width < 1024) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const cartLink = page.locator('a[href="/cart"]:visible').first();
      await expect(cartLink).toBeVisible();
      await cartLink.click();
      await expect(page).toHaveURL(/\/cart$/);
      await page.waitForLoadState('networkidle');
      const afterNavigation = refreshes;
      socket!.send(JSON.stringify({ event: 'cart-update', channel, data: '{}' }));
      await expect.poll(() => refreshes).toBeGreaterThan(afterNavigation);
      expect(subscribed.filter(name => name === channel)).toHaveLength(1);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
