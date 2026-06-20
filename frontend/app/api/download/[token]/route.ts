import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkRateLimit, rateLimitedResponse } from '@/lib/rate-limit';
import { initEdgeStoreSdk } from '@edgestore/server/core';

// Sanitize filename for Content-Disposition header
function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and special characters
  return filename
    .replace(/[\/\\]/g, '') // Remove slashes
    .replace(/[<>:"|?*]/g, '') // Remove reserved characters
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/[\x00-\x1f]/g, '') // Remove control characters
    .trim()
    .slice(0, 200); // Limit length
}

async function fetchStoredFile(storageKey: string) {
  const directResponse = await fetch(storageKey);
  if (directResponse.ok) return directResponse;

  try {
    const edgeStoreSdk = initEdgeStoreSdk({});
    const fileInfo = await edgeStoreSdk.getFile({ url: storageKey });
    if (fileInfo?.url && fileInfo.url !== storageKey) {
      const signedResponse = await fetch(fileInfo.url);
      if (signedResponse.ok) return signedResponse;
      console.error(`[download] Signed EdgeStore fetch failed: ${signedResponse.status}`);
    }
  } catch (error) {
    console.error('[download] EdgeStore signed URL lookup failed:', error);
  }

  return directResponse;
}

/**
 * GET /api/download/[token]
 * Secure download endpoint - validates token and proxies file download
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Invalid download token' }, { status: 400 });
  }

  // Get request metadata for logging
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || 'Unknown';
  const forwardedFor = headersList.get('x-forwarded-for');
  const clientIp = forwardedFor?.split(',')[0].trim() || 'Unknown';

  // Rate limiting check
  const rlResult = await checkRateLimit(clientIp, 'download');
  if (!rlResult.success) {
    return rateLimitedResponse(rlResult);
  }

  try {
    // Find the download token with related data - use transaction for atomic read + update
    const downloadToken = await dbPrisma.downloadToken.findUnique({
      where: { token },
      include: {
        DigitalAsset: true,
        Order: true,
        User: {
          select: { id: true, email: true },
        },
      },
    });

    if (!downloadToken) {
      return NextResponse.json({ error: 'Download token not found' }, { status: 404 });
    }

    // Check if token is revoked
    if (downloadToken.isRevoked) {
      return NextResponse.json(
        { error: 'This download link has been revoked', reason: downloadToken.revokedReason },
        { status: 403 }
      );
    }

    // Check if token is expired
    if (downloadToken.expiresAt && downloadToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This download link has expired' },
        { status: 410 }
      );
    }

    // Check download limit
    if (downloadToken.usedCount >= downloadToken.maxUses) {
      return NextResponse.json(
        { error: 'Download limit reached', used: downloadToken.usedCount, max: downloadToken.maxUses },
        { status: 429 }
      );
    }

    // Check if digital asset is active
    if (!downloadToken.DigitalAsset.isActive) {
      return NextResponse.json(
        { error: 'This file is no longer available' },
        { status: 410 }
      );
    }

    // Optional: Verify user is logged in and matches token owner (stricter security)
    const session = await MyLibUserAuth();
    if (!session?.id) {
      return NextResponse.json(
        { error: 'You must be logged in to download this file' },
        { status: 401 }
      );
    }
    
    if (session.id !== downloadToken.userId) {
      console.warn(`[download] User ${session.id} attempted to use token belonging to ${downloadToken.userId}`);
      return NextResponse.json(
        { error: 'This download link belongs to another user' },
        { status: 403 }
      );
    }

    // Fetch the file from EdgeStore and proxy it to the user
    const fileUrl = downloadToken.DigitalAsset.storageKey;
    const fileResponse = await fetchStoredFile(fileUrl);

    if (!fileResponse.ok) {
      console.error(`[download] Failed to fetch file from storage: ${fileResponse.status}`);
      return NextResponse.json(
        {
          error: 'We could not retrieve the file from storage yet.',
          detail: 'Your download token is still valid. Please retry shortly or contact support with this order id.',
        },
        { status: 502 }
      );
    }

    // Get file content
    const fileBuffer = await fileResponse.arrayBuffer();

    // Atomically increment usage counter only after storage returned the file.
    const updatedToken = await dbPrisma.downloadToken.update({
      where: { 
        id: downloadToken.id,
        usedCount: { lt: downloadToken.maxUses }
      },
      data: {
        usedCount: { increment: 1 },
        lastUsedAt: new Date(),
        lastUsedIp: clientIp,
        userAgent: userAgent.substring(0, 500),
      },
    }).catch(() => null);

    if (!updatedToken) {
      return NextResponse.json(
        { error: 'Download limit reached or token expired' },
        { status: 429 }
      );
    }
    const sanitizedFilename = sanitizeFilename(downloadToken.DigitalAsset.fileName);
    const contentType = downloadToken.DigitalAsset.mimeType || 'application/octet-stream';

    // Return the file as a download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('[api/download] Error processing download:', error);
    return NextResponse.json(
      { error: 'Failed to process download' },
      { status: 500 }
    );
  }
}
