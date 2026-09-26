import { expect, test, type Page, type Browser, type BrowserContext } from '@playwright/test';

const viewportHeight = (width: number) => width === 844 ? 390 : width >= 1920 ? 1080 : width === 1024 ? 1600 : width === 1280 ? 800 : 844;

async function setup(browser: Browser, baseURL: string | undefined, width = 1280, guest = false) {
  const context = await browser.newContext({ baseURL, colorScheme: process.env.E2E_THEME === 'dark' ? 'dark' : 'light', storageState: guest ? undefined : process.env.E2E_DEMO_STORAGE_STATE, viewport: { width, height: viewportHeight(width) } });
  if (!guest) { const identity = await (await context.request.get('/api/auth/session')).json(); expect(identity.user?.isDemo).toBe(true); }
  const page = await context.newPage();
  const state = { creates: 0, sends: 0, saves: 0, fail: false, delay: false };
  const rows = [{ id: 'qa-chat-a', title: 'Alpha', updatedAt: '2026-09-26T00:00:00Z' }, { id: 'qa-chat-b', title: 'Beta', updatedAt: '2026-09-25T00:00:00Z' }];
  const message = { id: 'reply', role: 'assistant', content: '## Result\n\n**Readable** reply.\n\n```js\nconst example = "' + 'wide'.repeat(70) + '";\n```\n\n| A | B |\n| --- | --- |\n| One | Two |', participant: { type: 'AI_PLATFORM', displayName: 'QA model' }, createdAt: '2026-09-26T00:00:00Z', modelUsed: null };
  await page.route('**/api/ai-chat/config', route => route.fulfill({ json: { balance: 0, authenticated: !guest, demo: !guest, environment: 'sandbox', dailyUsed: 0, dailyLimit: 20, savedProviders: [], models: [
    { provider: 'GOOGLE', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', credits: 0, available: true },
    { provider: 'OPENAI', model: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', credits: 2, available: true },
  ] } }));
  await page.route('**/api/ai-chat/sessions**', async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.pathname === '/api/ai-chat/sessions' && method === 'POST') { state.creates++; await route.fulfill({ json: { id: 'qa-created-chat' }, status: 201 }); }
    else if (url.pathname === '/api/ai-chat/sessions') await route.fulfill({ json: { sessions: rows, nextCursor: null } });
    else if (url.pathname.endsWith('/messages') && method === 'POST') { state.saves++; await route.fulfill({ json: { success: true } }); }
    else if (url.pathname.endsWith('/title')) await route.fulfill({ json: { ok: true, title: 'QA conversation' } });
    else { const id = url.pathname.split('/').at(-1)!; await route.fulfill({ json: { id, title: rows.find(row => row.id === id)?.title ?? 'QA conversation', isPublic: false, isSuspended: false, creatorId: 'qa', participants: [], messages: id === 'qa-chat-a' || state.saves ? [message] : [] } }); }
  });
  await page.route('**/api/ai-chat', async route => {
    state.sends++;
    if (state.delay) await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill(state.fail ? { status: 503, json: { message: 'Provider unavailable. Please retry.' } } : { contentType: 'text/event-stream', body: 'data: {"text":"A clear answer."}\n\ndata: [DONE]\n\n' });
  });
  return { page, context, state };
}
async function rail(page: Page) {
  const nav = page.getByRole('navigation', { name: 'AI conversations', exact: true }).filter({ visible: true });
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Open conversations', exact: true }).filter({ visible: true }).click();
  await expect(nav).toBeVisible(); return nav;
}

