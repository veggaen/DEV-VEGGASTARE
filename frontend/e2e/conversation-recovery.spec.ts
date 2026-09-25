import { expect, test } from '@playwright/test';

for (const width of [360, 390, 844, 768, 1024, 1280, 1920, 2560]) for (const recovery of ['missing', 'ready']) test(`conversation read failure supports ${recovery} recovery (${width}px)`, async ({ browser, baseURL }, info) => {
  const state = process.env.E2E_DEMO_STORAGE_STATE;
  expect(state).toBeTruthy();
  const context = await browser.newContext({ baseURL, storageState: state, viewport: { width, height: width === 844 ? 390 : width >= 1920 ? 1080 : 844 } });
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user?.isDemo).toBe(true);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let reads = 0;
    await page.route('**/api/messages?conversationId=cqaconversationrecovery', async route => {
      expect(route.request().method()).toBe('GET');
      reads++;
      const ready = reads > 1 && recovery === 'ready';
      await route.fulfill({ status: reads === 1 ? 503 : ready ? 200 : 404, json: ready ? {
        messages: [], users: [], hasPoll: false,
        conversation: { id: 'cqaconversationrecovery', title: 'QA recovery conversation', type: 'GROUP', userId: session.user.id,
          originalUserId: null, deletionRequestedAt: null, deletionScheduledFor: null, deletionVisibility: null, isAnonymized: false },
      } : { message: 'Unavailable' } });
    });
    await page.goto('/conversations/cqaconversationrecovery');
    await expect(page.getByRole('heading', { name: 'Could not load conversation', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: recovery === 'ready' ? 'QA recovery conversation' : 'Conversation unavailable', exact: true })).toBeVisible();
    expect(reads).toBe(2);
    if (recovery === 'ready') {
      const composer = page.getByPlaceholder('Write a message…', { exact: true });
      const before = await composer.boundingBox();
      await page.getByRole('button', { name: 'Members & voice', exact: true }).click();
      await page.waitForTimeout(250); // Finish the existing 200ms panel transition before measuring.
      const screenshot = info.outputPath('members-panel.png');
      await page.screenshot({ path: screenshot });
      await info.attach('members-panel', { path: screenshot, contentType: 'image/png' });
      console.log(JSON.stringify({ width, composerBefore: before?.width, composerAfter: (await composer.boundingBox())?.width }));
      await expect(page.getByRole('dialog', { name: 'Members & voice', exact: true })).toBeVisible();
      expect((await composer.boundingBox())?.width).toBe(before?.width);
      await page.getByRole('dialog', { name: 'Members & voice', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Members & voice', exact: true })).toBeFocused();
      await expect(composer).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    if (recovery === 'ready') await page.getByRole('link', { name: 'Back to messages', exact: true }).click();
    else await page.getByRole('button', { name: 'Back to Messages', exact: true }).click();
    await expect(page).toHaveURL(/\/conversations$/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('leaving a slow conversation aborts its read and preserves the next thread', async ({ browser, baseURL }) => {
  expect(process.env.E2E_DEMO_STORAGE_STATE).toBeTruthy();
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE });
  let releaseOld!: () => void;
  const held = new Promise<void>(resolve => { releaseOld = resolve; });
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user?.isDemo).toBe(true);
    const page = await context.newPage();
    let oldStarted = false;
    let oldAborted = false;
    page.on('requestfailed', request => { if (request.url().includes('conversationId=cqaslowthread')) oldAborted = true; });
    const make = (id: string, title: string) => ({ id, title, type: 'GROUP', userId: session.user.id,
      originalUserId: null, deletionRequestedAt: null, deletionScheduledFor: null, deletionVisibility: null, isAnonymized: false,
      participants: [], participantDetails: [], visibility: 'PRIVATE', isPinned: false, isLocked: false, tags: [], lastMessage: null,
      messageCount: 0, user: { id: session.user.id, name: 'QA demo', image: null }, createdAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-20T12:00:00Z' });
    await page.route('**/api/conversations?**', route => route.fulfill({ json: [make('cqaslowthread', 'Slow thread'), make('cqacurrentthread', 'Current thread')] }));
    await page.route('**/api/messages?conversationId=**', async route => {
      const slow = route.request().url().includes('cqaslowthread');
      if (slow) { oldStarted = true; await held; }
      await route.fulfill({ json: { messages: [], users: [], conversation: slow ? make('cqaslowthread', 'Slow thread') : make('cqacurrentthread', 'Current thread') } });
    });
    await page.goto('/conversations');
    await page.getByText('Slow thread', { exact: true }).click();
    await expect.poll(() => oldStarted).toBe(true);
    await page.goBack();
    await page.getByText('Current thread', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Current thread', exact: true })).toBeVisible();
    await expect.poll(() => oldAborted).toBe(true);
    releaseOld();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Current thread', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Slow thread', exact: true })).toHaveCount(0);
  } finally { releaseOld(); await context.close(); }
});
