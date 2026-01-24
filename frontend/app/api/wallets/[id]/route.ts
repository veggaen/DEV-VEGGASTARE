import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const w = await dbPrisma.wallet.findUnique({ where: { id: params.id } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(w);
}
