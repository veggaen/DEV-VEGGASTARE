import { dbPrisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check endpoint for monitoring (Vercel, uptime robots, etc.)
 * Returns 200 if the app + database are reachable, 503 otherwise.
 */
export async function GET() {
  const start = Date.now();

  try {
    // Lightweight DB ping — fastest possible query
    await dbPrisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        dbLatencyMs: Date.now() - start,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Database unreachable",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
