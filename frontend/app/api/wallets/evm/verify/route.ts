import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserById } from "@/data/user";
import { dbPrisma } from "@/lib/db";
import { ChainFamily } from "@prisma/client";
import { type Address, type Hex, getAddress, verifyMessage } from "viem";
import { WalletErrorResponseSchema, WalletVerifyResponseSchema } from "@/lib/types/wallets";

const verifyChallengeSchema = z.object({
	challengeId: z.string().trim().min(1).max(200),
	signature: z.string().trim().min(1).max(512),
	label: z.string().trim().min(1).max(64).optional(),
});

export async function POST(req: NextRequest) {
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

	const bodyResult = await parseJsonOrError(req, verifyChallengeSchema);
	if (!bodyResult.ok) return bodyResult.response;

	const { challengeId, signature, label } = bodyResult.data;

	const challenge = await dbPrisma.walletVerificationChallenge.findUnique({
		where: { id: challengeId },
	});

	if (!challenge || challenge.userId !== dbUser.id) {
		const dto = { error: "Challenge not found" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 404 });
	}

	if (challenge.family !== ChainFamily.EVM) {
		const dto = { error: "Invalid challenge" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
	}

	if (challenge.usedAt) {
		const dto = { error: "Challenge already used" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
	}

	const hasExpired = new Date(challenge.expires) < new Date();
	if (hasExpired) {
		const dto = { error: "Challenge expired" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
	}

	let address: Address;
	try {
		address = getAddress(challenge.address) as Address;
	} catch {
		const dto = { error: "Invalid address" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
	}

	let ok = false;
	try {
		ok = await verifyMessage({
			address,
			message: challenge.message,
			signature: signature as Hex,
		});
	} catch {
		ok = false;
	}

	if (!ok) {
		const dto = { error: "Invalid signature" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
	}

	await dbPrisma.walletVerificationChallenge.update({
		where: { id: challenge.id },
		data: { usedAt: new Date() },
	});

	const walletLabel =
		label ?? `Wallet ${address.slice(0, 6)}…${address.slice(address.length - 4)}`;

	const existingWallet = await dbPrisma.wallet.findFirst({
		where: {
			family: ChainFamily.EVM,
			address,
			chainId: challenge.chainId,
			ownerUserId: dbUser.id,
			ownerCompanyId: null,
		},
	});

	const wallet = existingWallet
		? await dbPrisma.wallet.update({
				where: { id: existingWallet.id },
				data: {
					label: existingWallet.label || walletLabel,
					verifiedAt: new Date(),
				},
			})
		: await dbPrisma.wallet.create({
				data: {
					label: walletLabel,
					family: ChainFamily.EVM,
					address,
					chainId: challenge.chainId,
					solanaCluster: null,
					ownerUserId: dbUser.id,
					ownerCompanyId: null,
					isDefault: false,
					verifiedAt: new Date(),
				},
			});

	const walletDto = {
		id: wallet.id,
		label: wallet.label,
		family: wallet.family,
		chainId: wallet.chainId,
		solanaCluster: wallet.solanaCluster,
		address: wallet.address,
		isDefault: wallet.isDefault,
		ownerUserId: wallet.ownerUserId,
		ownerCompanyId: wallet.ownerCompanyId,
		createdAt: wallet.createdAt.toISOString(),
		updatedAt: wallet.updatedAt.toISOString(),
		verifiedAt: wallet.verifiedAt ? wallet.verifiedAt.toISOString() : null,
	};

	const dto = { ok: true as const, wallet: walletDto };
	const parsed = WalletVerifyResponseSchema.safeParse(dto);
	if (!parsed.success) {
		console.error('[api/wallets/evm/verify] Invalid response DTO:', parsed.error.issues);
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
