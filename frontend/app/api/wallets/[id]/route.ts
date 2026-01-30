import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { z } from "zod";

// Validate wallet ID format (CUID)
const walletIdSchema = z.string().min(1).max(200);

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authentication required
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;

  // Validate ID parameter
  const idResult = walletIdSchema.safeParse(resolvedParams.id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid wallet ID" }, { status: 400 });
  }

  const w = await dbPrisma.wallet.findUnique({ where: { id: idResult.data } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authorization: Only wallet owner or admin can view wallet details
  const isOwner = w.ownerUserId === session.id;
  const isAdmin = session.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(w);
}
