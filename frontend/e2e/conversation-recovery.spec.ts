import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) for (const recovery of ['missing', 'ready']) test(`conversation read failure supports ${recovery} recovery (${width}px)`, async ({ browser, baseURL }) => {
  const state = process.env.E2E_DEMO_STORAGE_STATE;
  expect(state).toBeTruthy();
  const context = await browser.newContext({ baseURL, storageState: state, viewport: { width, height: 844 } });
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    if (recovery === 'ready') await page.getByRole('link', { name: 'Back to messages', exact: true }).click();
    else await page.getByRole('button', { name: 'Back to Messages', exact: true }).click();
    await expect(page).toHaveURL(/\/conversations$/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
