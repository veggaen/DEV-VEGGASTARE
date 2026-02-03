import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

const isDev = process.env.NODE_ENV !== 'production';

// Schema for creating a digital asset record
const CreateDigitalAssetSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(100),
  fileExtension: z.string().min(1).max(20),
  storageKey: z.string().min(1), // EdgeStore URL or storage path
  checksum: z.string().min(1).optional(), // Client can provide, or we generate
  companyId: z.string().optional(),
});

/**
 * POST /api/digital-assets
 * Creates a digital asset record after file upload to EdgeStore
 */
export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(req, CreateDigitalAssetSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { fileName, fileSize, mimeType, fileExtension, storageKey, checksum, companyId } = bodyResult.data;

  // If company product, verify user has permission
  if (companyId) {
    const employee = await dbPrisma.employee.findFirst({
      where: { userId: session.id, companyId },
    });
    
    if (!employee) {
      return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 });
    }
    
    const permissions = employee.permissions as Record<string, boolean> | null;
    const canUpload = permissions?.CAN_UPLOAD_DIGITAL_ASSETS || 
                      permissions?.CAN_CREATE_DIGITAL_PRODUCT ||
                      employee.role === 'OWNER' || 
                      employee.role === 'MANAGER';
    
    if (!canUpload) {
      return NextResponse.json({ error: 'No permission to upload digital assets' }, { status: 403 });
    }
  }

  try {
    // Generate checksum if not provided (ideally client calculates this)
    const finalChecksum = checksum || crypto.randomBytes(32).toString('hex');

    const digitalAsset = await dbPrisma.digitalAsset.create({
      data: {
        fileName,
        fileSize,
        mimeType,
        fileExtension: fileExtension.toLowerCase().replace(/^\./, ''),
        storageKey,
        storageProvider: 'EDGESTORE',
        checksum: finalChecksum,
        uploadedById: session.id,
        companyId: companyId || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: digitalAsset.id,
      fileName: digitalAsset.fileName,
      fileSize: digitalAsset.fileSize,
      mimeType: digitalAsset.mimeType,
      fileExtension: digitalAsset.fileExtension,
      createdAt: digitalAsset.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[api/digital-assets] Error creating digital asset:', error);
    return NextResponse.json(
      { error: 'Failed to create digital asset', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/digital-assets
 * List digital assets for the current user or company
 */
export async function GET(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  try {
    const where = companyId 
      ? { companyId, isActive: true }
      : { uploadedById: session.id, companyId: null, isActive: true };

    const assets = await dbPrisma.digitalAsset.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        fileExtension: true,
        createdAt: true,
        updatedAt: true,
        Product: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('[api/digital-assets] Error listing digital assets:', error);
    return NextResponse.json(
      { error: 'Failed to list digital assets' },
      { status: 500 }
    );
  }
}
