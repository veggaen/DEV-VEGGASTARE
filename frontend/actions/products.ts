'use server';

import { auth } from '@/auth';
import { dbPrisma } from "@/lib/db";
import { MyProductCreateSchema } from "@/schemas";
import { Prisma } from "@/generated/prisma/browser";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from '@/lib/rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';
import { publishProduct, ProductPublishingError } from '@/lib/product-publishing';

type CreateProductResult = { error: string } | { success: string; productId: string };
type UpdateProductResult = { error: string } | { success: string };
type EnsureOwnerTestProductResult =
  | { error: string }
  | { success: string; productId: string; created: boolean };
type ProductVisibilityValue = 'PUBLIC' | 'HIDDEN' | 'ARCHIVED';

const ProductAcceptedTokenInputSchema = z
  .object({
    family: z.enum(['EVM', 'SOLANA']),
    symbol: z.string().min(1).max(32),
    decimals: z.number().int().nonnegative().max(255),
    tokenAddress: z.string().trim().min(1).max(200).nullable().optional(),
    tokenMint: z.string().trim().min(1).max(200).nullable().optional(),
    receiverWalletId: z.string().trim().min(1).max(200).nullable().optional(),
    receiverAddress: z.string().trim().min(1).max(256).nullable().optional(),
  })
  .strict();

const SpecificationInputSchema = z
  .object({
    key: z.string().min(1).max(200),
    value: z.union([z.string().max(2000), z.number().finite()]),
  })
  .strict();

const FeatureInputSchema = z
  .object({
    text: z.string().min(1).max(500),
    key: z.string().max(100).optional(),
    icon: z.string().max(50).optional(),
  })
  .strict();

const ProductUpdatePatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(8000).optional(),
    category: z.string().trim().min(1).max(200).optional(),
    price: z.number().finite().optional(),
    priceCurrency: z.enum(['USD', 'NOK', 'EUR', 'GBP']).optional(),
    acceptedFiatCurrencies: z.array(z.enum(['USD', 'NOK', 'EUR', 'GBP'])).optional(),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
    stock: z.number().int().min(0).max(1_000_000).optional(),
    shipFromPostalId: z.string().trim().min(0).max(2000).optional(),
    image: z.array(z.string().trim().min(1).max(4000)).max(20).optional(),
    specifications: z.array(SpecificationInputSchema).max(200).optional(),
    features: z.array(FeatureInputSchema).max(50).optional(),
    acceptedTokens: z.array(ProductAcceptedTokenInputSchema).optional(),
  })
  .strict();

const ProductVisibilitySchema = z.enum(['PUBLIC', 'HIDDEN', 'ARCHIVED']);

async function canManageProductLifecycle(productId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { allowed: false as const, error: 'Unauthorized' };
  }

  const sessionUserId = session.user.id;
  const role = session.user.role;
  const product = await dbPrisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      userId: true,
      companyId: true,
      title: true,
      Company: { select: { ownerId: true } },
    },
  });

  if (!product) {
    return { allowed: false as const, error: 'Product not found' };
  }

  const isAdminLike = role === 'ADMIN' || role === 'OWNER';
  const isProductOwner = product.userId === sessionUserId;
  const isCompanyOwner = product.Company?.ownerId === sessionUserId;
  let allowed = isAdminLike || isProductOwner || isCompanyOwner;

  if (!allowed && product.companyId) {
    const employee = await dbPrisma.employee.findFirst({
      where: { userId: sessionUserId, companyId: product.companyId },
      select: { permissions: true },
    });

    const p: any = employee?.permissions ?? {};
    allowed =
      p?.CAN_DELETE_PRODUCT === true ||
      p?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true ||
      p?.CAN_MANAGE_PRODUCT_VISIBILITY === true;
  }

  if (!allowed) {
    return { allowed: false as const, error: 'Forbidden - You do not have permission to manage this product' };
  }

  return { allowed: true as const, product };
}

// Kept as a compatibility endpoint for already-open owner pages. It performs
// no write: the old $1 product was not part of the released checkout.
export const ensureOwnerCheckoutTestProductAction = async (): Promise<EnsureOwnerTestProductResult> => {
  const session = await auth();
  if (session?.user?.role !== 'OWNER') return { error: 'Only the platform owner can access checkout tools.' };
  return { success: 'Use the existing reviewer product for checkout verification.', productId: 'cveggatinterviewpack000001', created: false };
};

export const MyCreateProductAction = async (data: z.infer<typeof MyProductCreateSchema>, postalCodes: string[]): Promise<CreateProductResult> => {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in to publish a listing.' };
  if (session.user.isDemo || isDemoUserId(session.user.id)) return { error: 'Demo accounts cannot publish listings. Use your own account.' };
  const limit = await checkRateLimit('product-publish:' + session.user.id, 'write');
  if (!limit.success) return { error: 'Too many publishing attempts. Please wait a minute and try again.' };
  try {
    const product = await publishProduct(session.user.id, data, postalCodes);
    // The transaction has committed. A cache-refresh failure must not tell the
    // seller that publication failed and encourage an ambiguous repeat write.
    try { revalidatePath('/products'); revalidatePath('/my-sales'); }
    catch { console.error('[products] Post-publication cache refresh deferred'); }
    return { success: 'Listing published. Checkout for general listings is not yet open.', productId: product.id };
  } catch (error) {
    if (error instanceof ProductPublishingError) return { error: error.message };
    // Never log form payloads, storage locations, payout information or raw DB errors.
    console.error('[products] Publication failed');
    return { error: 'The listing could not be published. Your draft is still here; please try again.' };
  }
};

