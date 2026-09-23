/** @fileOverview Provision only the two original reviewer downloads into private EdgeStore. @stability experimental */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initEdgeStore } from '@edgestore/server';
import { initEdgeStoreClient, initEdgeStoreSdk } from '@edgestore/server/core';
import pg from 'pg';

const database = process.argv.find(arg => arg.startsWith('--database='))?.slice(11);
if (!['production', 'preview'].includes(database)) throw new Error('Explicit --database=production|preview required.');
if (!process.env.EDGE_STORE_ACCESS_KEY || !process.env.EDGE_STORE_SECRET_KEY) throw new Error('Private storage credentials missing');
const dbUrl = new URL(database === 'preview' ? process.env.DATABASE_URL_MAINPREVIEW : process.env.DATABASE_URL_MAINLIVE);
if (database === 'preview' && process.env.DATABASE_URL_MAINLIVE && dbUrl.hostname.replace('-pooler.', '.') === new URL(process.env.DATABASE_URL_MAINLIVE).hostname.replace('-pooler.', '.')) throw new Error('Preview cannot provision into the production endpoint.');
dbUrl.searchParams.set('uselibpqcompat', 'true');
const client = new pg.Client({ connectionString: dbUrl.toString() });
const companyId = 'cveggatshowcasestudio00001', productId = 'cveggatinterviewpack000001';
const files = [
  { id: 'cshowcasefjordjpg000000001', name: 'fjord-study.jpg', mime: 'image/jpeg', ext: 'jpg' },
  { id: 'cshowcaseinterviewtxt00001', name: 'veggat-interview-notes.txt', mime: 'text/plain', ext: 'txt' },
];
await client.connect();
try {
  const owner = (await client.query('SELECT "ownerId" FROM "Company" WHERE id=$1', [companyId])).rows[0]?.ownerId;
  if (!owner) throw new Error('Seed the reviewer company first');
  // Same protected bucket/path/access policy as the app. This backend SDK path
  // uses server credentials and cannot be invoked through a browser upload.
  const es = initEdgeStore.context().create();
  const router = es.router({ digitalAssets: es.fileBucket({ maxSize: 100 * 1024 * 1024 })
    .path(({ ctx }) => [{ owner: ctx.userId }])
    .accessControl({ OR: [{ userId: { path: 'owner' } }, { role: { eq: 'ADMIN' } }] }),
  });
  const backend = initEdgeStoreClient({ router });
  const sdk = initEdgeStoreSdk({});
  const storageToken = await sdk.getToken({ router, ctx: { userId: owner, role: 'OWNER' } });
  for (const file of files) {
    const bytes = readFileSync(new URL(`../.private-showcase/${file.name}`, import.meta.url));
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const existing = (await client.query('SELECT "storageKey", checksum, "uploadedById" FROM "DigitalAsset" WHERE id=$1', [file.id])).rows[0];
    if (existing && (existing.checksum !== checksum || existing.uploadedById !== owner)) throw new Error('Existing asset differs; refusing overwrite');
    // Recover this script's just-uploaded private original after an interrupted
    // verification without generating duplicate uploads. Hash is checked below.
    const recent = existing ? [] : (await backend.digitalAssets.listFiles({ filter: {
      path: { owner }, uploadedAt: { gt: new Date(Date.now() - 3_600_000) },
    }, pagination: { currentPage: 1, pageSize: 50 } })).data;
    const candidate = recent.find(item => item.size === bytes.length && new URL(item.url).pathname.endsWith(`.${file.ext}`));
    const stored = existing ? { url: existing.storageKey } : candidate ?? await backend.digitalAssets.upload({
      content: { blob: new Blob([bytes], { type: file.mime }), extension: file.ext }, ctx: { userId: owner, role: 'OWNER' },
    });
    const raw = await fetch(stored.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (![401, 403].includes(raw.status)) throw new Error(`Protected storage check failed (${raw.status}); asset not linked`);
    if (new URL(stored.url).hostname !== 'files.edgestore.dev') throw new Error('Unexpected storage host');
    const downloaded = await fetch(stored.url, { redirect: 'error', headers: { Cookie: `edgestore-token=${storageToken}` }, signal: AbortSignal.timeout(15_000) });
    if (!downloaded.ok) throw new Error(`Server download check failed (${downloaded.status}); asset not linked`);
    const receivedHash = createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex');
    if (receivedHash !== checksum) throw new Error('Private asset checksum mismatch');
    await client.query('BEGIN');
    try {
      await client.query(`INSERT INTO "DigitalAsset" (id,"fileName","fileSize","mimeType","fileExtension","storageKey","storageProvider",checksum,"uploadedById","companyId","isActive","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,'EDGESTORE',$7,$8,$9,true,now(),now()) ON CONFLICT (id) DO NOTHING`,
      [file.id, file.name, bytes.length, file.mime, file.ext, stored.url, checksum, owner, companyId]);
      await client.query('INSERT INTO "DigitalProductFile" ("productId","digitalAssetId") VALUES ($1,$2) ON CONFLICT DO NOTHING', [productId, file.id]);
      if (file.ext === 'jpg') await client.query('UPDATE "Product" SET "digitalAssetId"=$1 WHERE id=$2 AND "digitalAssetId" IS NULL', [file.id, productId]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    console.log(JSON.stringify({ file: file.name, privateRawStatus: raw.status, authenticatedChecksumMatch: true, linked: true }));
  }
} catch (error) {
  // SDK errors may contain signed URLs; never print the original error object.
  console.error(error instanceof Error && !/https?:|token|secret|key/i.test(error.message) ? error.message : 'Private asset provisioning failed; inspect configuration without logging credentials.');
  process.exitCode = 1;
} finally { await client.end(); }
