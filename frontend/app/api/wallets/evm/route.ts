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

	let wallets = await dbPrisma.wallet.findMany({
		where: {
			ownerUserId: dbUser.id,
			ownerCompanyId: null,
			family: ChainFamily.EVM,
		},
		orderBy: [{ isDefault: "desc" }, { verifiedAt: "desc" }, { createdAt: "desc" }],
		select: {
			id: true,
			label: true,
			family: true,
			address: true,
			chainId: true,
			isDefault: true,
			verifiedAt: true,
			donationTotalUsd: true,
			connectorType: true,
			authProvider: true,
			socialEmail: true,
			createdAt: true,
		},
	});

	const hasDefault = wallets.some((wallet) => wallet.isDefault);
	const fallbackDefault = wallets.find((wallet) => !!wallet.verifiedAt);
	if (!hasDefault && fallbackDefault) {
		await dbPrisma.$transaction([
			dbPrisma.wallet.updateMany({
				where: {
					ownerUserId: dbUser.id,
					ownerCompanyId: null,
					family: ChainFamily.EVM,
				},
				data: { isDefault: false },
			}),
			dbPrisma.wallet.update({
				where: { id: fallbackDefault.id },
				data: { isDefault: true },
			}),
			dbPrisma.user.update({
				where: { id: dbUser.id },
				data: { defaultReceivingWalletId: fallbackDefault.id },
			}),
		]);
		wallets = wallets.map((wallet) => ({
			...wallet,
			isDefault: wallet.id === fallbackDefault.id,
		}));
	}

	const dto = {
		wallets: wallets.map((w) => ({
			id: w.id,
			label: w.label || 'Wallet',
			family: w.family,
			address: w.address,
			chainId: w.chainId,
			isDefault: w.isDefault,
			verifiedAt: w.verifiedAt ? w.verifiedAt.toISOString() : null,
			donationTotalUsd: w.donationTotalUsd,
			connectorType: w.connectorType ?? undefined,
			authProvider: w.authProvider ?? undefined,
			socialEmail: w.socialEmail ?? undefined,
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
