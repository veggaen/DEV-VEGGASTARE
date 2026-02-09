'use server';

import { auth } from '@/auth';
import { dbPrisma } from "@/lib/db";
import { MyProductCreateSchema, type CategoryTag } from "@/schemas";
import { Prisma } from "@/generated/prisma/browser";
import { z } from "zod";
import { createSlug } from "@/lib/category-utils";

type CreateProductResult = { error: string } | { success: string; productId: string };
type UpdateProductResult = { error: string } | { success: string };

const ProductAcceptedTokenInputSchema = z
  .object({
    family: z.enum(['EVM', 'SOLANA']),
    symbol: z.string().min(1).max(32),
    decimals: z.number().int().nonnegative().max(255),
    tokenAddress: z.string().trim().min(1).max(200).nullable().optional(),
    tokenMint: z.string().trim().min(1).max(200).nullable().optional(),
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

// Helper: Handle categories - create new ones or link existing ones
async function handleCategories(
  productId: string,
  categories: CategoryTag[],
  userId: string
): Promise<void> {
  if (!categories || categories.length === 0) return;

  for (const cat of categories) {
    let categoryId = cat.id;

    // If it's a new category (no ID), create it
    if (!categoryId || cat.isNew) {
      const slug = createSlug(cat.name);
      
      // Check if category with this slug already exists
      const existing = await dbPrisma.category.findUnique({
        where: { slug },
      });

      if (existing) {
        categoryId = existing.id;
      } else {
        // Create new category
        const newCategory = await dbPrisma.category.create({
          data: {
            name: cat.name.trim(),
            slug,
            parentId: cat.parentId || null,
            createdById: userId,
          },
        });
        categoryId = newCategory.id;
      }
    }

    // Link category to product
    await dbPrisma.productCategory.create({
      data: {
        productId,
        categoryId,
      },
    });
  }
}

export const MyCreateProductAction = async (data: z.infer<typeof MyProductCreateSchema>, postalCodes: string[]): Promise<CreateProductResult> => {
  try {
    console.log('Server is Creating a product with data: ', data);
    const validatedData = MyProductCreateSchema.parse(data);

    const cleanedPostalCodes = Array.from(
      new Set((postalCodes ?? []).map((p) => p.trim()).filter(Boolean))
    );

    // Check if this product needs physical shipping
    const needsShipping = validatedData.productType === 'PHYSICAL' || validatedData.productType === 'HYBRID';
    
    if (needsShipping && cleanedPostalCodes.length === 0) {
      return { error: 'Please add at least one ship-from postal code for a physical product.' };
    }

    // Check if digital product has an asset
    const needsDigitalAsset = validatedData.productType === 'DIGITAL' || validatedData.productType === 'HYBRID';
    if (needsDigitalAsset && !validatedData.digitalAssetId) {
      return { error: 'Digital products require a digital asset file.' };
    }

    const product = await dbPrisma.product.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        condition: validatedData.condition ?? 'NEW',
        price: validatedData.price,
        priceCurrency: (validatedData as any).priceCurrency ?? 'USD',
        acceptedFiatCurrencies: (() => {
          const pc = ((validatedData as any).priceCurrency ?? 'USD') as string;
          const list = Array.isArray((validatedData as any).acceptedFiatCurrencies)
            ? ((validatedData as any).acceptedFiatCurrencies as string[])
            : [];
          const normalized = Array.from(new Set(list.filter(Boolean)));
          return normalized.length ? (normalized as any) : ([pc] as any);
        })(),
        stock: validatedData.quantity,
        shipFromPostalId: validatedData.shipFromPostalId ?? cleanedPostalCodes.join(', '),
        image: validatedData.image,
        specifications: validatedData.specifications ? JSON.stringify(validatedData.specifications) : Prisma.JsonNull,
        features: validatedData.features ? JSON.stringify(validatedData.features) : Prisma.JsonNull,
        userId: validatedData.userId,
        companyId: validatedData.companyId ?? null,
        // Digital product fields
        productType: validatedData.productType ?? 'PHYSICAL',
        digitalAssetId: validatedData.digitalAssetId ?? null,
        downloadsEnabled: validatedData.downloadsEnabled ?? true,
        maxDownloads: validatedData.maxDownloads ?? null,
        downloadExpiryDays: validatedData.downloadExpiryDays ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('Product created: ', product);

    // Handle categories - create new ones and link to product
    if (validatedData.categories && validatedData.categories.length > 0) {
      await handleCategories(product.id, validatedData.categories, validatedData.userId);
      console.log('Categories linked: ', validatedData.categories.map(c => c.name).join(', '));
    }

    // Skip warehouse/inventory setup for digital-only products
    if (!needsShipping || cleanedPostalCodes.length === 0) {
      return { success: 'Product created successfully.', productId: product.id };
    }

    const quantityPerWarehouse = Math.floor(validatedData.quantity / cleanedPostalCodes.length);
    const remainder = validatedData.quantity % cleanedPostalCodes.length;

    console.log('Quantity per warehouse: ', quantityPerWarehouse, ' Remainder: ', remainder);

    for (let i = 0; i < cleanedPostalCodes.length; i++) {
      const postalCode = cleanedPostalCodes[i];
      
      let warehouse = await dbPrisma.warehouseLocation.findFirst({
        where: { postalCode },
      });

      if (!warehouse) {
        warehouse = await dbPrisma.warehouseLocation.create({
          data: {
            postalCode,
            address: '',
            city: '',
            country: 'Norway',
            userId: validatedData.userId,
            companyId: validatedData.companyId ?? null,
          },
        });
      }

      console.log('Warehouse for postal code ', postalCode, ': ', warehouse);

      const inventory = await dbPrisma.inventory.create({
        data: {
          quantity: i === 0 ? quantityPerWarehouse + remainder : quantityPerWarehouse,
          stock: i === 0 ? quantityPerWarehouse + remainder : quantityPerWarehouse,
          warehouseId: warehouse.id,
          productId: product.id,
        },
      });

      console.log('Inventory created: ', inventory);
    }

    return { success: "Product created successfully with inventory distributed among warehouses.", productId: product.id };
  } catch (error) {
    console.error('Error creating product: ', error);
    return { error: "Failed to create product." };
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
            },
            update: {
              decimals: t.decimals,
              tokenAddress: t.tokenAddress,
              tokenMint: t.tokenMint,
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

/**
 * Delete a product (requires ownership or company permission)
 */
export const MyDeleteProductAction = async (productId: string) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: 'Unauthorized' };
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
      return { error: 'Product not found' };
    }

    // Check permissions
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
      // Can delete if they have delete product permission OR edit product permission (backwards compat)
      const canDelete = p?.CAN_DELETE_PRODUCT === true || p?.CAN_EDIT_PRODUCT_POSITION_PERMISSION === true;
      allowed = canDelete;
    }

    if (!allowed) {
      return { error: 'Forbidden - You do not have permission to delete this product' };
    }

    // Delete in transaction (cascade deletes related records)
    await dbPrisma.$transaction(async (tx) => {
      // Delete accepted tokens
      await tx.productAcceptedToken.deleteMany({
        where: { productId },
      });

      // Delete inventory records
      await tx.inventory.deleteMany({
        where: { productId },
      });

      // Delete the product
      await tx.product.delete({
        where: { id: productId },
      });
    });

    return { success: `Product "${product.title}" deleted successfully.` };
  } catch (error) {
    console.error('Error deleting product: ', error);
    return { error: 'Failed to delete product.' };
  }
};