export const MyUpdateProductAction = async (
  productId: string,
  patch: z.infer<typeof ProductUpdatePatchSchema>
): Promise<UpdateProductResult> => {
  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const role = session?.user?.role;
    if (!sessionUserId) {
      return { error: 'Unauthorized' };
    }

    const parsedPatch = ProductUpdatePatchSchema.safeParse(patch);
    if (!parsedPatch.success) {
      return { error: 'Invalid update payload' };
    }

    const product = await dbPrisma.product.findUnique({
      where: { id: productId },
      select: { 
        id: true, 
        userId: true, 
        companyId: true,
        Company: { select: { ownerId: true } },
      },
    });

    if (!product) return { error: 'Product not found' };

    const isAdminLike = role === 'ADMIN' || role === 'OWNER';
    const isProductOwner = product.userId === sessionUserId;
    const isCompanyOwner = product.Company?.ownerId === sessionUserId;
    let allowed = isAdminLike || isProductOwner || isCompanyOwner;

    // Check employee permissions if not already allowed
    if (!allowed && product.companyId) {
      const employee = await dbPrisma.employee.findFirst({
        where: { userId: sessionUserId, companyId: product.companyId },
        select: { permissions: true },
      });

      const p: any = employee?.permissions ?? {};
      const canEdit = p?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true;
      allowed = canEdit;
    }

    if (!allowed) {
      return { error: 'Forbidden' };
    }

    const acceptedTokens = parsedPatch.data.acceptedTokens;
    if (acceptedTokens) {
      const requestedReceiverWalletIds = new Set(
        acceptedTokens
          .map((token) => token.receiverWalletId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      );
      if (requestedReceiverWalletIds.size > 0) {
        const wallets = await dbPrisma.wallet.findMany({
          where: {
            id: { in: [...requestedReceiverWalletIds] },
            verifiedAt: { not: null },
            OR: [
              { ownerUserId: sessionUserId, ownerCompanyId: null },
              ...(product.companyId ? [{ ownerCompanyId: product.companyId }] : []),
            ],
          },
          select: { id: true },
        });
        const allowedReceiverWalletIds = new Set(wallets.map((wallet) => wallet.id));
        const invalidWalletId = [...requestedReceiverWalletIds].find((id) => !allowedReceiverWalletIds.has(id));
        if (invalidWalletId) {
          return { error: 'Choose a verified receiving wallet that belongs to this seller.' };
        }
      }
    }

    await dbPrisma.$transaction(async (tx) => {
      const nextPriceCurrency = (parsedPatch.data.priceCurrency ?? undefined) as any;
        const nextAcceptedFiatCurrencies = Array.isArray(parsedPatch.data.acceptedFiatCurrencies)
          ? parsedPatch.data.acceptedFiatCurrencies
          : undefined;

        const acceptedFiatCurrenciesPatched = (() => {
          if (!nextAcceptedFiatCurrencies) return undefined;
          const normalized = Array.from(new Set(nextAcceptedFiatCurrencies.filter(Boolean)));
          if (normalized.length) return normalized;
          if (nextPriceCurrency) return [nextPriceCurrency];
          return undefined;
        })();

      const specificationsPatched = (() => {
        if (!Array.isArray(parsedPatch.data.specifications)) return undefined;
        return JSON.stringify(parsedPatch.data.specifications);
      })();

      const featuresPatched = (() => {
        if (!Array.isArray(parsedPatch.data.features)) return undefined;
        return JSON.stringify(parsedPatch.data.features);
      })();

      const shouldUpdateProduct =
        typeof parsedPatch.data.title === 'string' ||
        typeof parsedPatch.data.description === 'string' ||
        typeof parsedPatch.data.category === 'string' ||
        typeof parsedPatch.data.price === 'number' ||
        typeof parsedPatch.data.priceCurrency === 'string' ||
        Boolean(acceptedFiatCurrenciesPatched) ||
        typeof parsedPatch.data.condition === 'string' ||
        typeof parsedPatch.data.stock === 'number' ||
        typeof parsedPatch.data.shipFromPostalId === 'string' ||
        Array.isArray(parsedPatch.data.image) ||
        typeof specificationsPatched === 'string' ||
        typeof featuresPatched === 'string';

      if (shouldUpdateProduct) {

        await tx.product.update({
          where: { id: productId },
          data: {
            ...(typeof parsedPatch.data.title === 'string' ? { title: parsedPatch.data.title } : {}),
            ...(typeof parsedPatch.data.description === 'string' ? { description: parsedPatch.data.description } : {}),
            ...(typeof parsedPatch.data.category === 'string' ? { category: parsedPatch.data.category } : {}),
            ...(typeof parsedPatch.data.price === 'number' ? { price: parsedPatch.data.price } : {}),
            ...(typeof parsedPatch.data.priceCurrency === 'string' ? { priceCurrency: parsedPatch.data.priceCurrency as any } : {}),
            ...(acceptedFiatCurrenciesPatched ? { acceptedFiatCurrencies: acceptedFiatCurrenciesPatched as any } : {}),
            ...(typeof parsedPatch.data.condition === 'string' ? { condition: parsedPatch.data.condition as any } : {}),
            ...(typeof parsedPatch.data.stock === 'number' ? { stock: parsedPatch.data.stock } : {}),
            ...(typeof parsedPatch.data.shipFromPostalId === 'string' ? { shipFromPostalId: parsedPatch.data.shipFromPostalId } : {}),
            ...(Array.isArray(parsedPatch.data.image) ? { image: parsedPatch.data.image } : {}),
            ...(typeof specificationsPatched === 'string' ? { specifications: specificationsPatched as any } : {}),
            ...(typeof featuresPatched === 'string' ? { features: featuresPatched as any } : {}),
          },
        });
      }

      if (acceptedTokens) {
        const normalized = acceptedTokens.map((t) => ({
          family: t.family,
          symbol: t.symbol.toUpperCase().trim(),
          decimals: t.decimals,
          tokenAddress: t.tokenAddress ?? null,
          tokenMint: t.tokenMint ?? null,
          receiverWalletId: t.receiverWalletId ?? null,
          receiverAddress: t.receiverAddress ?? null,
        }));

        // delete tokens not present anymore
        const keep = new Set(normalized.map((t) => `${t.family}:${t.symbol}`));
        const existing = await tx.productAcceptedToken.findMany({
          where: { productId },
          select: { id: true, family: true, symbol: true },
        });

        const toDelete = existing
          .filter((e) => !keep.has(`${e.family}:${e.symbol}`))
          .map((e) => e.id);

        if (toDelete.length) {
          await tx.productAcceptedToken.deleteMany({ where: { id: { in: toDelete } } });
        }

        // upsert current list
        for (const t of normalized) {
          await tx.productAcceptedToken.upsert({
            where: {
              productId_family_symbol: {
                productId,
                family: t.family as any,
                symbol: t.symbol,
              },
            },
            create: {
              productId,
              family: t.family as any,
              symbol: t.symbol,
              decimals: t.decimals,
              tokenAddress: t.tokenAddress,
              tokenMint: t.tokenMint,
              receiverWalletId: t.receiverWalletId,
              receiverAddress: t.receiverAddress,
            },
            update: {
              decimals: t.decimals,
              tokenAddress: t.tokenAddress,
              tokenMint: t.tokenMint,
              receiverWalletId: t.receiverWalletId,
              receiverAddress: t.receiverAddress,
            },
          });
        }
      }
    });

    return { success: 'Product updated successfully.' };
  } catch (error) {
    console.error('Error updating product: ', error);
    return { error: 'Failed to update product.' };
  }
};

