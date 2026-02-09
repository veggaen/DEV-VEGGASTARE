import { NextResponse } from 'next/server';

/**
 * GET /api/version
 * 
 * Returns the current build ID so clients can detect stale UI.
 * Vercel sets VERCEL_GIT_COMMIT_SHA at build time.
 * Falls back to a timestamp-based ID for local dev.
 */
export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    process.env.NEXT_BUILD_ID ||
    'dev';

  return NextResponse.json(
    { buildId, timestamp: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
