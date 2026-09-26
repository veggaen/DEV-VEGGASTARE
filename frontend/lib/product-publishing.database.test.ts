/** @fileOverview Real publication rollback and ownership checks in a disposable Preview schema. @stability stable */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from './preview-database';
vi.mock('server-only', () => ({}));
const runtime = vi.hoisted(() => ({ db: undefined as unknown, actor: 'seller' }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return runtime.db; } }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: runtime.actor, role: 'USER', sessionVersion: 0 } }) }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => ({ id: runtime.actor, role: 'USER', sessionVersion: 0 }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }) }));
vi.mock('@/lib/mail', () => ({ sendCompanyOrgVerificationEmail: vi.fn() }));
import { publishProduct } from './product-publishing';
import { MyCreateCompanyAction } from '@/actions/create-company';
import { mutateCompanyTeam } from './company-team';
import { MyUpdateProductAction, MySetProductVisibilityAction, MyDeleteProductAction, getProductManagementAccess } from '@/actions/products';

describe.skipIf(process.env.TEST_PRODUCT_PUBLISH_DATABASE !== '1')('real isolated publication transactions', () => {
  const schema = `qa_product_publish_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    if (process.env.VERCEL_ENV !== 'preview') throw new Error('Isolated Preview required');
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.searchParams.set('sslmode', 'verify-full'); url.searchParams.delete('uselibpqcompat');
    const direct = new URL(url); direct.hostname = direct.hostname.replace('-pooler.', '.');
    admin = new Client({ connectionString: direct.toString() }); await admin.connect();
    if (!/^qa_product_publish_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    // Copy table geometry/constraints, not any production or preview user rows.
    for (const table of ['User', 'Product', 'DigitalAsset', 'Wallet', 'Company', 'Employee', 'Category', 'ProductCategory', 'ProductAcceptedToken', 'WarehouseLocation', 'Inventory']) {
      await admin.query(`CREATE TABLE "${table}" (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
      const columns = await admin.query<{ column: string; type: string; array: boolean; default: string | null }>(`
        SELECT a.attname AS column, e.typname AS type, t.typelem <> 0 AS array, pg_get_expr(d.adbin,d.adrelid) AS default
        FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid JOIN pg_type e ON e.oid=CASE WHEN t.typelem<>0 THEN t.typelem ELSE t.oid END
        LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
        WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped AND e.typtype='e'`, [`public."${table}"`]);
      for (const column of columns.rows) {
        if (![column.column, column.type].every(name => /^[a-zA-Z0-9_]+$/.test(name))) throw new Error('Unexpected enum name');
        const exists = await admin.query('SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typname=$2', [schema, column.type]);
        if (!exists.rowCount) {
          const labels = await admin.query<{ label: string }>('SELECT enumlabel AS label FROM pg_enum WHERE enumtypid=$1::regtype ORDER BY enumsortorder', [`public."${column.type}"`]);
          if (labels.rows.some(row => !/^[A-Z0-9_]+$/.test(row.label))) throw new Error('Unexpected enum label');
          await admin.query(`CREATE TYPE "${column.type}" AS ENUM (${labels.rows.map(row => `'${row.label}'`).join(',')})`);
        }
        const target = `"${schema}"."${column.type}"${column.array ? '[]' : ''}`;
        await admin.query(`ALTER TABLE "${table}" ALTER COLUMN "${column.column}" DROP DEFAULT, ALTER COLUMN "${column.column}" TYPE ${target} USING "${column.column}"::text::${target}`);
        if (column.default) await admin.query(`ALTER TABLE "${table}" ALTER COLUMN "${column.column}" SET DEFAULT (${column.default})::text::${target}`);
      }
    }
    direct.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: direct.toString() }, { schema }) }); runtime.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30_000);
  beforeEach(async () => {
    await db.productCategory.deleteMany(); await db.productAcceptedToken.deleteMany(); await db.inventory.deleteMany(); await db.product.deleteMany();
    await db.digitalAsset.deleteMany(); await db.warehouseLocation.deleteMany();
    await db.employee.deleteMany(); await db.company.deleteMany(); await db.user.deleteMany();
    runtime.actor = 'seller';
    await db.user.createMany({ data: ['seller', 'worker', 'outsider'].map(id => ({ id, name: `QA ${id}` })) });
    await db.digitalAsset.create({ data: { id: 'owned-asset', fileName: 'qa.txt', fileSize: 3, mimeType: 'text/plain', fileExtension: 'txt',
      storageKey: 'qa-only-no-provider-call', checksum: 'a'.repeat(64), uploadedById: 'seller' } });
  });
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_product_publish_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      expect((await admin.query('SELECT 1 FROM information_schema.schemata WHERE schema_name=$1', [schema])).rowCount).toBe(0); await admin.end();
    }
  });
  const input = () => ({ title: 'Synthetic QA listing', description: 'No public customer product', category: 'QA', price: 29, userId: 'forged', quantity: 1,
    image: ['https://example.invalid/qa.jpg'], productType: 'DIGITAL', digitalAssetId: 'owned-asset' });
  it('publishes a real database row with the session owner and private asset association', async () => {
    const result = await publishProduct('seller', input(), []);
    expect(await db.product.findUnique({ where: { id: result.id }, select: { userId: true, digitalAssetId: true } })).toEqual({ userId: 'seller', digitalAssetId: 'owned-asset' });
  });
  it('rejects a real foreign asset and leaves zero products', async () => {
    await db.digitalAsset.update({ where: { id: 'owned-asset' }, data: { uploadedById: 'other' } });
    await expect(publishProduct('seller', input(), [])).rejects.toThrow('active, unused'); expect(await db.product.count()).toBe(0);
  });
  it('rolls back a product written before a category validation error', async () => {
    await expect(publishProduct('seller', { ...input(), categories: [{ name: '!!!' }] }, [])).rejects.toThrow('category name');
    expect(await db.product.count()).toBe(0); expect(await db.productCategory.count()).toBe(0);
    // The asset is still usable after failure, not consumed by an orphan listing.
    await expect(publishProduct('seller', input(), [])).resolves.toHaveProperty('id');
  });
  it('does not borrow another seller’s warehouse at the same postcode', async () => {
    await db.warehouseLocation.create({ data: { id: 'foreign-warehouse', userId: 'other', postalCode: '1234', address: 'QA', city: 'QA', country: 'Norway' } });
    const result = await publishProduct('seller', { ...input(), productType: 'PHYSICAL', digitalAssetId: undefined, quantity: 5 }, ['1234']);
    const inventory = await db.inventory.findFirstOrThrow({ where: { productId: result.id }, select: { warehouseId: true, quantity: true } });
    expect(inventory.quantity).toBe(5); expect(inventory.warehouseId).not.toBe('foreign-warehouse');
    expect((await db.warehouseLocation.findUniqueOrThrow({ where: { id: inventory.warehouseId } })).userId).toBe('seller');
  });
  it('company creation → employee permission → physical/digital publishing → lifecycle → revocation', async () => {
    const created = await MyCreateCompanyAction({ name: 'Disposable QA studio', description: 'No real business or email', logo: [], bannerImage: [],
      creatorId: 'seller', ownerId: 'seller', usesShipping: true, employmentNoticeDays: 14,
      warehouseLocations: [{ address: 'QA only', city: 'QA', country: 'Norway', postalCode: '1234' }] });
    expect(created).toHaveProperty('companyId'); if (!('companyId' in created)) throw new Error('Fixture company failed');
    const companyId = created.companyId;
    const employee = await mutateCompanyTeam('seller', { kind: 'add', companyId, userId: 'worker', role: 'STAFF' });
    const companyInput = { ...input(), companyId, digitalAssetId: undefined, productType: 'PHYSICAL', quantity: 7 };
    await expect(publishProduct('worker', companyInput, ['1234'])).rejects.toThrow('permission');
    const review = async () => ({ companyId, employeeId: employee!.id,
      expectedUpdatedAt: (await db.employee.findUniqueOrThrow({ where: { id: employee!.id } })).updatedAt.toISOString() });
    await mutateCompanyTeam('seller', { kind: 'permissions', ...await review(), permissions: {
      CAN_POST_PRODUCT_POSITION_PERMISSION: true, CAN_EDIT_PRODUCT_POSITION_PERMISSION: true,
    } });
    const physical = await publishProduct('worker', companyInput, ['1234']);
    const stock = await db.inventory.findFirstOrThrow({ where: { productId: physical.id }, include: { WarehouseLocation: true } });
    expect(stock.quantity).toBe(7); expect(stock.WarehouseLocation.companyId).toBe(companyId);
    await db.digitalAsset.update({ where: { id: 'owned-asset' }, data: { companyId } });
    const digital = await publishProduct('worker', { ...input(), companyId }, []);
    for (const row of await db.product.findMany()) expect(row).toMatchObject({ userId: 'worker', companyId });
    runtime.actor = 'worker';
    expect(await MyUpdateProductAction(physical.id, { title: 'Employee revised product' })).toHaveProperty('success');
    expect(await MyDeleteProductAction(physical.id)).toHaveProperty('error');
    expect(await MySetProductVisibilityAction(digital.id, 'HIDDEN')).toHaveProperty('error');
    expect(await getProductManagementAccess(digital.id)).toEqual({ edit: true, archive: false, visibility: false });
    await mutateCompanyTeam('seller', { kind: 'permissions', ...await review(), permissions: { CAN_MANAGE_PRODUCT_VISIBILITY: true, CAN_DELETE_PRODUCT: true } });
    expect(await MySetProductVisibilityAction(digital.id, 'HIDDEN')).toHaveProperty('success');
    expect(await MySetProductVisibilityAction(digital.id, 'PUBLIC')).toHaveProperty('success');
    expect(await MyDeleteProductAction(digital.id)).toHaveProperty('success');
    expect(await db.product.findUniqueOrThrow({ where: { id: digital.id } })).toMatchObject({ visibility: 'ARCHIVED', digitalAssetId: 'owned-asset', downloadsEnabled: true });
    await mutateCompanyTeam('seller', { kind: 'remove', ...await review() });
    for (const id of [physical.id, digital.id]) {
      expect(await MyUpdateProductAction(id, { title: 'Must not persist' })).toHaveProperty('error');
      expect(await MySetProductVisibilityAction(id, 'PUBLIC')).toHaveProperty('error');
      expect(await MyDeleteProductAction(id)).toHaveProperty('error');
    }
    await expect(publishProduct('worker', companyInput, ['1234'])).rejects.toThrow('permission');
    runtime.actor = 'outsider'; expect(await MyDeleteProductAction(physical.id)).toHaveProperty('error');
    runtime.actor = 'seller'; expect(await MyDeleteProductAction(physical.id)).toHaveProperty('success');
    expect(await db.product.count()).toBe(2);
    expect((await db.product.findUniqueOrThrow({ where: { id: physical.id } })).title).toBe('Employee revised product');
  }, 30_000);
  it('personal physical/digital lifecycle persists for its owner and rejects another account', async () => {
    const digital = await publishProduct('seller', input(), []);
    const physical = await publishProduct('seller', { ...input(), productType: 'PHYSICAL', digitalAssetId: undefined, quantity: 3 }, ['1234']);
    for (const product of [digital, physical]) {
      expect(await MyUpdateProductAction(product.id, { title: 'Saved personal product' })).toHaveProperty('success');
      expect(await MySetProductVisibilityAction(product.id, 'HIDDEN')).toHaveProperty('success');
      expect(await MySetProductVisibilityAction(product.id, 'PUBLIC')).toHaveProperty('success');
      runtime.actor = 'outsider'; expect(await MyDeleteProductAction(product.id)).toHaveProperty('error');
      runtime.actor = 'seller'; expect(await MyDeleteProductAction(product.id)).toHaveProperty('success');
      expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ title: 'Saved personal product', visibility: 'ARCHIVED', downloadsEnabled: true });
    }
  });
});
