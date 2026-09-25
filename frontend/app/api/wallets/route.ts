import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { ChainFamily } from "@/generated/prisma/browser";
import { z } from "zod";
import { WalletDtoSchema } from "@/lib/types/wallets";
import { getAddress } from 'viem';
import { lockedWalletUser, WalletLinkError } from '@/lib/wallet-link';
import { walletLinkRequest, walletLinkResponse, walletLinkFailure } from '@/lib/wallet-link-request';

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
  isDefault: z.literal(false).optional().default(false),
}).strict();

export async function GET() {
  const me = await MyLibUserAuth();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallets = await dbPrisma.wallet.findMany({
    where: {
      ownerUserId: me.id,
      ownerCompanyId: null,
    },
    orderBy: [{ family: "asc" }, { isDefault: "desc" }, { verifiedAt: "desc" }, { createdAt: "desc" }],
  });

  const dto = {
    wallets: wallets.map((wallet) => ({
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
    })),
  };

  const parsed = z.object({ wallets: z.array(WalletDtoSchema) }).safeParse(dto);
  if (!parsed.success) {
    console.error('[api/wallets] Invalid GET DTO:', parsed.error.issues);
    return NextResponse.json(
      { error: 'Failed to load wallets', ...(isDev ? { issues: parsed.error.issues } : {}) },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await walletLinkRequest(req);
    if (auth instanceof Response) return auth;
    const parsedBody = createWalletSchema.safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) return walletLinkResponse({ error: 'Check the wallet details. Verify ownership before choosing a receiving wallet.' }, 400);
    const { label, family, address, chainId, solanaCluster, ownerCompanyId } = parsedBody.data;
    let normalizedAddress = address;
    if (family === 'EVM') {
      try { normalizedAddress = getAddress(address); }
      catch { return walletLinkResponse({ error: 'Enter a valid EVM wallet address.' }, 400); }
    }
    const wallet = await dbPrisma.$transaction(async tx => {
      await lockedWalletUser(tx, auth.userId);
      if (ownerCompanyId) {
        await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${ownerCompanyId} FOR UPDATE`;
        const company = await tx.company.findUnique({ where: { id: ownerCompanyId }, select: { ownerId: true } });
        if (!company || company.ownerId !== auth.userId) throw new WalletLinkError('Only the current company owner can add its wallets.', 403);
      }
      // An entered address is not ownership proof. Creation never chooses a
      // receiving address or changes any other user's/company's wallet flags.
      return tx.wallet.create({ data: {
      label,
      family,
      address: normalizedAddress,
      chainId: chainId ?? null,
      solanaCluster: solanaCluster ?? null,
      isDefault: false,
      verifiedAt: null,
      ownerCompanyId: ownerCompanyId ?? null,
      ownerUserId: ownerCompanyId ? null : auth.userId,
      } });
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
    return walletLinkResponse(
      { error: 'Failed to create wallet', ...(isDev ? { issues: parsed.error.issues } : {}) },
      500
    );
  }

  return walletLinkResponse(parsed.data, 201);
  } catch (error) { return walletLinkFailure(error, 'Unable to add this wallet. Refresh your wallets before trying again.'); }
}
