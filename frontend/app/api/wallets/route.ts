import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { parseJsonOrError } from "@/lib/api-validate";
import { ChainFamily } from "@/generated/prisma/browser";
import { z } from "zod";
import { WalletDtoSchema } from "@/lib/types/wallets";

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

const createWalletSchema = z.object({
  label: z.string().trim().min(1).max(64),
  family: z.nativeEnum(ChainFamily),
  address: z.string().trim().min(1).max(256),
  chainId: z.coerce.number().int().positive().optional().nullable(),
  solanaCluster: z.string().trim().min(1).max(64).optional().nullable(),
  ownerCompanyId: z.string().trim().min(1).max(200).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const me = await MyLibUserAuth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bodyResult = await parseJsonOrError(req, createWalletSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { label, family, address, chainId, solanaCluster, ownerCompanyId, isDefault } = bodyResult.data;

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

  const dto = {
    id: wallet.id,
    label: wallet.label,
    family: wallet.family,
    chainId: wallet.chainId ?? null,
    solanaCluster: wallet.solanaCluster ?? null,
    address: wallet.address,
    isDefault: wallet.isDefault,
    ownerUserId: wallet.ownerUserId ?? null,
    ownerCompanyId: wallet.ownerCompanyId ?? null,
    createdAt: toIsoString(wallet.createdAt),
    updatedAt: toIsoString(wallet.updatedAt),
    verifiedAt: wallet.verifiedAt ? toIsoString(wallet.verifiedAt) : null,
  };

  const parsed = WalletDtoSchema.safeParse(dto);
  if (!parsed.success) {
    console.error('[api/wallets] Invalid POST DTO:', parsed.error);
    return NextResponse.json(
      { error: 'Failed to create wallet', ...(isDev ? { issues: parsed.error.issues } : {}) },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed.data, { status: 201 });
}
