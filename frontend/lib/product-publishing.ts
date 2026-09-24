/** @fileOverview Atomic seller publication with asset, wallet and warehouse ownership checks. @stability stable */
import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { dbPrisma } from '@/lib/db';
import { MyProductCreateSchema, CategoryTagSchema, AcceptedTokenSchema } from '@/schemas';
import { createSlug } from '@/lib/category-utils';
import { isDemoUserId } from '@/lib/demo-policy';
import { z } from 'zod';

export class ProductPublishingError extends Error {}

type CompanyReader = Pick<Prisma.TransactionClient, 'company' | 'employee'>;
export async function canPublishForCompany(db: CompanyReader, userId: string, companyId: string, digital = false, upload = false) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { ownerId: true } });
  if (!company) return false;
  if (company.ownerId === userId) return true;
  const employee = await db.employee.findUnique({ where: { userId_companyId: { userId, companyId } }, select: { role: true, permissions: true } });
  if (!employee) return false;
  if (employee.role === 'OWNER' || employee.role === 'MANAGER') return true;
  const permissions = employee.permissions as Record<string, unknown> | null;
  return permissions?.CAN_POST_PRODUCT_POSITION_PERMISSION === true ||
    (digital && permissions?.CAN_CREATE_DIGITAL_PRODUCT === true) ||
    (upload && permissions?.CAN_UPLOAD_DIGITAL_ASSETS === true);
}

const postalSchema = z.array(z.string().trim().min(1).max(32)).max(20);
const serverSchema = MyProductCreateSchema.extend({
  title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(8000),
  category: z.string().trim().min(1).max(200), categories: z.array(CategoryTagSchema).max(5).default([]),
  price: z.number().finite().min(0).max(1_000_000), quantity: z.number().int().min(1).max(1_000_000),
  image: z.array(z.string().url().max(2048).refine(value => new URL(value).protocol === 'https:')).min(1).max(8),
  specifications: z.array(z.object({ key: z.string().trim().min(1).max(200), value: z.union([z.string().max(2000), z.number().finite()]) })).max(200).optional(),
  acceptedTokens: z.array(AcceptedTokenSchema).max(20).default([]),
});

