import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";

export async function POST(req: NextRequest) {
  const me = await MyLibUserAuth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { label, family, address, chainId, solanaCluster, ownerCompanyId, isDefault } = await req.json();

  // If attaching to a company, ensure the caller owns or created it
  if (ownerCompanyId) {
    const company = await dbPrisma.company.findUnique({ where: { id: ownerCompanyId } });
    if (!company || (company.ownerId !== me.id && company.creatorId !== me.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (isDefault) {
    await dbPrisma.wallet.updateMany({
      where: {
        family,
        OR: [
          { ownerCompanyId: ownerCompanyId || undefined },
          { ownerUserId: ownerCompanyId ? undefined : me.id },
        ],
      },
      data: { isDefault: false },
    });
  }

  const wallet = await dbPrisma.wallet.create({
    data: {
      label,
      family,
      address,
      chainId: chainId ?? null,
      solanaCluster: solanaCluster ?? null,
      isDefault: !!isDefault,
      ownerCompanyId: ownerCompanyId ?? null,
      ownerUserId: ownerCompanyId ? null : me.id,
    },
  });

  return NextResponse.json(wallet, { status: 201 });
}
