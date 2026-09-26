import { expect, test, type WebSocketRoute } from '@playwright/test';

for (const [width, height] of [[360, 800], [844, 390], [1280, 800], [2560, 1080]]) {
  test(`reading older messages survives incoming updates (${width}px)`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height }, hasTouch: width < 600 || height < 500, reducedMotion: 'reduce' });
    try {
      const theme = process.env.E2E_THEME === 'dark' ? 'dark' : 'light';
      await context.addInitScript(value => localStorage.setItem('veggat:theme', value), theme);
      const session = await (await context.request.get('/api/auth/session')).json();
      expect(session.user?.isDemo).toBe(true);
      const page = await context.newPage();
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const id = 'qa-reading-thread', peer = { id: 'qa-reading-peer', name: 'QA Reader', image: null };
      const makeMessage = (index: number) => ({ id: `reading-${index}`, content: `Message ${index}: A readable paragraph in a longer conversation. Keep my place while I read earlier replies.`,
        senderId: index % 2 ? session.user.id : peer.id, conversationId: id, createdAt: '2026-09-25T12:00:00Z', User: peer });
      const messages = Array.from({ length: 40 }, (_, index) => makeMessage(index));
      let reads = 0, socket: WebSocketRoute | undefined, channel = '';
      await page.route(`**/api/messages?conversationId=${id}`, route => {
        reads++;
        return route.fulfill({ json: { messages, users: [peer, session.user], conversation: { id, title: 'Reading QA', type: 'GROUP', userId: session.user.id,
          isAnonymized: false, deletionRequestedAt: null, deletionScheduledFor: null, deletionVisibility: null } } });
      });
      // Only transport is synthetic: the actual SDK and app callbacks run.
      // No message or Pusher event is published to any hosted account.
      await page.route('**/api/pusher/auth', route => route.fulfill({ json: { auth: 'qa-fixture:transport-only' } }));
      await page.routeWebSocket(/pusher\.com/, ws => {
        socket = ws;
        ws.send(JSON.stringify({ event: 'pusher:connection_established', data: JSON.stringify({ socket_id: '123.456', activity_timeout: 120 }) }));
        ws.onMessage(raw => {
          const event = JSON.parse(String(raw));
          if (event.event === 'pusher:subscribe') {
            if (event.data.channel.endsWith(`ConversationChannel_${id}`)) channel = event.data.channel;
            ws.send(JSON.stringify({ event: 'pusher_internal:subscription_succeeded', channel: event.data.channel, data: '{}' }));
          }
          if (event.event === 'pusher:ping') ws.send(JSON.stringify({ event: 'pusher:pong', data: '{}' }));
        });
      });
      await page.goto(`/conversations/${id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Reading QA', exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme}(?:$|\\s)`));
      await expect.poll(() => channel).not.toBe('');
      await expect.poll(() => reads).toBeGreaterThan(1); // Subscription refresh finished.
      const transcript = page.getByRole('region', { name: 'Conversation messages', exact: true });
      const metrics = () => transcript.evaluate(el => ({ top: el.scrollTop, remaining: el.scrollHeight - el.scrollTop - el.clientHeight }));
      await expect.poll(async () => (await metrics()).remaining).toBeLessThan(4);
      const bottom = (await metrics()).top;
      await transcript.hover(); await page.mouse.wheel(0, -900);
      await expect.poll(async () => (await metrics()).top).toBeLessThan(bottom - 600);
      const before = (await metrics()).top, previousReads = reads;
      messages.push(makeMessage(40));
      socket!.send(JSON.stringify({ event: 'conversation-updated', channel, data: '{}' }));
      await expect.poll(() => reads).toBeGreaterThan(previousReads);
      await expect(page.getByText(messages[40].content, { exact: true })).toHaveCount(1);
      await expect.poll(async () => Math.abs((await metrics()).top - before)).toBeLessThan(4);
      const latest = page.getByRole('button', { name: 'Scroll to latest messages', exact: true });
      await expect(latest).toBeInViewport();
      await latest.click();
      await expect.poll(async () => (await metrics()).remaining).toBeLessThan(4);
      await transcript.hover(); await page.mouse.wheel(0, -600);
      await expect.poll(async () => (await metrics()).remaining).toBeGreaterThan(300);
      messages.push(makeMessage(41));
      socket!.send(JSON.stringify({ event: 'conversation-updated', channel, data: '{}' }));
      await expect(page.getByText(messages[41].content, { exact: true })).toHaveCount(1);
      await expect.poll(async () => (await metrics()).remaining).toBeLessThan(4);
      await expect(page.getByPlaceholder('Write a message…', { exact: true })).toBeInViewport();
      const send = page.getByRole('button', { name: 'Send message', exact: true });
      await expect(send).toBeInViewport({ ratio: 1 });
      const sendBox = await send.boundingBox();
      expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(height);
      await page.getByRole('textbox', { name: 'Message', exact: true }).fill('A multiline draft\n'.repeat(20));
      await expect(send).toBeInViewport({ ratio: 1 });
      await expect.poll(async () => (await metrics()).remaining).toBeLessThan(4);
      await page.getByRole('textbox', { name: 'Message', exact: true }).fill('');
      await expect.poll(async () => (await metrics()).remaining).toBeLessThan(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath('reading.png') });
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
