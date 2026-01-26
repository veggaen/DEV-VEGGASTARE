import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const w = await dbPrisma.wallet.findUnique({ where: { id: resolvedParams.id } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(w);
}
