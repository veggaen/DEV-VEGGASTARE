import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { dbPrisma } from "@/lib/db";
import { z } from "zod";

const SiteNoticeSchema = z.object({
  dismissedVersion: z.number().int().min(0).max(1_000_000),
});

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

  const json = await req.json().catch(() => null);
  const parsed = SiteNoticeSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dismissedVersion" }, { status: 400 });
  }

  const { dismissedVersion } = parsed.data;

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
