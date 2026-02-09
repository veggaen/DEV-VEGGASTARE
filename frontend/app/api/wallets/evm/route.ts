import { NextResponse } from "next/server";

import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserById } from "@/data/user";
import { dbPrisma } from "@/lib/db";
import { ChainFamily } from "@/generated/prisma/browser";
import { EvmWalletListResponseSchema, WalletErrorResponseSchema } from "@/lib/types/wallets";

export async function GET() {
	const me = await MyLibUserAuth();
	if (!me?.id) {
		const dto = { error: "Unauthorized" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 401 });
	}

	const dbUser = await getUserById(me.id);
	if (!dbUser?.id) {
		const dto = { error: "Unauthorized" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 401 });
	}
	if (!dbUser.web3ModeEnabled) {
		const dto = { error: "Enable Web3 mode first." };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 403 });
	}

	const wallets = await dbPrisma.wallet.findMany({
		where: {
			ownerUserId: dbUser.id,
			ownerCompanyId: null,
			family: ChainFamily.EVM,
		},
		orderBy: [{ isDefault: "desc" }, { verifiedAt: "desc" }, { createdAt: "desc" }],
		select: {
			id: true,
			label: true,
			address: true,
			chainId: true,
			isDefault: true,
			verifiedAt: true,
			createdAt: true,
		},
	});

	const dto = {
		wallets: wallets.map((w) => ({
			id: w.id,
			label: w.label || 'Wallet',
			address: w.address,
			chainId: w.chainId,
			isDefault: w.isDefault,
			verifiedAt: w.verifiedAt ? w.verifiedAt.toISOString() : null,
			createdAt: w.createdAt.toISOString(),
		})),
	};

	const parsed = EvmWalletListResponseSchema.safeParse(dto);
	if (!parsed.success) {
		console.error('[api/wallets/evm] Invalid response DTO:', parsed.error.issues);
		return NextResponse.json(
			{
				error: 'Invalid response shape',
				issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
			},
			{ status: 500 }
		);
	}

	return NextResponse.json(parsed.data, { status: 200 });
}
