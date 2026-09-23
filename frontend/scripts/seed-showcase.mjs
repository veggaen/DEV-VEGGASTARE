/** @fileOverview Idempotent, narrowly scoped reviewer catalog seeding; never modifies existing user listings. @stability stable */
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const refreshCreditCopy = process.argv.includes('--refresh-credit-copy');
if (!['development', 'preview', 'production'].includes(target)) throw new Error('Usage: node --env-file=<scoped-env-file> scripts/seed-showcase.mjs development|preview|production');
const configured = target === 'production' ? process.env.DATABASE_URL_MAINLIVE : target === 'preview' ? process.env.DATABASE_URL_MAINPREVIEW : process.env.DATABASE_URL_MAINDEV;
if (!configured) throw new Error(`Missing database configuration for ${target}`);
const url = new URL(configured);
if (target === 'preview' && process.env.DATABASE_URL_MAINLIVE && url.hostname.replace('-pooler.', '.') === new URL(process.env.DATABASE_URL_MAINLIVE).hostname.replace('-pooler.', '.')) throw new Error('Preview cannot seed the production endpoint.');
url.searchParams.set('uselibpqcompat', 'true');
const pool = new Pool({ connectionString: url.toString(), max: 1 });
const companyId = 'cveggatshowcasestudio00001';
const products = [
  {
    id: 'cveggatinterviewpack000001', title: 'Veggat Interview Pack', price: 29, category: 'Digital art',
    description: 'A small, real digital product for reviewers: Fjord Study, an original AI-generated architectural landscape, plus a plain-text guide to the Veggat architecture and demo. This is an openly labelled test listing for interviews, not a photograph or a physical print. Includes a full-resolution JPG and a TXT guide. Payment and protected delivery are being validated; browsing the demo never charges a card.',
    images: ['/showcase/fjord-study-preview.jpg', '/showcase/interview-pack-contents.jpg'],
    features: [{ text: 'Original AI-generated landscape artwork' }, { text: 'Full-resolution JPG plus readable TXT guide' }, { text: 'No physical shipping or recurring subscription' }],
    specifications: [{ key: 'Files', value: 'JPG + TXT' }, { key: 'Artwork', value: '1536 × 1024 pixels' }, { key: 'Listing', value: 'Reviewer test product' }, { key: 'Price', value: '29 NOK, one-time' }],
  },
  {
    id: 'cveggatinterviewcredits01', title: 'Interviewer AI Credits', price: 39, category: 'AI credits',
    description: 'Choose 100–1,000 prepaid Veggat AI credits for supported premium chat models, with progressive volume discounts. Enter your exact amount on this page or in your cart. No subscription, automatic top-up or unlimited plan. Model availability and per-message credit costs are shown before sending. Credits are added only after verified payment; Sandbox credits stay separate from Live credits. The free demo includes a small allowance, so an interview never requires payment.',
    images: ['/showcase/credits-cover.jpg'],
    features: [{ text: 'Choose 100–1,000 prepaid credits' }, { text: 'No subscription or automatic top-ups' }, { text: 'Usage is bounded by your available balance' }],
    specifications: [{ key: 'Included', value: 'Your selected credit amount' }, { key: 'Billing', value: 'One-time, no auto-renewal' }, { key: 'Price', value: '39 NOK' }],
  },
];

try {
  // Fail before writing if the deployment artifacts have not been prepared.
  await readFile(fileURLToPath(new URL('../public/showcase/fjord-study-preview.jpg', import.meta.url)));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owners = (await client.query('SELECT id FROM "User" WHERE role=\'OWNER\' ORDER BY "createdAt" LIMIT 2')).rows;
    if (owners.length !== 1) throw new Error('Expected exactly one platform OWNER. Seed refuses to guess company ownership.');
    const owner = owners[0].id;
    await client.query(`INSERT INTO "Company" (id,name,description,"websiteUrl",logo,"bannerImage","creatorId","ownerId","updatedAt")
      VALUES ($1,'Veggat Studio','Official reviewer showcase. Small digital products and prepaid AI credits.','https://www.veggat.com',ARRAY[]::text[],ARRAY['/showcase/fjord-study-preview.jpg'],$2,$2,now())
      ON CONFLICT (id) DO NOTHING`, [companyId, owner]);
    const company = (await client.query('SELECT "ownerId" FROM "Company" WHERE id=$1', [companyId])).rows[0];
    if (company?.ownerId !== owner) throw new Error('Showcase company ownership mismatch; no changes applied.');
    for (const product of products) {
      await client.query(`INSERT INTO "Product" (id,title,description,category,price,"priceCurrency","acceptedFiatCurrencies",stock,"shipFromPostalId",image,features,specifications,"userId","companyId","productType",visibility,"downloadsEnabled","freeShippingEnabled","updatedAt")
        VALUES ($1,$2,$3,$4,$5,'NOK',ARRAY['NOK']::"FiatCurrency"[],0,'', $6::text[],$7::jsonb,$8::jsonb,$9,$10,'DIGITAL','PUBLIC',true,true,now())
        ON CONFLICT (id) DO NOTHING`, [product.id,product.title,product.description,product.category,product.price,product.images,JSON.stringify(product.features),JSON.stringify(product.specifications),owner,companyId]);
      const saved = (await client.query('SELECT "companyId", "userId" FROM "Product" WHERE id=$1', [product.id])).rows[0];
      if (saved?.companyId !== companyId || saved?.userId !== owner) throw new Error('Showcase SKU collision; no changes applied.');
      if (refreshCreditCopy && product.id === 'cveggatinterviewcredits01') {
        await client.query('UPDATE "Product" SET description=$2, features=$3::jsonb, specifications=$4::jsonb, "updatedAt"=now() WHERE id=$1',
          [product.id, product.description, JSON.stringify(product.features), JSON.stringify(product.specifications)]);
      }
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    console.log(`${dryRun ? 'Validated and rolled back' : 'Saved'} showcase catalog in ${target}: one company, two fixed reviewer SKUs. Existing listings preserved. Checkout remains paused until verified fulfillment ships.`);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
} finally { await pool.end(); }
