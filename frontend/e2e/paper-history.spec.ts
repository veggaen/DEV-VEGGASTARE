/** @fileOverview Actual isolated paper-account persistence, pagination and failure UI. @stability experimental */
import { expect, test, type BrowserContext } from '@playwright/test';

for (const [width, height] of [[360, 800], [390, 844], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1920, 1080], [2560, 1080]]) {
  test(`isolated paper history workflow (${width}px)`, async ({ browser, baseURL }, info) => {
    test.skip(process.env.E2E_BUSINESS_DB !== 'isolated-preview', 'Requires disposable isolated Preview fixtures');
    test.setTimeout(180_000);
    expect(['http://localhost:3000', 'https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app']).toContain(baseURL);
    expect(process.env.VERCEL_ENV).toBe('preview'); expect(process.env.DATABASE_URL_MAINPREVIEW).toBeTruthy(); expect(process.env.DATABASE_URL_MAINLIVE).toBeFalsy();
    const { Pool } = await import('pg'), { randomBytes } = await import('node:crypto'), { default: bcrypt } = await import('bcryptjs');
    const url = new URL(process.env.DATABASE_URL_MAINPREVIEW!); url.searchParams.set('uselibpqcompat', 'true');
    const pool = new Pool({ connectionString: url.toString(), max: 2 }), suffix = randomBytes(12).toString('hex');
    const users = ['a', 'b'].map(role => ({ id: `qa_paper_${suffix}_${role}`, email: `qa_paper_${suffix}_${role}@example.invalid`, password: randomBytes(24).toString('base64url') }));
    const portfolioId = `qa_portfolio_${suffix}`, contexts: BrowserContext[] = [];
    const signIn = async (index: number) => {
      const context = await browser.newContext({ baseURL, viewport: { width, height }, reducedMotion: 'reduce' }); contexts.push(context);
      context.setDefaultTimeout(15_000);
      await context.addInitScript(theme => localStorage.setItem('veggat:theme', theme), [360, 844, 1024, 2560].includes(width) ? 'dark' : 'light');
      const csrf = await (await context.request.get('/api/auth/csrf')).json();
      await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: users[index].email, password: users[index].password, callbackUrl: `${baseURL}/dashboard/paper-trading` }, headers: { Origin: baseURL!, 'X-Auth-Return-Redirect': '1' } });
      const session = await (await context.request.get('/api/auth/session')).json();
      expect(session?.user?.id === users[index].id, 'QA sign-in must succeed; respect the five-minute auth throttle before rerunning').toBe(true); return context;
    };
    try {
      for (const user of users) await pool.query('INSERT INTO "User" (id,name,email,password,"emailVerified","updatedAt","web3ModeEnabled","emailDisplayMode") VALUES ($1,$2,$3,$4,NOW(),NOW(),false,\'HIDE\')', [user.id, 'QA paper fixture', user.email, await bcrypt.hash(user.password, 12)]);
      await pool.query('INSERT INTO "PaperPortfolio" (id,"userId","startingBalance","cashBalance","updatedAt") VALUES ($1,$2,10000,9000,NOW())', [portfolioId, users[0].id]);
      await pool.query('INSERT INTO "PaperPosition" (id,"portfolioId","tokenSymbol","tokenAddress","chainId",decimals,amount,"displayAmount","avgEntryPrice","totalCostBasis","updatedAt") VALUES ($1,$2,\'USDC\',\'0x0\',1,6,\'321000000\',\'321\',1,321,NOW())', [`qa_pos_${suffix}`, portfolioId]);
      // These are intentionally backdated fixtures, not a claim of observing a year passing.
      await pool.query('INSERT INTO "PaperTrade" (id,"portfolioId",type,"buyToken","buyDisplayAmt","buyPriceUsd","sellToken","sellDisplayAmt","sellPriceUsd","executedAt") SELECT $1 || lpad(i::text,3,\'0\'),$2,\'BUY\',CASE WHEN i=0 THEN \'OLDEST-QA\' ELSE \'USDC\' END,\'1\',1,\'USD\',\'1\',1, timestamp \'2025-01-01\' + (i / 2) * interval \'1 day\' FROM generate_series(0,60) i', [`qa_trade_${suffix}_`, portfolioId]);
      const owner = await signIn(0), page = await owner.newPage(), errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      let failAction = true, historyAction = '';
      await page.route('**/dashboard/paper-trading', async route => {
        const request = route.request(), action = request.headers()['next-action'];
        if (!action) return route.continue();
        if (request.postData()?.includes('limit')) historyAction = action;
        if (failAction) { failAction = false; return route.abort('failed'); }
        return route.continue();
      });
      await page.goto('/dashboard/paper-trading', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Essential Only', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Cookie Preferences' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Retry portfolio', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start Paper Trading', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Retry portfolio', exact: true }).click();
      await expect(page.getByText('USDC', { exact: true })).toBeVisible();
      await expect(page.getByText('$9,321.00', { exact: true })).toBeVisible();
      failAction = true; await page.getByRole('button', { name: 'Refresh portfolio', exact: true }).click();
      await expect(page.locator('#main-content').getByRole('alert')).toContainText('Showing the last loaded account');
      await expect(page.getByText('USDC', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Retry portfolio', exact: true }).click(); await expect(page.locator('#main-content').getByRole('alert')).toHaveCount(0);
      failAction = true; await page.getByRole('button', { name: 'History', exact: true }).click();
      const history = page.getByRole('region', { name: 'Trade history', exact: true });
      await expect(history.getByRole('alert')).toBeVisible(); await expect(history.getByText('No trades yet.', { exact: true })).toHaveCount(0);
      await history.getByRole('button', { name: 'Retry history', exact: true }).click();
      await expect(history.locator('[data-trade-id]')).toHaveCount(50);
      failAction = true; await history.getByRole('button', { name: 'Load older trades', exact: true }).click();
      await expect(history.getByRole('alert')).toBeVisible(); await expect(history.locator('[data-trade-id]')).toHaveCount(50);
      await history.getByRole('button', { name: 'Retry history', exact: true }).click();
      await expect(history.locator('[data-trade-id]')).toHaveCount(61); await expect(history.getByText('61 loaded · End of history', { exact: true })).toBeVisible();
      const ids = await history.locator('[data-trade-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-trade-id'))); expect(new Set(ids).size).toBe(61);
      await expect(history.getByText('Bought 1 OLDEST-QA', { exact: true })).toBeVisible();
      failAction = true; await history.getByRole('button', { name: 'Refresh trade history', exact: true }).click();
      await expect(history.getByRole('alert')).toBeVisible(); await expect(history.locator('[data-trade-id]')).toHaveCount(61);
      await history.getByRole('button', { name: 'Retry history', exact: true }).click(); await expect(history.locator('[data-trade-id]')).toHaveCount(50);
      await history.getByRole('button', { name: 'Load older trades', exact: true }).click(); await expect(history.locator('[data-trade-id]')).toHaveCount(61);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await history.getByText('Bought 1 OLDEST-QA', { exact: true }).scrollIntoViewIfNeeded();
      await expect(history.getByText('Bought 1 OLDEST-QA', { exact: true })).toBeInViewport();
      await page.screenshot({ path: info.outputPath('saved-paper-history.png') });
      await page.getByRole('heading', { name: /Paper Trading/ }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('paper-account-overview.png') });
      // Two-account/fresh-password-session acceptance at phone and desktop;
      // other widths repeat read/failure/layout checks without redundant logins.
      if ([360, 1280].includes(width)) {
      const fresh = await signIn(0), freshPage = await fresh.newPage();
      await freshPage.goto('/dashboard/paper-trading'); await expect(freshPage.getByText('$9,321.00', { exact: true })).toBeVisible();
      await freshPage.getByRole('button', { name: 'Essential Only', exact: true }).click();
      await freshPage.getByRole('button', { name: 'History', exact: true }).click();
      await freshPage.getByRole('button', { name: 'Load older trades', exact: true }).click(); await expect(freshPage.getByText('Bought 1 OLDEST-QA', { exact: true })).toBeVisible();
      const stranger = await signIn(1), strangerPage = await stranger.newPage();
      await strangerPage.goto('/dashboard/paper-trading'); await expect(strangerPage.getByRole('button', { name: 'Start Paper Trading', exact: true })).toBeVisible();
      await strangerPage.getByRole('button', { name: 'Essential Only', exact: true }).click();
      await strangerPage.getByRole('button', { name: 'Start Paper Trading', exact: true }).click();
      await expect(strangerPage.getByRole('button', { name: 'History', exact: true })).toBeVisible();
      await strangerPage.getByRole('button', { name: 'History', exact: true }).click(); await expect(strangerPage.getByText('No trades yet.', { exact: true })).toBeVisible();
      expect(historyAction).toBeTruthy();
      const foreign = await stranger.request.post('/dashboard/paper-trading', { headers: { Origin: baseURL!, 'Next-Action': historyAction, 'Content-Type': 'text/plain;charset=UTF-8' }, data: JSON.stringify([{ limit: 50, cursor: `qa_trade_${suffix}_010` }]) });
      const body = await foreign.text(); expect(body).toContain('INVALID'); expect(body).not.toContain('OLDEST-QA');
      }
      // Provider failure must not devalue holdings to zero or lose the account.
      await pool.query('INSERT INTO "PaperPosition" (id,"portfolioId","tokenSymbol","tokenAddress","chainId",amount,"displayAmount","totalCostBasis","updatedAt") VALUES ($1,$2,\'QA-UNKNOWN\',\'0x0\',1,\'1\',\'1\',10,NOW())', [`qa_unknown_${suffix}`, portfolioId]);
      await page.getByRole('button', { name: 'Portfolio', exact: true }).click(); await page.getByRole('button', { name: 'Refresh portfolio', exact: true }).click();
      await expect(page.locator('#main-content').getByRole('status')).toContainText('Some prices are unavailable'); await expect(page.getByText('QA-UNKNOWN', { exact: true })).toBeVisible();
      expect((await pool.query('SELECT "cashBalance" FROM "PaperPortfolio" WHERE id=$1', [portfolioId])).rows[0].cashBalance).toBe(9000);
      expect((await pool.query('SELECT count(*)::int AS count FROM "PaperTrade" WHERE "portfolioId"=$1', [portfolioId])).rows[0].count).toBe(61);
      expect(errors).toEqual([]);
    } finally {
      await Promise.allSettled(contexts.map(context => context.close()));
      try {
        await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [users.map(user => user.id)]);
        expect((await pool.query('SELECT id FROM "PaperPortfolio" WHERE "userId"=ANY($1::text[])', [users.map(user => user.id)])).rowCount).toBe(0);
      } finally { await pool.end(); }
    }
  });
}
