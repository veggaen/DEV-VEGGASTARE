/** @fileOverview Validate checkout SQL constraints in a rolled-back isolated schema. @stability experimental */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

if (!process.argv.includes('--database=production')) throw new Error('Explicit --database=production required; all fixture DDL/data is rolled back.');
const url = new URL(process.env.DATABASE_URL_MAINLIVE);
url.hostname = url.hostname.replace('-pooler.', '.');
url.searchParams.set('uselibpqcompat', 'true');
const client = new pg.Client({ connectionString: url.toString() });
const schema = `checkout_verify_${randomUUID().replaceAll('-', '')}`;
const migration = readFileSync(new URL('../prisma/migrations/20260924000100_verified_checkout_credits/migration.sql', import.meta.url), 'utf8');
let checks = 0;
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  for (const table of ['User', 'Order', 'Product', 'DigitalAsset']) await client.query(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY)`);
  await client.query(migration);
  await client.query(`INSERT INTO "User" VALUES ('fixture'); INSERT INTO "Order"(id) VALUES ('one'),('two');`);
  async function rejected(sql, params, code) {
    await client.query('SAVEPOINT negative_check');
    try { await client.query(sql, params); throw new Error('Constraint did not reject invalid data'); }
    catch (error) { if (error.code !== code) throw error; checks++; }
    finally { await client.query('ROLLBACK TO SAVEPOINT negative_check'); }
  }
  const insert = `INSERT INTO "CheckoutAttempt"("orderId","userId","requestKey","environment","totalOre","quote","state","createRequestId","captureRequestId","captureId","paypalOrderId","merchantId") VALUES ($1,'fixture',$1,'LIVE',3900,'{}',$2,$1,$1,$3,$4,$5)`;
  await rejected(insert, ['one', 'COMPLETED', null, null, null], '23514');
  await client.query(insert, ['one', 'COMPLETED', 'CAPTURE1', 'PAYPAL1', 'MERCHANT1']);
  await rejected(insert, ['two', 'COMPLETED', 'CAPTURE1', 'PAYPAL2', 'MERCHANT1'], '23505');
  await rejected(`INSERT INTO "AiCreditAccount" VALUES ('bad','fixture','LIVE',-1,now())`, [], '23514');
  await client.query(`INSERT INTO "AiCreditAccount" VALUES ('LIVE:fixture','fixture','LIVE',100,now());
    INSERT INTO "AiCreditEntry" VALUES ('grant','LIVE:fixture',100,'PURCHASE','checkout:one',now());`);
  await client.query('SAVEPOINT duplicate_grant');
  await client.query(`UPDATE "AiCreditAccount" SET balance=balance+100 WHERE id='LIVE:fixture'`);
  try {
    await client.query(`INSERT INTO "AiCreditEntry" VALUES ('duplicate','LIVE:fixture',100,'PURCHASE','checkout:one',now())`);
    throw new Error('Replay grant was accepted');
  } catch (error) { if (error.code !== '23505') throw error; }
  await client.query('ROLLBACK TO SAVEPOINT duplicate_grant');
  const balance = (await client.query(`SELECT balance FROM "AiCreditAccount" WHERE id='LIVE:fixture'`)).rows[0].balance;
  if (balance !== 100) throw new Error('Replay rollback changed balance');
  checks++;
  console.log(JSON.stringify({ checks, passed: true, scope: 'temporary schema, full rollback' }));
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
