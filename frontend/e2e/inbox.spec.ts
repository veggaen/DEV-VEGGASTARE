/** @fileOverview Read-only hosted inbox QA; all conversation writes are intercepted. @stability active */
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

async function setup(browser: Browser, baseURL: string | undefined, width = 390, theme = 'dark') {
  const state = process.env.E2E_DEMO_STORAGE_STATE;
  expect(state).toBeTruthy();
  const context = await browser.newContext({ baseURL, storageState: state, viewport: { width, height: width === 844 ? 390 : width >= 1920 ? 1080 : 844 }, reducedMotion: 'reduce' });
  try {
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session.user?.isDemo).toBe(true);
    await context.addInitScript((color) => { localStorage.setItem('veggat:theme', color); }, theme);
    return { context, userId: String(session.user.id) };
  } catch (error) { await context.close(); throw error; }
}
function conversation(id: string, userId: string, title = 'Project notes') {
  return { id, title, userId, type: 'GROUP', participantDetails: [{ id: userId, name: 'QA' }, { id: 'other', name: 'Teammate' }], participants: [userId, 'other'], description: 'Release discussion',
    isPinned: false, isLocked: false, lastMessage: { content: 'Latest reply, not the original message', createdAt: '2026-09-25T12:00:00Z' }, messageCount: 3, createdAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-25T12:00:00Z' };
}
async function detailStub(context: BrowserContext, userId: string) {
  await context.route('**/api/messages?conversationId=**', route => route.fulfill({ json: { messages: [], users: [], conversation: conversation('cqainbox', userId) } }));
}

for (const width of [360, 390, 844, 768, 1024, 1280, 1920, 2560]) test(`inbox layout, touch actions, keyboard links and search (${width}px)`, async ({ browser, baseURL }, info) => {
  const { context, userId } = await setup(browser, baseURL, width);
  try {
    const page = await context.newPage(); const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/conversations?**', route => route.fulfill({ json: { conversations: [conversation('cqainbox', userId), conversation('cqalong', 'another', 'Long group name '.repeat(18)), ...Array.from({ length: 10 }, (_, i) => conversation(`cqascroll${i}`, 'another', `Scroll group ${i}`))], nextCursor: null } }));
    await detailStub(context, userId);
    await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    const list = page.getByRole('list', { name: 'Conversations', exact: true });
    const actions = page.getByRole('button', { name: 'Actions for Project notes', exact: true });
    await expect(actions).toBeVisible(); expect((await actions.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await actions.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Copy link', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape'); await expect(actions).toBeFocused();
    await page.getByRole('searchbox', { name: 'Search conversations' }).fill('unmatched words');
    await expect(page.getByRole('heading', { name: 'No matching conversations' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByRole('searchbox', { name: 'Search conversations' })).toBeFocused();
    await expect(list.getByRole('link')).toHaveCount(12);
    const shot = info.outputPath('inbox.png'); await page.screenshot({ path: shot }); await info.attach('inbox', { path: shot, contentType: 'image/png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.getByRole('button', { name: 'Actions for Scroll group 9', exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Actions for Scroll group 9', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Open conversation', exact: true })).toBeInViewport();
    await page.keyboard.press('Escape');
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded(); await expect(page.getByRole('contentinfo')).toBeInViewport();
    await list.getByRole('link').first().press('Enter');
    await expect(page).toHaveURL(/\/conversations\/cqainbox$/);
    await expect(page.getByRole('heading', { name: 'Project notes', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to messages', exact: true }).click();
    await expect(actions).toBeEnabled();
    await expect(page.getByRole('link', { name: 'New chat', exact: true })).toHaveAttribute('href', '/conversations/new');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const [width, theme] of [[390, 'light'], [1280, 'dark']] as const) test(`inbox action feedback, pagination and privacy recovery (${width}px ${theme})`, async ({ browser, baseURL }, info) => {
  const { context, userId } = await setup(browser, baseURL, width, theme);
  try {
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    let state: 'ready' | 'scheduled' | 'deleted' = 'ready'; let failure = false; let accessLost = false; let listFailure = true; let pageFailure = true; let copies = 0; let deletes = 0;
    await page.exposeFunction('qaCopy', () => { copies++; if (copies === 1) throw new Error('Clipboard unavailable'); });
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: (text: string) => (window as unknown as { qaCopy(text: string): Promise<void> }).qaCopy(text) } }));
    await page.route('**/api/conversations?**', async route => {
      const url = new URL(route.request().url());
      if (accessLost) return route.fulfill({ status: 401, json: {} });
      if (listFailure) return route.fulfill({ status: 503, json: {} });
      if (url.searchParams.has('cursor')) {
        if (pageFailure) return route.fulfill({ status: 503, json: {} });
        return route.fulfill({ json: { conversations: [conversation('cqasecondpage', 'other', 'Older group')], nextCursor: null } });
      }
      const item = { ...conversation('cqainbox', userId), deletionScheduledFor: state === 'scheduled' ? '2027-01-01T12:00:00Z' : null };
      return route.fulfill({ json: { conversations: state === 'deleted' ? [] : [item], nextCursor: state === 'deleted' ? null : 'cqainbox' } });
    });
    await page.route('**/api/conversations/cqainbox?**', route => {
      expect(route.request().method()).toBe('DELETE'); deletes++;
      if (failure) return route.fulfill({ status: 503, json: {} });
      if (route.request().url().includes('cancel=true')) { state = 'ready'; return route.fulfill({ json: { restored: true } }); }
      state = 'scheduled'; return route.fulfill({ json: { scheduled: true } });
    });
    await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not load messages');
    listFailure = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    const actions = page.getByRole('button', { name: 'Actions for Project notes', exact: true }); await expect(actions).toBeVisible();
    await actions.click(); await page.getByRole('menuitem', { name: 'Copy link', exact: true }).click();
    await expect(page.getByText('Could not copy the link. Open the conversation and copy its address.', { exact: true })).toBeVisible();
    await actions.click(); await page.getByRole('menuitem', { name: 'Copy link', exact: true }).click(); await expect(page.getByText('Link copied', { exact: true })).toBeVisible();
    await actions.click(); await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this conversation?', exact: true });
    await expect(dialog).toContainText('for everyone'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(deletes).toBe(0);
    await actions.click(); await page.getByRole('menuitem', { name: 'Delete', exact: true }).click(); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Conversations', exact: true })).toContainText('Deletion scheduled'); expect(deletes).toBe(1);
    failure = true; await actions.click(); await page.getByRole('menuitem', { name: 'Cancel deletion', exact: true }).click();
    await expect(page.getByText('Could not cancel deletion. Try again.', { exact: true })).toBeVisible();
    failure = false; await actions.click(); await page.getByRole('menuitem', { name: 'Cancel deletion', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Conversations', exact: true })).not.toContainText('Deletion scheduled');
    await page.getByRole('button', { name: 'Load more conversations', exact: true }).click();
    await expect(actions).toBeVisible(); await expect(page.getByRole('button', { name: 'Retry loading more', exact: true })).toBeVisible();
    pageFailure = false; await page.getByRole('button', { name: 'Retry loading more', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Older group', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Actions for Older group', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0); await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Sort conversations', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Unread First', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Newest conversations', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Older group', exact: true })).toHaveCount(0);
    await expect(actions).toBeVisible(); const shot = info.outputPath('inbox-actions.png'); await page.screenshot({ path: shot }); await info.attach('inbox-actions', { path: shot, contentType: 'image/png' });
    accessLost = true; await page.getByRole('button', { name: 'Load more conversations', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Sign in again'); await expect(actions).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