export const MySetProductVisibilityAction = async (
  productId: string,
  visibility: ProductVisibilityValue
) => {
  try {
    const parsedVisibility = ProductVisibilitySchema.safeParse(visibility);
    if (!parsedVisibility.success) {
      return { error: 'Invalid product visibility' };
    }

    const access = await canManageProductLifecycle(productId);
    if (!access.allowed) {
      return { error: access.error };
    }

    const nextVisibility = parsedVisibility.data;
    const now = new Date();
    const data: any = {
      visibility: nextVisibility,
      updatedAt: now,
    };

    if (nextVisibility === 'PUBLIC') {
      data.hiddenAt = null;
      data.archivedAt = null;
    }

    if (nextVisibility === 'HIDDEN') {
      data.hiddenAt = now;
      data.archivedAt = null;
    }

    if (nextVisibility === 'ARCHIVED') {
      data.hiddenAt = null;
      data.archivedAt = now;
      data.downloadsEnabled = false;
    }

    await dbPrisma.product.update({
      where: { id: productId },
      data,
    });

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);

    const action =
      nextVisibility === 'PUBLIC'
        ? 'published'
        : nextVisibility === 'HIDDEN'
          ? 'hidden from the public marketplace'
          : 'archived';

    return {
      success: `Product "${access.product.title}" was ${action}. Existing orders and download records were preserved.`,
      visibility: nextVisibility,
    };
  } catch (error) {
    console.error('Error updating product visibility: ', error);
    return { error: 'Failed to update product visibility.' };
  }
};

/**
 * Archive a product (requires ownership or company permission)
 */
export const MyDeleteProductAction = async (productId: string) => {
  try {
    return await MySetProductVisibilityAction(productId, 'ARCHIVED');
  } catch (error) {
    console.error('Error deleting product: ', error);
    return { error: 'Failed to archive product.' };
  }
};
