import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limit = await checkRateLimit(getClientIdentifier(request, session.user.id), 'read');
    if (!limit.success) return rateLimitedResponse(limit);

    // Fetch all download tokens for the user
    const downloadTokens = await dbPrisma.downloadToken.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        DigitalAsset: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
          },
        },
        Order: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    // Get all unique digitalAssetIds to find products
    const digitalAssetIds = downloadTokens
      .map(t => t.digitalAssetId)
      .filter((id, index, self) => self.indexOf(id) === index);

    // Multi-file products do not use Product.digitalAssetId for every file.
    // Resolve the purchased line and legacy assets concurrently; both are
    // derived from this buyer's tokens, never from client-supplied IDs.
    const [items, products] = await Promise.all([dbPrisma.orderItem.findMany({
      where: { id: { in: downloadTokens.flatMap(token => token.orderItemId ? [token.orderItemId] : []) }, Order: { userId: session.user.id } },
      select: { id: true, orderId: true, Product: { select: { id: true, title: true, image: true } } },
    }), dbPrisma.product.findMany({
      where: {
        digitalAssetId: { in: digitalAssetIds },
      },
      select: {
        id: true,
        title: true,
        image: true,
        digitalAssetId: true,
      },
    })]);
    const itemMap = new Map(items.map(item => [item.id, item]));

    // Create a map of digitalAssetId to product
    const productMap = new Map(
      products.map(p => [p.digitalAssetId, p])
    );

    // Transform the data for the frontend
    const downloads = downloadTokens.map((token) => {
      const item = token.orderItemId ? itemMap.get(token.orderItemId) : null;
      const product = item?.orderId === token.orderId ? item.Product : productMap.get(token.digitalAssetId);
      
      return {
        id: token.id,
        token: token.token,
        maxUses: token.maxUses,
        usedCount: token.usedCount,
        expiresAt: token.expiresAt?.toISOString() || null,
        isRevoked: token.isRevoked,
        createdAt: token.createdAt.toISOString(),
        digitalAsset: token.DigitalAsset ? {
          id: token.DigitalAsset.id,
          fileName: token.DigitalAsset.fileName,
          fileSize: token.DigitalAsset.fileSize,
          mimeType: token.DigitalAsset.mimeType,
        } : null,
        order: token.Order ? {
          id: token.Order.id,
          createdAt: token.Order.createdAt.toISOString(),
        } : null,
        product: product ? {
          id: product.id,
          title: product.title,
          image: product.image,
        } : null,
      };
    }).filter((d) => d.digitalAsset && d.order);

    return NextResponse.json({ downloads }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching downloads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch downloads' },
      { status: 500 }
    );
  }
}
