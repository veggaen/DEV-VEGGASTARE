/** Hosted-safe UI fixtures; real writes run only in the isolated database test. */
import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`conversation deletion feedback and retry (${width}px ${theme})`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    try {
      await context.addInitScript(value => localStorage.setItem('veggat:theme', value), theme);
      const session = await (await context.request.get('/api/auth/session')).json(); expect(session.user?.isDemo).toBe(true);
      const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const id = 'qa-management-only'; let pending = true, cancelCount = 0, deleteCount = 0;
      // OWNER is deliberate: this role used to be omitted from the detail-page controls.
      await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, isDemo: false, role: 'OWNER' } } }));
      await page.route(`**/api/messages?conversationId=${id}`, route => route.fulfill({ json: { messages: [], users: [],
        conversation: { id, title: 'QA conversation', userId: 'other-creator', type: 'GROUP', isAnonymized: false,
          originalUserId: null, deletionRequestedAt: pending ? new Date().toISOString() : null,
          deletionScheduledFor: pending ? new Date(Date.now() + 86_400_000).toISOString() : null, deletionVisibility: 'PRIVATE' } } }));
      await page.route(`**/api/conversations/${id}*`, route => {
        expect(route.request().method()).toBe('DELETE');
        if (route.request().url().includes('cancel=true')) {
          cancelCount++;
          if (cancelCount === 1) return route.fulfill({ status: 503, json: {} });
          pending = false; return route.fulfill({ json: { restored: true } });
        }
        deleteCount++;
        return route.fulfill({ status: deleteCount === 1 ? 503 : 200, json: { deleted: deleteCount > 1 } });
      });
      await page.goto(`/conversations/${id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'QA conversation', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeEnabled();
      const refreshed = page.waitForResponse(response => response.url().endsWith('/api/auth/session'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await refreshed;
      const cancel = page.getByRole('button', { name: 'Cancel Deletion', exact: true });
      await expect(page.getByPlaceholder('Write a message…', { exact: true })).toBeDisabled();
      await cancel.click(); await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not confirm cancellation');
      await expect(cancel).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath('deletion-feedback.png') });
      await cancel.click(); await expect(cancel).toHaveCount(0); expect(cancelCount).toBe(2);
      await expect(page.getByPlaceholder('Write a message…', { exact: true })).toBeEnabled();
      const options = page.getByRole('button', { name: 'Conversation options', exact: true });
      await options.click(); await expect(page.getByRole('menuitem', { name: 'Mute notifications' })).toHaveCount(0);
      await page.getByRole('menuitem', { name: 'Delete conversation', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Delete this conversation?', exact: true });
      await expect(dialog).toContainText('for everyone');
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toBeHidden(); expect(deleteCount).toBe(0);
      await options.click(); await page.getByRole('menuitem', { name: 'Delete conversation', exact: true }).click();
      await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not confirm deletion');
      await options.click(); await page.getByRole('menuitem', { name: 'Delete conversation', exact: true }).click();
      await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page).toHaveURL(/\/conversations$/); expect(deleteCount).toBe(2); expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('management endpoints reject anonymous and read-only demo mutations', async ({ browser, baseURL }) => {
  for (const demo of [false, true]) {
    const context = await browser.newContext({ baseURL, ...(demo ? { storageState: process.env.E2E_DEMO_STORAGE_STATE } : {}) });
    try {
      for (const method of ['PATCH', 'DELETE']) {
        const response = await context.request.fetch('/api/conversations/qa-no-real-record', { method, headers: { Origin: baseURL! }, ...(method === 'PATCH' ? { data: { title: 'Must not save' } } : {}) });
        expect(response.status()).toBe(demo ? 403 : 401); expect(response.headers()['cache-control']).toContain('no-store');
      }
    } finally { await context.close(); }
  }
});

test('read-only demo does not offer destructive inbox or thread controls', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE, viewport: { width: 390, height: 844 } });
  try {
    const session = await (await context.request.get('/api/auth/session')).json(); expect(session.user?.isDemo).toBe(true);
    const page = await context.newPage();
    const item = { id: 'qa-readonly', title: 'Demo thread', type: 'GROUP', userId: session.user.id, participantDetails: [], messageCount: 0, lastMessage: null, updatedAt: new Date().toISOString() };
    await page.route('**/api/conversations?**', route => route.fulfill({ json: { conversations: [item], nextCursor: null } }));
    await page.route('**/api/messages?conversationId=qa-readonly', route => route.fulfill({ json: { messages: [], users: [], conversation: item } }));
    await page.goto('/conversations'); await page.getByRole('button', { name: 'Actions for Demo thread', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Open conversation', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Demo thread', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conversation options', exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});
