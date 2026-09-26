import { expect, test, type Browser } from '@playwright/test';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=', 'base64');
const image = { id: 'cqaimage000000000000000001', width: 1, height: 1 };
async function setup(browser: Browser, width: number, balance = 100) {
  const context = await browser.newContext({ baseURL: 'http://localhost:3000', storageState: '.private-showcase/image-qa-local.json', colorScheme: 'dark', viewport: { width, height: width === 844 ? 390 : width >= 1280 ? 800 : 844 } });
  const user = (await (await context.request.get('/api/auth/session')).json()).user;
  expect(user?.id).toMatch(/^cqaimage/); // Only the disposable isolated fixture.
  const page = await context.newPage();
  const state = { uploads: 0, sends: 0, saves: 0, failImage: false, truncated: false, imageIds: [] as string[] };
  const rows = [{ id: 'qa-alpha', title: 'Alpha', updatedAt: '2026-09-26T00:00:00Z' }, { id: 'qa-beta', title: 'Beta', updatedAt: '2026-09-26T00:00:00Z' }];
  await page.route('**/api/ai-chat/config', route => route.fulfill({ json: { balance, authenticated: true, demo: false, dailyUsed: 0, dailyLimit: 20, savedProviders: [], models: [
    { provider: 'GOOGLE', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', available: true, credits: 0 },
    { provider: 'OPENAI', model: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', available: true, credits: 2, imageCredits: 1 },
  ] } }));
  await page.route('**/api/ai-chat/sessions**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    if (path === '/api/ai-chat/sessions') await route.fulfill({ json: method === 'POST' ? { id: 'qa-created' } : { sessions: rows, nextCursor: null } });
    else if (path.endsWith('/messages')) { state.saves++; state.imageIds = route.request().postDataJSON().imageIds; await route.fulfill({ json: { success: true } }); }
    else if (path.endsWith('/title')) await route.fulfill({ json: { ok: true, title: 'Image chat' } });
    else { const id = path.split('/').at(-1); await route.fulfill({ json: { id, title: rows.find(row => row.id === id)?.title ?? 'Image chat', creatorId: user.id, isPublic: false, isSuspended: false, participants: [], messages: state.saves && id === 'qa-created' ? [
      { id: 'human', role: 'user', content: 'Describe this image', images: [image], participant: { type: 'HUMAN' } },
      { id: 'assistant', role: 'assistant', content: 'A green square.', participant: { type: 'AI_PLATFORM' } },
    ] : [] } }); }
  });
  await page.route('**/api/ai-chat/images**', async route => {
    if (route.request().method() === 'POST') { state.uploads++; await route.fulfill(state.failImage ? { status: 503, json: { message: 'Image upload unavailable. Please retry.' } } : { json: image }); }
    else await route.fulfill({ contentType: 'image/png', body: pixel });
  });
  await page.route('**/api/ai-chat', async route => {
    state.sends++;
    const ids = route.request().postDataJSON().messages.flatMap((message: { imageIds?: string[] }) => message.imageIds ?? []);
    expect(new Set(ids).size).toBe(ids.length);
    expect(route.request().postDataJSON().messages.at(-1).imageIds).toEqual([image.id]);
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"text":"A green square."}\n\n' + (state.truncated ? '' : 'data: [DONE]\n\n') });
  });
  return { page, context, state };
}
for (const width of [390, 844, 1280, 2560]) test(`image drafts stay private to each chat and fit ${width}px`, async ({ browser }, info) => {
  const { page, context, state } = await setup(browser, width);
  const rail = async () => {
    const nav = page.getByRole('navigation', { name: 'AI conversations' }).filter({ visible: true });
    if (!await nav.isVisible()) await page.getByRole('button', { name: 'Open conversations' }).filter({ visible: true }).click();
    return nav;
  };
  try {
    await page.goto('/ai'); await page.waitForLoadState('networkidle');
    await page.getByLabel('Choose chat images').setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer: pixel });
    await page.getByRole('textbox', { name: 'AI message' }).fill('New image draft');
    await expect(page.getByRole('button', { name: 'Remove new.png' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
    await (await rail()).getByRole('link', { name: 'Alpha', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove new.png' })).toHaveCount(0);
    await page.getByLabel('Choose chat images').setInputFiles({ name: 'alpha.png', mimeType: 'image/png', buffer: pixel });
    await (await rail()).getByRole('link', { name: 'Beta', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Beta', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove alpha.png' })).toHaveCount(0);
    await (await rail()).getByRole('link', { name: 'Alpha', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove alpha.png' })).toBeVisible();
    await page.getByRole('button', { name: 'Choose GPT-5.6 Luna', exact: true }).click();
    await expect(page.getByText('Up to 3 credits / message', { exact: true })).toBeVisible();
    expect(state.uploads).toBe(0); expect(state.sends).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    const composer = await page.locator('[data-ai-composer]').filter({ visible: true }).boundingBox();
    expect(composer!.y).toBeGreaterThanOrEqual(0); expect(composer!.y + composer!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.screenshot({ path: info.outputPath('image-draft.png') });
    await page.getByRole('button', { name: 'Remove alpha.png' }).click();
    await expect(page.getByRole('button', { name: 'Remove alpha.png' })).toHaveCount(0);
  } finally { await context.close(); }
});
test('upload failure and truncated reply preserve the image; retry saves it once', async ({ browser }) => {
  const { page, context, state } = await setup(browser, 1280);
  try {
    await page.goto('/ai');
    await page.getByLabel('Choose chat images').setInputFiles({ name: 'retry.png', mimeType: 'image/png', buffer: pixel });
    await page.getByRole('button', { name: 'Choose GPT-5.6 Luna', exact: true }).click();
    await page.getByRole('textbox', { name: 'AI message' }).fill('Describe this image');
    state.failImage = true;
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Image upload unavailable' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'AI message' })).toHaveValue('Describe this image');
    await expect(page.getByRole('button', { name: 'Remove retry.png' })).toBeVisible();
    expect(state.sends).toBe(0); expect(state.saves).toBe(0);
    state.failImage = false; state.truncated = true;
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'interrupted before completion' })).toBeVisible();
    expect(state.saves).toBe(0);
    state.truncated = false;
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page).toHaveURL(/\/ai\/qa-created$/);
    await expect(page.getByRole('link', { name: 'Open attached image 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose AI model: GPT-5.6 Luna', exact: true })).toBeVisible();
    expect(state.uploads).toBe(2); expect(state.saves).toBe(1); expect(state.imageIds).toEqual([image.id]);
  } finally { await context.close(); }
});
test('zero balance blocks image generation before upload and invalid files stay out', async ({ browser }) => {
  const { page, context, state } = await setup(browser, 390, 0);
  try {
    await page.goto('/ai');
    await page.getByLabel('Choose chat images').setInputFiles({ name: 'secret.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await expect(page.getByRole('alert').filter({ hasText: 'under 4 MB' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove secret.svg' })).toHaveCount(0);
    await page.getByLabel('Choose chat images').setInputFiles({ name: 'zero.png', mimeType: 'image/png', buffer: pixel });
    await page.getByRole('button', { name: 'Choose GPT-5.6 Luna', exact: true }).click();
    await expect(page.getByText('This message needs 3 credits.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
    expect(state.uploads).toBe(0); expect(state.sends).toBe(0);
  } finally { await context.close(); }
});
