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
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Current thread', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Slow thread', exact: true })).toHaveCount(0);
  } finally { releaseOld(); await context.close(); }
});

for (const width of [360, 1280]) for (const theme of ['light', 'dark']) test(`message retry/edit/delete controls (${width}px ${theme})`, async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: 844 }, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(value => localStorage.setItem('veggat:theme', value), theme);
    const session = await (await context.request.get('/api/auth/session')).json(); expect(session.user?.isDemo).toBe(true);
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const id = 'qa-message-controls', sender = { id: session.user.id, name: 'QA demo', image: null };
    let messages: Array<{ id: string; content: string; senderId: string; conversationId: string; createdAt: string; editedAt?: string; User: typeof sender }> = [];
    const requests: string[] = []; let deletes = 0;
    await page.route(`**/api/messages?conversationId=${id}`, route => route.fulfill({ json: { messages, users: [sender], conversation: { id, title: 'Message controls QA', type: 'GROUP', userId: sender.id, isAnonymized: false, deletionRequestedAt: null, deletionScheduledFor: null, deletionVisibility: null } } }));
    await page.route('**/api/messages', async route => {
      expect(route.request().method()).toBe('POST'); const body = route.request().postDataJSON(); requests.push(body.requestId);
      if (requests.length === 1) return route.fulfill({ status: 503, json: { message: 'QA temporary failure' } });
      messages = [{ id: 'qa-message', content: body.content, senderId: sender.id, conversationId: id, createdAt: new Date().toISOString(), User: sender }];
      await route.fulfill({ status: 201, json: messages[0] });
    });
    await page.route('**/api/messages/qa-message', async route => {
      if (route.request().method() === 'PATCH') { messages[0] = { ...messages[0], content: route.request().postDataJSON().content, editedAt: new Date().toISOString() }; return route.fulfill({ json: messages[0] }); }
      expect(route.request().method()).toBe('DELETE'); deletes++; messages = []; await route.fulfill({ json: { message: 'Message deleted' } });
    });
    await page.goto(`/conversations/${id}`, { waitUntil: 'domcontentloaded' });
    const composer = page.getByPlaceholder('Write a message…', { exact: true }); await expect(composer).toBeVisible();
    await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme}(?:$|\\s)`));
    await expect(page.getByRole('button', { name: /Private images temporarily unavailable/ })).toBeDisabled();
    await composer.fill('Keep my failed draft'); await composer.press('Enter'); await expect(page.getByText('QA temporary failure', { exact: true })).toBeVisible();
    await expect(composer).toHaveValue('Keep my failed draft'); await composer.press('Enter'); await expect(composer).toHaveValue('');
    expect(requests).toHaveLength(2); expect(requests[0]).toBeTruthy(); expect(requests[0]).toBe(requests[1]);
    await page.getByRole('button', { name: 'Edit message', exact: true }).click(); await page.getByPlaceholder('Edit message...').fill('Updated message');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('edit.png') });
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByText('Updated message', { exact: true })).toBeVisible();
    const deleteAction = page.getByTitle('Delete message', { exact: true });
    await deleteAction.click(); const dialog = page.getByRole('dialog', { name: 'Delete this message?', exact: true });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    // The closing dialog briefly retains a button with the same accessible name.
    // Wait for dismissal and target the message action, not that exiting button.
    await expect(dialog).toBeHidden(); expect(deletes).toBe(0);
    await deleteAction.click(); await dialog.getByRole('button', { name: 'Delete message', exact: true }).click();
    await expect(page.getByText('Updated message', { exact: true })).toHaveCount(0); expect(deletes).toBe(1); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
