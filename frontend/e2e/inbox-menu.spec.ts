/** @fileOverview Responsive, read-only Messages popover and skeleton QA. @stability active */
import { expect, test, type Browser } from '@playwright/test';
async function setup(browser: Browser, baseURL: string | undefined, width: number, height: number, theme = 'dark') {
  expect(process.env.E2E_DEMO_STORAGE_STATE).toBeTruthy();
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height }, hasTouch: width < 1024, isMobile: width < 768, reducedMotion: 'reduce' });
  try {
    const session = await (await context.request.get('/api/auth/session')).json(); expect(session.user?.isDemo).toBe(true);
    await context.addInitScript(value => localStorage.setItem('veggat:theme', value), theme);
    return { context, userId: session.user.id as string };
  } catch (error) { await context.close(); throw error; }
}
const rows = (userId: string) => Array.from({ length: 8 }, (_, i) => ({
  id: `cqapreview${i}`, title: i === 0 ? 'Direct message' : `Project ${i} ${'long name '.repeat(15)}`, type: i === 0 ? 'PRIVATE_DM' : 'GROUP',
  userId, updatedAt: '2026-09-26T10:00:00Z', participantDetails: [{ id: userId, name: 'QA' }, { id: 'other', name: 'Alex River' }], participants: [userId, 'other'],
  lastMessage: { content: i === 1 ? '' : `Latest message ${i}`, createdAt: '2026-09-26T10:00:00Z', senderId: i === 0 ? userId : 'other', imageUrl: i === 1 ? '/image.png' : null }, messageCount: 2,
}));
for (const [width, height] of [[360, 800], [390, 844], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1920, 1080], [2560, 1080]]) {
  test(`Messages preview fits, scrolls and navigates (${width}x${height})`, async ({ browser, baseURL }, info) => {
    const { context, userId } = await setup(browser, baseURL, width, height);
    try {
      const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      let releaseInbox!: () => void;
      const gate = new Promise<void>(resolve => { releaseInbox = resolve; });
      await page.route('**/api/conversations?**', async route => {
        const url = new URL(route.request().url());
        if (url.searchParams.get('limit') === '8') { expect(url.searchParams.get('sort')).toBe('active'); }
        else await gate;
        await route.fulfill({ json: { conversations: rows(userId), nextCursor: null } });
      });
      await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
      const skeleton = page.getByRole('main').getByRole('status');
      await expect(skeleton).toContainText('Loading conversations');
      const firstPlaceholder = skeleton.locator(':scope > div').first();
      const before = (await firstPlaceholder.boundingBox())!;
      releaseInbox();
      const firstRow = page.getByRole('list', { name: 'Conversations', exact: true }).locator(':scope > li').first();
      await expect(firstRow).toBeVisible(); const after = (await firstRow.boundingBox())!;
      expect(Math.abs(before.height - after.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(1);
      const trigger = page.getByRole('banner').getByRole('button', { name: 'Messages', exact: true });
      expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await trigger.press('Enter');
      const panel = page.getByRole('dialog', { name: 'Recent messages', exact: true });
      const list = panel.getByRole('list', { name: 'Recent conversations', exact: true });
      await expect(list.getByRole('link')).toHaveCount(8);
      await expect(list).toContainText('Alex River'); await expect(list).toContainText('You: Latest message 0'); await expect(list).toContainText('Photo');
      if (width >= 1024) await expect(panel.getByRole('searchbox')).toBeFocused();
      else await expect(panel.getByRole('searchbox')).not.toBeFocused();
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1); expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
      await expect(panel.getByRole('link', { name: 'Open full inbox', exact: true })).toBeInViewport();
      await list.getByRole('link').last().scrollIntoViewIfNeeded(); await expect(list.getByRole('link').last()).toBeInViewport();
      await expect(panel.getByRole('link', { name: 'New chat', exact: true })).toBeInViewport();
      const search = panel.getByRole('searchbox'); await search.fill('not-in-this-inbox');
      await expect(panel.getByRole('status')).toContainText('No matching recent chats');
      await panel.getByRole('button', { name: 'Clear search', exact: true }).first().click(); await expect(search).toBeFocused();
      await search.fill('Latest message 7'); await expect(list.getByRole('link')).toHaveCount(1);
      await search.fill(''); await expect(list.getByRole('link')).toHaveCount(8);
      const shot = info.outputPath('messages-menu.png'); await page.screenshot({ path: shot }); await info.attach('Messages menu', { path: shot, contentType: 'image/png' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible(); await expect(trigger).toBeFocused();
      await trigger.click(); await panel.getByRole('link', { name: 'New chat', exact: true }).click();
      await expect(page).toHaveURL(/\/conversations\/new$/); await expect(page.getByRole('main').getByRole('heading', { name: 'New Conversation', exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

for (const [width, theme] of [[390, 'light'], [1280, 'dark']] as const) test(`Messages preview retry, empty and access-loss states (${width}px ${theme})`, async ({ browser, baseURL }) => {
  const { context, userId } = await setup(browser, baseURL, width, 844, theme);
  try {
    const page = await context.newPage(); let status = 503; let empty = false; let previewRequests = 0;
    await page.route('**/api/conversations?**', route => {
      if (new URL(route.request().url()).searchParams.get('limit') !== '8') return route.fulfill({ json: { conversations: [], nextCursor: null } });
      previewRequests++;
      return route.fulfill({ status, json: status === 200 ? { conversations: empty ? [] : rows(userId), nextCursor: null } : {} });
    });
    await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
    const trigger = page.getByRole('banner').getByRole('button', { name: 'Messages', exact: true }); await expect(trigger).toBeVisible(); expect(previewRequests).toBe(0);
    const panel = page.getByRole('dialog', { name: 'Recent messages', exact: true });
    await trigger.click(); await expect(panel.getByRole('alert')).toContainText('Could not load messages');
    await expect(panel.getByText('No conversations yet', { exact: true })).toHaveCount(0);
    status = 200; await panel.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(panel.getByRole('list').getByRole('link')).toHaveCount(8);
    await panel.getByRole('button', { name: 'Close messages', exact: true }).click(); await expect(panel).not.toBeVisible();
    await expect(trigger).toBeFocused(); status = 401; await trigger.click(); await expect(panel.getByRole('alert')).toContainText('Sign in again');
    await expect(panel.getByRole('list')).toHaveCount(0);
    await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible(); status = 200; empty = true; await trigger.click(); await expect(panel.getByRole('status')).toContainText('No conversations yet');
    await panel.getByRole('link', { name: 'Open full inbox', exact: true }).click(); await expect(panel).not.toBeVisible();
  } finally { await context.close(); }
});
