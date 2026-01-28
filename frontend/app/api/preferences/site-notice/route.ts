import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { dbPrisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ dismissedVersion: null });
  }

  // Backward-compatible: this column may not exist yet in DB/Prisma Client.
  // If it doesn't, fall back to localStorage-only behavior in the client.
  try {
    const user = await (dbPrisma as any).user.findUnique({
      where: { id: userId },
      select: { siteNoticeDismissedVersion: true },
    });

    return NextResponse.json({ dismissedVersion: user?.siteNoticeDismissedVersion ?? 0 });
  } catch {
    return NextResponse.json({ dismissedVersion: null });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const dismissedVersion = Number((body as any)?.dismissedVersion);

  if (!Number.isFinite(dismissedVersion) || dismissedVersion < 0 || dismissedVersion > 1_000_000) {
    return NextResponse.json({ error: "Invalid dismissedVersion" }, { status: 400 });
  }

  try {
    await (dbPrisma as any).user.update({
      where: { id: userId },
      data: { siteNoticeDismissedVersion: dismissedVersion },
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Column missing: behave as a no-op so logged-out localStorage still works.
    return NextResponse.json({ ok: true, persisted: false });
  }
}