for (const width of [360, 390, 844, 768, 1024, 1280, 1920, 2560]) test(`blank canvas, transcript and drawer fit ${width}px`, async ({ browser, baseURL }, info) => {
  const { page, context, state } = await setup(browser, baseURL, width);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/ai'); await expect(page.getByRole('textbox', { name: 'AI message', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
    await expect(page.getByText('Draft & rewrite', { exact: true })).toHaveCount(0);
    expect(state.creates).toBe(0); expect(state.sends).toBe(0);
    await expect(page.locator('[data-ai-composer]').filter({ visible: true })).toHaveCount(1);
    const composer = await page.locator('[data-ai-composer]').filter({ visible: true }).boundingBox();
    expect(composer!.x).toBeGreaterThanOrEqual(0); expect(composer!.x + composer!.width).toBeLessThanOrEqual(width); expect(composer!.y + composer!.height).toBeLessThanOrEqual(viewportHeight(width));
    await page.screenshot({ path: info.outputPath('new-chat.png') });
    await (await rail(page)).getByRole('link', { name: 'Alpha', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Result', exact: true })).toBeVisible();
    await expect(page.getByLabel('Code block')).toBeVisible();
    const transcript = await page.locator('[data-ai-transcript]').filter({ visible: true }).boundingBox();
    expect(transcript!.height).toBeGreaterThan(width === 844 ? 90 : 150);
    expect(transcript!.y + transcript!.height).toBeLessThanOrEqual((await page.locator('[data-ai-composer]').filter({ visible: true }).boundingBox())!.y + 1);
    await page.locator('[data-ai-transcript]').hover(); await page.mouse.wheel(0, -2000);
    await expect(page.getByRole('heading', { name: 'Result', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: info.outputPath('conversation.png') });
    await page.getByRole('button', { name: /Choose AI model:/ }).click();
    await expect(page.getByRole('dialog', { name: 'Choose AI model', exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: 'Choose AI model', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('text drafts stay separate and reorder supports mouse and keyboard', async ({ browser, baseURL }) => {
  const { page, context } = await setup(browser, baseURL);
  try {
    await page.goto('/ai'); const input = page.getByRole('textbox', { name: 'AI message', exact: true });
    await input.fill('Unsent new chat');
    await (await rail(page)).getByRole('link', { name: 'Alpha', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible(); await input.fill('Draft Alpha');
    await (await rail(page)).getByRole('link', { name: 'Beta', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Beta', exact: true })).toBeVisible(); await expect(input).toHaveValue(''); await input.fill('Draft Beta');
    await (await rail(page)).getByRole('link', { name: 'Alpha', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible(); await expect(input).toHaveValue('Draft Alpha');
    await page.getByRole('link', { name: 'Back to AI chats', exact: true }).click(); await expect(page.getByRole('heading', { name: 'New chat', exact: true })).toBeVisible(); await expect(input).toHaveValue('Unsent new chat');
    let nav = await rail(page); await nav.getByRole('button', { name: 'Options for Alpha' }).click(); await page.getByRole('menuitem', { name: 'Move down', exact: true }).click();
    await expect(nav.locator('a[href^="/ai/qa-chat-"]')).toHaveText(['Beta', 'Alpha']);
    await nav.getByRole('button', { name: 'Reorder Alpha', exact: true }).press('ArrowUp');
    await expect(nav.locator('a[href^="/ai/qa-chat-"]')).toHaveText(['Alpha', 'Beta']);
    await nav.getByRole('button', { name: 'Reorder Beta', exact: true }).dragTo(nav.getByRole('button', { name: 'Reorder Alpha', exact: true }));
    await expect(nav.locator('a[href^="/ai/qa-chat-"]')).toHaveText(['Beta', 'Alpha']);
    await page.reload(); nav = await rail(page); await expect(nav.locator('a[href^="/ai/qa-chat-"]')).toHaveText(['Beta', 'Alpha']);
  } finally { await context.close(); }
});

test('first send creates once, failure preserves draft, retry saves, zero balance blocks premium', async ({ browser, baseURL }) => {
  const { page, context, state } = await setup(browser, baseURL);
  try {
    await page.goto('/ai'); const input = page.getByRole('textbox', { name: 'AI message', exact: true });
    await input.fill('Hello QA'); state.fail = true;
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Provider unavailable' })).toBeVisible(); await expect(input).toHaveValue('Hello QA'); expect(state.creates).toBe(1);
    state.fail = false; state.delay = true;
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop response', exact: true })).toBeVisible(); await input.fill('Follow-up draft');
    await expect(page).toHaveURL(/\/ai\/qa-created-chat$/); await expect(input).toHaveValue('Follow-up draft');
    expect(state.creates).toBe(1); expect(state.sends).toBe(2); expect(state.saves).toBe(1);
    await page.getByRole('button', { name: /Choose AI model:/ }).click(); await page.getByRole('button', { name: 'GPT-5.6 Luna 2 credits', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled(); await expect(input).toHaveValue('Follow-up draft'); expect(state.sends).toBe(2);
  } finally { await context.close(); }
});

for (const width of [390, 1280]) test(`guest home exposes clean usable composer at ${width}px`, async ({ browser, baseURL }, info) => {
  const { page, context, state } = await setup(browser, baseURL, width, true);
  try {
    await page.goto('/'); const input = page.getByRole('textbox', { name: 'AI message', exact: true });
    await expect(input).toBeVisible(); await input.fill('An unsent homepage draft');
    expect(state.sends).toBe(0); expect(state.creates).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: info.outputPath('home-composer.png') });
  } finally { await context.close(); }
});
