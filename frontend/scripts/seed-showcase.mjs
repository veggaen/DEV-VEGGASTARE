/** @fileOverview Idempotent, narrowly scoped reviewer catalog seeding; never modifies existing user listings. @stability stable */
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const refreshCreditCopy = process.argv.includes('--refresh-credit-copy');
const refreshProductCopy = process.argv.includes('--refresh-product-copy');
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
    id: 'cveggatinterviewpack000001', title: 'Fjord Study — Digital Artwork', price: 29, category: 'Digital art',
    description: 'A quiet, imagined fjord landscape for your personal screen. Download the 1536 × 1024 JPG and a plain-text guide with wallpaper setup, cropping tips, and personal-use terms. AI-generated artwork, not a photograph of a real place. Digital files only; no physical print.',
    images: ['/showcase/fjord-study-preview.jpg', '/showcase/fjord-study-contents.jpg'],
    features: [{ text: '1536 × 1024 JPG in a 3:2 composition' }, { text: 'Wallpaper setup and cropping guide included' }, { text: 'Personal use on your own devices' }],
    specifications: [{ key: 'Files', value: 'JPG artwork + TXT guide' }, { key: 'Resolution', value: '1536 × 1024 pixels' }, { key: 'License', value: 'Personal use; no resale or redistribution' }, { key: 'Created with', value: 'Generative AI' }],
  },
  {
    id: 'cveggatinterviewcredits01', title: 'Veggat AI Credits', price: 39, category: 'AI credits',
    description: 'Prepaid text chat for questions, writing, and coding inside Veggat. Choose credits or enter a budget; the amount updates automatically. Model availability and the credit cost are shown before each message. No subscription or automatic top-ups. Image and video generation are not included.',
    images: ['/showcase/credits-cover-v2.jpg'],
    features: [{ text: 'Choose credits or a spending budget' }, { text: 'No subscription or automatic top-ups' }, { text: 'Usage is bounded by your available balance' }],
    specifications: [{ key: 'Included', value: 'Your selected credit amount' }, { key: 'Billing', value: 'One-time, no auto-renewal' }, { key: 'Price', value: 'Calculated from your selection' }],
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
      VALUES ($1,'Veggat Studio','Digital artwork and prepaid AI chat from Veggat.','https://www.veggat.com',ARRAY[]::text[],ARRAY['/showcase/fjord-study-preview.jpg'],$2,$2,now())
      ON CONFLICT (id) DO NOTHING`, [companyId, owner]);
    const company = (await client.query('SELECT "ownerId" FROM "Company" WHERE id=$1', [companyId])).rows[0];
    if (company?.ownerId !== owner) throw new Error('Showcase company ownership mismatch; no changes applied.');
    if (refreshProductCopy) {
      const guide = (await client.query('SELECT "digitalAssetId" FROM "DigitalProductFile" WHERE "productId"=$1 AND "digitalAssetId"=$2', ['cveggatinterviewpack000001', 'cveggatfjordguide20260901'])).rows[0];
      if (!guide) throw new Error('Provision the permanent artwork guide before changing the listing.');
      await client.query('UPDATE "Company" SET description=$2, "updatedAt"=now() WHERE id=$1', [companyId, 'Digital artwork and prepaid AI chat from Veggat.']);
    }
    for (const product of products) {
      await client.query(`INSERT INTO "Product" (id,title,description,category,price,"priceCurrency","acceptedFiatCurrencies",stock,"shipFromPostalId",image,features,specifications,"userId","companyId","productType",visibility,"downloadsEnabled","freeShippingEnabled","updatedAt")
        VALUES ($1,$2,$3,$4,$5,'NOK',ARRAY['NOK']::"FiatCurrency"[],0,'', $6::text[],$7::jsonb,$8::jsonb,$9,$10,'DIGITAL','PUBLIC',true,true,now())
        ON CONFLICT (id) DO NOTHING`, [product.id,product.title,product.description,product.category,product.price,product.images,JSON.stringify(product.features),JSON.stringify(product.specifications),owner,companyId]);
      const saved = (await client.query('SELECT "companyId", "userId" FROM "Product" WHERE id=$1', [product.id])).rows[0];
      if (saved?.companyId !== companyId || saved?.userId !== owner) throw new Error('Showcase SKU collision; no changes applied.');
      if (refreshProductCopy || (refreshCreditCopy && product.id === 'cveggatinterviewcredits01')) {
        await client.query('UPDATE "Product" SET description=$2, features=$3::jsonb, specifications=$4::jsonb, image=$5::text[], title=$6, "updatedAt"=now() WHERE id=$1',
          [product.id, product.description, JSON.stringify(product.features), JSON.stringify(product.specifications), product.images, product.title]);
      }
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    console.log(`${dryRun ? 'Validated and rolled back' : 'Saved'} Veggat Studio catalog in ${target}: two stable SKUs. Other listings and historical order records preserved. This catalog operation does not verify payments or fulfillment.`);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
} finally { await pool.end(); }
