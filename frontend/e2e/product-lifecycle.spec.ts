/** @fileOverview Real isolated-account company/product lifecycle; no mocked business writes. @stability active */
import { expect, test, type BrowserContext } from '@playwright/test';

for (const width of [360, 390, 1280, 2560]) test(`isolated company/product lifecycle (${width}px)`, async ({ browser, baseURL }, info) => {
  test.skip(process.env.E2E_BUSINESS_DB !== 'isolated-preview', 'Disposable Preview fixtures required; never run on Live');
  test.setTimeout(180_000);
  expect(['http://localhost:3000', 'https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app']).toContain(baseURL);
  expect(process.env.VERCEL_ENV).toBe('preview');
  expect(process.env.DATABASE_URL_MAINPREVIEW).toBeTruthy(); expect(process.env.DATABASE_URL_MAINLIVE).toBeFalsy();
  const { Pool } = await import('pg'); const { randomBytes } = await import('node:crypto'); const { default: bcrypt } = await import('bcryptjs');
  const url = new URL(process.env.DATABASE_URL_MAINPREVIEW!); url.searchParams.set('uselibpqcompat', 'true');
  const pool = new Pool({ connectionString: url.toString(), max: 2 }); const suffix = randomBytes(12).toString('hex');
  const users = ['owner', 'worker'].map(role => ({ id: `qa_lifecycle_${suffix}_${role}`, email: `qa_lifecycle_${suffix}_${role}@example.invalid`, password: randomBytes(24).toString('base64url') }));
  const productIds = ['physical', 'digital'].map(type => `cqa${suffix}${type}`);
  const contexts: BrowserContext[] = []; let companyId = '';
  const signIn = async (index: number) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, reducedMotion: 'reduce' }); contexts.push(context);
    const csrf = await (await context.request.get('/api/auth/csrf')).json();
    await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: users[index].email, password: users[index].password, callbackUrl: `${baseURL}/products` }, headers: { 'X-Auth-Return-Redirect': '1', Origin: baseURL! } });
    expect((await (await context.request.get('/api/auth/session')).json()).user?.id === users[index].id).toBe(true);
    return context;
  };
  try {
    for (const user of users) await pool.query('INSERT INTO "User" (id,name,email,password,"emailVerified","updatedAt","web3ModeEnabled","emailDisplayMode") VALUES ($1,$2,$3,$4,NOW(),NOW(),false,\'HIDE\')', [user.id, 'QA lifecycle fixture', user.email, await bcrypt.hash(user.password, 12)]);
    const owner = await signIn(0), worker = await signIn(1), page = await owner.newPage();
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    // Actual form submission creates the company, without provider email or uploads.
    await page.goto('/companies/create', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Enter company name').fill(`Disposable QA studio ${suffix}`);
    await page.getByPlaceholder('Tell customers what your company does...').fill('Isolated acceptance fixture. No goods for sale.');
    await page.getByPlaceholder('https://example.com', { exact: true }).fill('https://example.invalid');
    await expect(page.getByPlaceholder('Enter company name')).toHaveValue(`Disposable QA studio ${suffix}`);
    await page.getByRole('button', { name: 'Create Company', exact: true }).click();
    await expect(page).toHaveURL(/\/companies\/c[a-z0-9]{20,}$/);
    companyId = new URL(page.url()).pathname.split('/').at(-1)!;
    expect((await pool.query('SELECT "ownerId" FROM "Company" WHERE id=$1', [companyId])).rows[0].ownerId).toBe(users[0].id);
    // Team HTTP entry points and DB persistence are real. The team dialog's own
    // browser interactions have separate evidence; do not claim them here.
    const added = await owner.request.post('/api/companies/employees/add', { headers: { Origin: baseURL! }, data: { companyId, userId: users[1].id, role: 'STAFF' } });
    expect(added.status()).toBe(200); let employee = await added.json();
    const permissions = async (values: Record<string, boolean>) => {
      const response = await owner.request.patch('/api/companies/employees/edit', { headers: { Origin: baseURL! }, data: { companyId, employeeId: employee.id, expectedUpdatedAt: employee.updatedAt, permissions: values } });
      expect(response.status()).toBe(200); employee = await response.json();
    };
    await permissions({ CAN_EDIT_PRODUCT_POSITION_PERMISSION: true });
    // Seed catalogue rows only. Publication/upload is covered separately by
    // real DB service tests; this test exercises the real post-publication UI.
    for (const [index, id] of productIds.entries()) await pool.query('INSERT INTO "Product" (id,title,description,category,price,stock,"shipFromPostalId",image,"userId","companyId","productType","updatedAt") VALUES ($1,$2,$3,\'QA\',29,3,\'1234\',$4,$5,$6,$7,NOW())',
      [id, `QA ${index ? 'digital' : 'physical'} listing`, 'Disposable lifecycle fixture', ['https://www.veggat.com/magicalchair.webp'], users[1].id, companyId, index ? 'DIGITAL' : 'PHYSICAL']);
    const employeePage = await worker.newPage(); employeePage.on('pageerror', error => errors.push(error.message));
    const internal = { key: '__repo_access', value: JSON.stringify({ owner: 'qa', repo: 'private', mode: 'COLLABORATOR', permission: 'pull', notes: 'Private fixture' }) };
    await pool.query('UPDATE "Product" SET specifications=$2::jsonb WHERE id=$1', [productIds[0], JSON.stringify([internal])]);
    expect((await (await worker.request.get(`/api/products/${productIds[0]}`)).json()).specifications).toEqual([]);
    expect((await worker.request.get(`/api/products/${productIds[0]}/repo-access`)).status()).toBe(403);
    for (const id of productIds) {
      await employeePage.goto(`/products/${id}`, { waitUntil: 'domcontentloaded' });
      await employeePage.getByText('Manage listing', { exact: true }).click();
      await expect(employeePage.getByRole('link', { name: 'Edit listing', exact: true })).toBeVisible();
      await expect(employeePage.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(0);
      await expect(employeePage.getByRole('button', { name: 'Hide', exact: true })).toHaveCount(0);
      await employeePage.getByRole('link', { name: 'Edit listing', exact: true }).click();
      await employeePage.getByPlaceholder('Title', { exact: true }).fill(`Saved ${id}`);
      if (id === productIds[1]) {
        await employeePage.getByRole('button', { name: 'Save & View', exact: true }).click();
        await expect(employeePage).toHaveURL(`${baseURL}/products/${id}`);
      } else {
        await employeePage.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(employeePage.getByText('Product updated successfully.', { exact: true })).toBeVisible();
      }
      expect((await pool.query('SELECT title FROM "Product" WHERE id=$1', [id])).rows[0].title).toBe(`Saved ${id}`);
    }
    const savedSpecs = (await pool.query('SELECT specifications FROM "Product" WHERE id=$1', [productIds[0]])).rows[0].specifications;
    expect(typeof savedSpecs === 'string' ? JSON.parse(savedSpecs) : savedSpecs).toEqual([internal]);
    await permissions({ CAN_DELETE_PRODUCT: true, CAN_MANAGE_PRODUCT_VISIBILITY: true });
    const id = productIds[1];
    await employeePage.goto(`/products/${id}`, { waitUntil: 'domcontentloaded' });
    await employeePage.getByText('Manage listing', { exact: true }).click();
    await employeePage.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(employeePage.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    const anonymous = await browser.newContext({ baseURL }); contexts.push(anonymous);
    expect((await anonymous.request.get(`/api/products/${id}`)).status()).toBe(404);
    await employeePage.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(employeePage.getByRole('button', { name: 'Hide', exact: true })).toBeVisible();
    await employeePage.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(employeePage.getByRole('dialog')).toContainText('Existing orders and download records stay valid');
    await employeePage.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await pool.query('SELECT visibility FROM "Product" WHERE id=$1', [id])).rows[0].visibility).toBe('PUBLIC');
    await employeePage.getByRole('button', { name: 'Archive', exact: true }).click();
    await employeePage.getByRole('dialog').getByRole('button', { name: 'Archive listing', exact: true }).click();
    await expect(employeePage.getByRole('button', { name: 'Restore hidden', exact: true })).toBeVisible();
    expect((await pool.query('SELECT visibility,"downloadsEnabled" FROM "Product" WHERE id=$1', [id])).rows[0]).toEqual({ visibility: 'ARCHIVED', downloadsEnabled: true });
    await employeePage.screenshot({ path: info.outputPath('archived-listing.png') });
    expect(await employeePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // New independent login proves saved state isn't held only in React/browser storage.
    const fresh = await signIn(1);
    expect((await (await fresh.request.get(`/api/products/${id}`)).json()).visibility).toBe('ARCHIVED');
    await employeePage.goto(`/products/edit/${productIds[0]}`, { waitUntil: 'domcontentloaded' });
    await employeePage.getByPlaceholder('Title', { exact: true }).fill('Revoked employee must not save');
    const removed = await owner.request.delete('/api/companies/employees/remove', { headers: { Origin: baseURL! }, data: { companyId, employeeId: employee.id, expectedUpdatedAt: employee.updatedAt } });
    expect(removed.status()).toBe(200);
    await employeePage.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(employeePage.getByText('You no longer have permission for this listing change. Refresh the page.', { exact: true })).toBeVisible();
    expect((await pool.query('SELECT title FROM "Product" WHERE id=$1', [productIds[0]])).rows[0].title).toBe(`Saved ${productIds[0]}`);
    expect((await fresh.request.get(`/api/products/${id}`)).status()).toBe(404);
    expect((await fresh.request.post(`/api/products/${id}/repo-access`, { headers: { Origin: baseURL! }, data: { enabled: false } })).status()).toBe(403);
    expect((await owner.request.get(`/api/products/${id}`)).status()).toBe(200);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await pool.query('DELETE FROM "EngagementEvent" WHERE "productId"=ANY($1::text[])', [productIds]);
    await pool.query('DELETE FROM "DailyReachRollup" WHERE "productId"=ANY($1::text[])', [productIds]);
    await pool.query('DELETE FROM "Product" WHERE id=ANY($1::text[]) AND "userId"=$2', [productIds, users[1].id]);
    // Creator-bound cleanup also handles a form success followed by navigation failure.
    const owned = (await pool.query('SELECT id FROM "Company" WHERE "ownerId"=$1 AND "creatorId"=$1', [users[0].id])).rows.map(row => row.id);
    await pool.query('DELETE FROM "Employee" WHERE "companyId"=ANY($1::text[])', [owned]);
    await pool.query('DELETE FROM "Company" WHERE id=ANY($1::text[])', [owned]);
    await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [users.map(user => user.id)]);
    expect((await pool.query('SELECT id FROM "User" WHERE id=ANY($1::text[])', [users.map(user => user.id)])).rowCount).toBe(0);
    await pool.end();
  }
});
