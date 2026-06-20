import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    });

    // Get all unique digitalAssetIds to find products
    const digitalAssetIds = downloadTokens
      .map(t => t.digitalAssetId)
      .filter((id, index, self) => self.indexOf(id) === index);

    // Find products that have these digital assets
    const products = await dbPrisma.product.findMany({
      where: {
        digitalAssetId: { in: digitalAssetIds },
      },
      select: {
        id: true,
        title: true,
        image: true,
        digitalAssetId: true,
      },
    });

    // Create a map of digitalAssetId to product
    const productMap = new Map(
      products.map(p => [p.digitalAssetId, p])
    );

    // Transform the data for the frontend
    const downloads = downloadTokens.map((token) => {
      const product = token.digitalAssetId ? productMap.get(token.digitalAssetId) : null;
      
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

    return NextResponse.json({ downloads });
  } catch (error) {
    console.error('Error fetching downloads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch downloads' },
      { status: 500 }
    );
  }
}
