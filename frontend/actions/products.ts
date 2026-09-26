'use server';

import { auth } from '@/auth';
import { MyProductCreateSchema } from "@/schemas";
import { Prisma } from "@/generated/prisma/browser";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from '@/lib/rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';
import { publishProduct, ProductPublishingError } from '@/lib/product-publishing';
import { productRequestActor, withProductAccess, productLifecycleFailure, ProductLifecycleError, NO_PRODUCT_ACCESS } from '@/lib/product-lifecycle';
import { replacePublicProductSpecifications } from '@/lib/product-specifications';

type CreateProductResult = { error: string } | { success: string; productId: string };
type UpdateProductResult = { error: string; success?: never } | { success: string; error?: never };
type EnsureOwnerTestProductResult =
  | { error: string }
  | { success: string; productId: string; created: boolean };
type ProductVisibilityValue = 'PUBLIC' | 'HIDDEN' | 'ARCHIVED';
type VisibilityResult = { error: string; success?: never; visibility?: never } | { success: string; visibility: ProductVisibilityValue; error?: never };

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
    key: z.string().trim().min(1).max(200).refine(key => !key.startsWith('__')),
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
    price: z.number().finite().min(0).max(1_000_000).optional(),
    priceCurrency: z.enum(['USD', 'NOK', 'EUR', 'GBP']).optional(),
    acceptedFiatCurrencies: z.array(z.enum(['USD', 'NOK', 'EUR', 'GBP'])).optional(),
    condition: z.enum(['NEW', 'AS_NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
    stock: z.number().int().min(0).max(1_000_000).optional(),
    shipFromPostalId: z.string().trim().min(0).max(2000).optional(),
    image: z.array(z.string().url().max(2048).refine(value => new URL(value).protocol === 'https:')).min(1).max(8).optional(),
    specifications: z.array(SpecificationInputSchema).max(200).optional(),
    features: z.array(FeatureInputSchema).max(50).optional(),
    acceptedTokens: z.array(ProductAcceptedTokenInputSchema).max(20).optional(),
  })
  .strict();

const ProductVisibilitySchema = z.enum(['PUBLIC', 'HIDDEN', 'ARCHIVED']);

export async function getProductManagementAccess(productId: string) {
  try { return await withProductAccess(await productRequestActor(false), productId, 'read', async (_tx, _product, access) => access); }
  catch { return NO_PRODUCT_ACCESS; }
}

function refreshProduct(productId: string) {
  try { revalidatePath('/products'); revalidatePath(`/products/${productId}`); revalidatePath('/my-sales'); }
  catch { console.error('[products] Post-save cache refresh deferred'); }
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
    const actor = await productRequestActor();
    const sessionUserId = actor.id;

    const parsedPatch = ProductUpdatePatchSchema.safeParse(patch);
    if (!parsedPatch.success) {
      return { error: 'Invalid update payload' };
    }

    await withProductAccess(actor, productId, 'edit', async (tx, product) => {
    const acceptedTokens = parsedPatch.data.acceptedTokens;
    if (acceptedTokens) {
      const requestedReceiverWalletIds = new Set(
        acceptedTokens
          .map((token) => token.receiverWalletId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      );
      if (requestedReceiverWalletIds.size > 0) {
        const wallets = await tx.wallet.findMany({
          where: {
            id: { in: [...requestedReceiverWalletIds] },
            verifiedAt: { not: null },
            OR: [
              ...(!product.companyId ? [{ ownerUserId: sessionUserId, ownerCompanyId: null }] : []),
              ...(product.companyId ? [{ ownerCompanyId: product.companyId }] : []),
            ],
          },
          select: { id: true },
        });
        const allowedReceiverWalletIds = new Set(wallets.map((wallet) => wallet.id));
        const invalidWalletId = [...requestedReceiverWalletIds].find((id) => !allowedReceiverWalletIds.has(id));
        if (invalidWalletId) {
          throw new ProductLifecycleError('Choose a verified receiving wallet that belongs to this seller.');
        }
      }
    }

      const nextPriceCurrency = parsedPatch.data.priceCurrency;
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

      let specificationsPatched: string | undefined;
      if (parsedPatch.data.specifications) {
        const existing = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { specifications: true } });
        specificationsPatched = JSON.stringify(replacePublicProductSpecifications(existing.specifications, parsedPatch.data.specifications));
      }

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
            ...(typeof parsedPatch.data.priceCurrency === 'string' ? { priceCurrency: parsedPatch.data.priceCurrency } : {}),
            ...(acceptedFiatCurrenciesPatched ? { acceptedFiatCurrencies: acceptedFiatCurrenciesPatched } : {}),
            ...(typeof parsedPatch.data.condition === 'string' ? { condition: parsedPatch.data.condition } : {}),
            ...(typeof parsedPatch.data.stock === 'number' ? { stock: parsedPatch.data.stock } : {}),
            ...(typeof parsedPatch.data.shipFromPostalId === 'string' ? { shipFromPostalId: parsedPatch.data.shipFromPostalId } : {}),
            ...(Array.isArray(parsedPatch.data.image) ? { image: parsedPatch.data.image } : {}),
            ...(typeof specificationsPatched === 'string' ? { specifications: specificationsPatched } : {}),
            ...(typeof featuresPatched === 'string' ? { features: featuresPatched } : {}),
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
                family: t.family,
                symbol: t.symbol,
              },
            },
            create: {
              productId,
              family: t.family,
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

    refreshProduct(productId);
    return { success: 'Product updated successfully.' };
  } catch (error) {
    return productLifecycleFailure(error);
  }
};

export const MySetProductVisibilityAction = async (
  productId: string,
  visibility: ProductVisibilityValue
): Promise<VisibilityResult> => {
  try {
    const parsedVisibility = ProductVisibilitySchema.safeParse(visibility);
    if (!parsedVisibility.success) {
      return { error: 'Invalid product visibility' };
    }

    const nextVisibility = parsedVisibility.data;
    const product = await withProductAccess(await productRequestActor(), productId, nextVisibility === 'ARCHIVED' ? 'archive' : 'visibility', async (tx, product) => {
    const now = new Date();
    const data: Prisma.ProductUpdateInput = {
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
      // Archiving stops new sales, not previously purchased download access.
    }

    await tx.product.update({
      where: { id: productId },
      data,
    });

    return product;
    });
    refreshProduct(productId);

    const action =
      nextVisibility === 'PUBLIC'
        ? 'published'
        : nextVisibility === 'HIDDEN'
          ? 'hidden from the public marketplace'
          : 'archived';

    return {
      success: `Product "${product.title}" was ${action}. Existing orders and download records were preserved.`,
      visibility: nextVisibility,
    };
  } catch (error) {
    return productLifecycleFailure(error);
  }
};

/**
 * Archive a product (requires ownership or company permission)
 */
export const MyDeleteProductAction = async (productId: string): Promise<VisibilityResult> =>
  MySetProductVisibilityAction(productId, 'ARCHIVED');