/** Session identity is supplied by the authenticated action, never by form data. */
export async function publishProduct(userId: string, input: unknown, postalInput: unknown) {
  if (!userId || isDemoUserId(userId)) throw new ProductPublishingError('Demo accounts cannot publish listings. Use your own account.');
  const parsed = serverSchema.safeParse(input), postal = postalSchema.safeParse(postalInput);
  if (!parsed.success || !postal.success) throw new ProductPublishingError('Check the required listing fields, images, price and delivery details.');
  const data = parsed.data, postalCodes = [...new Set(postal.data)];
  const companyId = data.companyId || null;
  const needsShipping = data.productType !== 'DIGITAL', needsAsset = data.productType !== 'PHYSICAL';
  if (needsShipping && !postalCodes.length) throw new ProductPublishingError('Add a ship-from postal code for this product.');
  if (needsAsset && !data.digitalAssetId) throw new ProductPublishingError('Upload a digital file before publishing.');
  const tokens = data.acceptedTokens.map(token => ({ ...token, symbol: token.symbol.trim().toUpperCase() }));
  if (new Set(tokens.map(token => `${token.family}:${token.symbol}`)).size !== tokens.length) throw new ProductPublishingError('Remove duplicate payment tokens.');

  return dbPrisma.$transaction(async tx => {
    if (companyId && !await canPublishForCompany(tx, userId, companyId, data.productType === 'DIGITAL')) {
      throw new ProductPublishingError('You do not have permission to publish for this company.');
    }
    // A personal upload cannot be attached to a different seller, and company
    // uploads cannot be laundered into personal/other-company listings.
    if (data.digitalAssetId) {
      const asset = await tx.digitalAsset.findFirst({ where: {
        id: data.digitalAssetId, isActive: true, Product: null,
        ...(companyId ? { companyId } : { uploadedById: userId, companyId: null }),
      }, select: { id: true } });
      if (!asset) throw new ProductPublishingError('Choose an active, unused digital file belonging to this seller.');
    }
    const walletIds = [...new Set([data.receiverWalletId, ...tokens.map(token => token.receiverWalletId)].filter((id): id is string => !!id))];
    if (walletIds.length) {
      const wallets = await tx.wallet.findMany({ where: {
        id: { in: walletIds }, verifiedAt: { not: null },
        OR: [{ ownerUserId: userId, ownerCompanyId: null }, ...(companyId ? [{ ownerCompanyId: companyId }] : [])],
      }, select: { id: true } });
      if (wallets.length !== walletIds.length) throw new ProductPublishingError('Choose a verified receiving wallet that belongs to this seller.');
    }
    const existingCategoryIds = [...new Set(data.categories.filter(category => category.id && !category.isNew).map(category => category.id!))];
    if (existingCategoryIds.length && (await tx.category.count({ where: { id: { in: existingCategoryIds } } })) !== existingCategoryIds.length) {
      throw new ProductPublishingError('One category is no longer available. Choose it again.');
    }
    // Never select another seller's warehouse merely because its postcode matches.
    const warehouses = needsShipping ? await tx.warehouseLocation.findMany({ where: {
      postalCode: { in: postalCodes }, isActive: true,
      ...(companyId ? { companyId } : { userId, companyId: null }),
    }, select: { id: true, postalCode: true } }) : [];
    if (companyId && needsShipping && postalCodes.some(code => !warehouses.some(warehouse => warehouse.postalCode === code))) {
      throw new ProductPublishingError('Choose active warehouse postcodes from this company’s settings.');
    }
    const stock = needsShipping ? data.quantity : Math.max(data.quantity, 1_000_000);
    const product = await tx.product.create({ data: {
      title: data.title, description: data.description, category: data.category, condition: data.condition,
      price: data.price, priceCurrency: data.priceCurrency,
      acceptedFiatCurrencies: [...new Set(data.acceptedFiatCurrencies.length ? data.acceptedFiatCurrencies : [data.priceCurrency])],
      stock, shipFromPostalId: needsShipping ? postalCodes.join(', ') : '', image: data.image,
      specifications: data.specifications ? JSON.stringify(data.specifications) : Prisma.JsonNull,
      features: data.features ? JSON.stringify(data.features) : Prisma.JsonNull,
      userId, companyId, receiverWalletId: data.receiverWalletId || null,
      productType: data.productType, digitalAssetId: data.digitalAssetId || null,
      downloadsEnabled: data.downloadsEnabled, maxDownloads: data.maxDownloads ?? null,
      downloadExpiryDays: data.downloadExpiryDays ?? null,
      freeShippingEnabled: data.freeShippingEnabled, freeShippingThreshold: data.freeShippingThreshold ?? null,
    }, select: { id: true } });
    const categoryIds = new Set(existingCategoryIds);
    for (const category of data.categories.filter(category => !category.id || category.isNew)) {
      const slug = createSlug(category.name);
      if (!slug) throw new ProductPublishingError('Use a category name containing letters or numbers.');
      const saved = await tx.category.upsert({ where: { slug }, update: {}, create: {
        name: category.name.trim(), slug, parentId: category.parentId || null, createdById: userId,
      }, select: { id: true } });
      categoryIds.add(saved.id);
    }
    if (categoryIds.size) await tx.productCategory.createMany({ data: [...categoryIds].map(categoryId => ({ productId: product.id, categoryId })) });
    if (tokens.length) await tx.productAcceptedToken.createMany({ data: tokens.map(token => ({
      productId: product.id, family: token.family, symbol: token.symbol, decimals: token.decimals,
      tokenAddress: token.tokenAddress || null, tokenMint: token.tokenMint || null,
      receiverWalletId: token.receiverWalletId || null, receiverAddress: token.receiverAddress || null,
    })) });
    for (const [index, postalCode] of (needsShipping ? postalCodes : []).entries()) {
      const warehouse = warehouses.find(row => row.postalCode === postalCode) ?? await tx.warehouseLocation.create({ data: {
        postalCode, address: '', city: '', country: 'Norway', userId, companyId: null,
      }, select: { id: true } });
      const quantity = Math.floor(stock / postalCodes.length) + (index === 0 ? stock % postalCodes.length : 0);
      await tx.inventory.create({ data: { productId: product.id, warehouseId: warehouse.id, quantity, stock: quantity } });
    }
    return product;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}
