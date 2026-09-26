import { expect, test } from '@playwright/test';

for (const [width, height] of [[360, 800], [390, 844], [844, 390], [1280, 800], [2560, 1080]]) {
  test(`new conversation preserves drafts, retries safely and navigates (${width}px)`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE,
      viewport: { width, height }, reducedMotion: 'reduce' });
    try {
      await context.addInitScript(theme => localStorage.setItem('veggat:theme', theme), process.env.E2E_THEME === 'light' ? 'light' : 'dark');
      const session = await (await context.request.get('/api/auth/session')).json();
      expect(session.user?.isDemo).toBe(true);
      const page = await context.newPage(), errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const submissions: { requestId: string; initialMessage: string; participants: string[] }[] = [];
      // Client-only fixture. Every mutation and people lookup is intercepted;
      // the real server session remains read-only demo on local and hosted runs.
      await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user, id: 'ui_fixture_only', isDemo: false } } }));
      await page.route('**/api/users/search?*', route => route.fulfill({ json: { users: [{ id: 'qa-peer', name: 'QA Recipient', email: null, image: '', role: null, bio: null, followerCount: 0, isFollowing: false }], count: 1 } }));
      await page.route('**/api/conversations', route => {
        if (route.request().method() !== 'POST') return route.continue();
        submissions.push(route.request().postDataJSON());
        return route.fulfill({ status: submissions.length < 3 ? 503 : 201, json: submissions.length < 3 ? { message: 'Fixture failure' } : { id: 'qa-created-conversation' } });
      });
      await page.route('**/api/messages?conversationId=qa-created-conversation', route => route.fulfill({ json: { messages: [], users: [],
        conversation: { id: 'qa-created-conversation', title: 'QA group', type: 'GROUP', userId: 'ui_fixture_only', isAnonymized: false, deletionRequestedAt: null, deletionScheduledFor: null, deletionVisibility: null } } }));
      await page.goto('/conversations/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'New Conversation', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeEnabled();
      const refreshed = page.waitForResponse(response => response.url().endsWith('/api/auth/session'), { timeout: 15_000 });
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await refreshed;
      await page.getByRole('button', { name: 'Group Chat', exact: true }).click();
      await page.getByLabel('Group name', { exact: true }).fill('QA group');
      await page.getByLabel('Add people', { exact: true }).fill('QA');
      await page.getByRole('button', { name: 'QA Recipient', exact: true }).focus(); await page.keyboard.press('Enter');
      const message = page.getByLabel('Message (optional)', { exact: true });
      await message.fill('My first draft');
      await expect.poll(() => message.evaluate(el => { const style = getComputedStyle(el); return { shadow: style.boxShadow.includes('3px'), outline: style.outlineWidth, focused: el.matches(':focus-visible') }; })).toEqual({ shadow: false, outline: '2px', focused: true });
      const submit = page.getByRole('button', { name: 'Start Conversation', exact: true });
      await submit.click();
      await expect(page.getByRole('form', { name: 'New conversation' }).getByRole('alert')).toContainText('Your draft is still here');
      await expect(message).toHaveValue('My first draft');
      await submit.click(); await expect(submit).toBeEnabled();
      expect(submissions).toHaveLength(2); expect(submissions[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
      expect(submissions[1].requestId).toBe(submissions[0].requestId);
      await message.fill('Changed draft');
      await submit.scrollIntoViewIfNeeded(); await expect(submit).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath('new-conversation.png') });
      await submit.click();
      await expect(page.getByRole('heading', { name: 'QA group', exact: true })).toBeVisible();
      expect(submissions[2].requestId).not.toBe(submissions[0].requestId);
      expect(submissions[2]).toMatchObject({ initialMessage: 'Changed draft', participants: ['qa-peer'] });
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('anonymous and demo users cannot create conversations', async ({ browser, baseURL }) => {
  const anonymous = await browser.newContext({ baseURL });
  const demo = await browser.newContext({ baseURL, storageState: process.env.E2E_DEMO_STORAGE_STATE });
  try {
    for (const [context, status] of [[anonymous, 401], [demo, 403]] as const) {
      const result = await context.request.post('/api/conversations', { headers: { Origin: baseURL! }, data: { participants: ['not-a-real-user'] } });
      expect(result.status()).toBe(status); expect(result.headers()['cache-control']).toContain('no-store');
    }
  } finally { await anonymous.close(); await demo.close(); }
});

test('isolated database: concurrent starts, first message, replay and privacy', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_CONVERSATION_DB !== 'isolated-preview', 'Requires isolated Preview database launcher; never run on Live');
  test.setTimeout(120_000);
  expect(baseURL).toBe('http://localhost:3000');
  expect(process.env.VERCEL_ENV).toBe('preview');
  expect(process.env.DATABASE_URL_MAINPREVIEW).toBeTruthy();
  expect(process.env.DATABASE_URL_MAINLIVE).toBeFalsy();
  const { Pool } = await import('pg');
  const { randomBytes, randomUUID } = await import('node:crypto');
  const { default: bcrypt } = await import('bcryptjs');
  const database = new URL(process.env.DATABASE_URL_MAINPREVIEW!); database.searchParams.set('uselibpqcompat', 'true');
  const pool = new Pool({ connectionString: database.toString(), max: 2 });
  const suffix = randomBytes(12).toString('hex');
  const users = ['a', 'b'].map(letter => ({ id: `qa_create_${suffix}_${letter}`, email: `qa_create_${suffix}_${letter}@example.invalid`, password: randomBytes(24).toString('base64url') }));
  const contexts = await Promise.all(users.map(() => browser.newContext({ baseURL })));
  try {
    for (const [index, user] of users.entries()) {
      await pool.query('INSERT INTO "User" (id,name,email,password,"emailVerified","updatedAt","web3ModeEnabled","emailDisplayMode") VALUES ($1,$2,$3,$4,NOW(),NOW(),false,\'HIDE\')', [user.id, 'QA conversation fixture', user.email, await bcrypt.hash(user.password, 12)]);
      const api = contexts[index].request;
      const csrf = await (await api.get('/api/auth/csrf')).json();
      await api.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: user.email, password: user.password, callbackUrl: `${baseURL}/conversations` }, headers: { 'X-Auth-Return-Redirect': '1', Origin: baseURL! } });
      // Boolean assertion avoids printing any session data or credentials on failure.
      expect((await (await api.get('/api/auth/session')).json()).user?.id === user.id).toBe(true);
    }
    const create = (index: number, data: Record<string, unknown>) => contexts[index].request.post('/api/conversations', { data, headers: { Origin: baseURL! } });
    expect((await create(0, { participants: [users[1].email] })).status()).toBe(400);
    expect((await create(0, { participants: [users[1].id], visibility: 'PUBLIC' })).status()).toBe(400);
    const attempts = users.map((_, index) => ({ participants: [users[1 - index].id], initialMessage: `QA first message ${index}`, requestId: randomUUID() }));
    const responses = await Promise.all(attempts.map((body, index) => create(index, body)));
    expect(responses.map(response => response.status()).sort()).toEqual([200, 201]);
    const records = await Promise.all(responses.map(response => response.json()));
    expect(records[0].id).toBe(records[1].id);
    const dmId = records[0].id;
    for (let index = 0; index < 2; index++) expect((await create(index, attempts[index])).status()).toBe(200);
    const stored = (await pool.query('SELECT "replyCount" FROM "Conversation" WHERE id=$1', [dmId])).rows[0];
    expect(stored.replyCount).toBe(2);
    expect(Number((await pool.query('SELECT COUNT(*) FROM "Message" WHERE "conversationId"=$1', [dmId])).rows[0].count)).toBe(2);
    const read = await contexts[0].request.get(`/api/messages?conversationId=${dmId}`);
    expect(read.status()).toBe(200); expect((await read.json()).messages).toHaveLength(2);
    const group = { type: 'GROUP', title: 'QA retry group', participants: [users[1].id], initialMessage: 'Exactly once', requestId: randomUUID() };
    const groupResults = await Promise.all([create(0, group), create(0, group)]);
    expect(groupResults.map(response => response.status()).sort()).toEqual([200, 201]);
    const groupRows = await Promise.all(groupResults.map(response => response.json()));
    expect(groupRows[0].id).toBe(groupRows[1].id);
    expect(Number((await pool.query('SELECT COUNT(*) FROM "Message" WHERE "conversationId"=$1', [groupRows[0].id])).rows[0].count)).toBe(1);
    expect((await create(0, { ...group, initialMessage: 'Changed under same request ID' })).status()).toBe(409);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    // Exact random fixture IDs in an explicitly isolated database. Never touch real users.
    const ids = users.map(user => user.id);
    await pool.query('DELETE FROM "Message" WHERE "senderId" = ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM "Conversation" WHERE "userId" = ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM "User" WHERE id = ANY($1::text[])', [ids]);
    await pool.end();
  }
});
