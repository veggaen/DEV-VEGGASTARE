import { dbPrisma } from '@/lib/db';
import crypto from 'crypto';

const UNLIMITED_DOWNLOAD_USES = 2_147_483_647;

interface GenerateDownloadTokensParams {
  orderId: string;
  userId: string;
  orderItems: Array<{
    id?: string;
    productId: string;
  }>;
}

interface DownloadTokenResult {
  productId: string;
  productTitle: string;
  token: string;
  downloadUrl: string;
  fileName: string;
  expiresAt: Date | null;
  maxDownloads: number;
}

/**
 * Generate secure download tokens for digital products in an order
 */
export async function generateDownloadTokensForOrder(
  params: GenerateDownloadTokensParams
): Promise<DownloadTokenResult[]> {
  const { orderId, userId, orderItems } = params;
  const results: DownloadTokenResult[] = [];

  // Get all products with digital assets
  const productIds = orderItems.map(item => item.productId);
  
  const products = await dbPrisma.product.findMany({
    where: {
      id: { in: productIds },
      productType: { in: ['DIGITAL', 'HYBRID'] },
      digitalAssetId: { not: null },
      downloadsEnabled: true,
    },
    include: {
      DigitalAsset: true,
    },
  });

  for (const product of products) {
    if (!product.DigitalAsset) continue;
    const maxUses = product.maxDownloads ?? UNLIMITED_DOWNLOAD_USES;

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiry date
    const expiresAt = product.downloadExpiryDays
      ? new Date(Date.now() + product.downloadExpiryDays * 24 * 60 * 60 * 1000)
      : null;

    // Find the order item ID if available
    const orderItem = orderItems.find(item => item.productId === product.id);

    // Create download token
    await dbPrisma.downloadToken.create({
      data: {
        token,
        digitalAssetId: product.digitalAssetId!,
        orderId,
        orderItemId: orderItem?.id || null,
        userId,
        maxUses,
        expiresAt,
      },
    });

    results.push({
      productId: product.id,
      productTitle: product.title,
      token,
      downloadUrl: `/api/download/${token}`,
      fileName: product.DigitalAsset.fileName,
      expiresAt,
      maxDownloads: maxUses,
    });
  }

  return results;
}

/**
 * Revoke all download tokens for an order (e.g., refund)
 */
export async function revokeDownloadTokensForOrder(
  orderId: string,
  reason: string = 'Order cancelled or refunded'
): Promise<number> {
  const result = await dbPrisma.downloadToken.updateMany({
    where: { orderId, isRevoked: false },
    data: {
      isRevoked: true,
      revokedReason: reason,
    },
  });
  
  return result.count;
}

/**
 * Get download tokens for a user's order
 */
export async function getDownloadTokensForOrder(
  orderId: string,
  userId: string
): Promise<DownloadTokenResult[]> {
  const tokens = await dbPrisma.downloadToken.findMany({
    where: {
      orderId,
      userId,
      isRevoked: false,
    },
    include: {
      DigitalAsset: {
        select: {
          fileName: true,
          fileSize: true,
          mimeType: true,
        },
      },
    },
  });

  // Get product info
  const digitalAssetIds = tokens.map(t => t.digitalAssetId);
  const products = await dbPrisma.product.findMany({
    where: { digitalAssetId: { in: digitalAssetIds } },
    select: { id: true, title: true, digitalAssetId: true },
  });

  const productMap = new Map(products.map(p => [p.digitalAssetId, p]));

  return tokens.map(token => {
    const product = productMap.get(token.digitalAssetId);
    return {
      productId: product?.id || '',
      productTitle: product?.title || 'Unknown Product',
      token: token.token,
      downloadUrl: `/api/download/${token.token}`,
      fileName: token.DigitalAsset.fileName,
      expiresAt: token.expiresAt,
      maxDownloads: token.maxUses,
    };
  });
}
