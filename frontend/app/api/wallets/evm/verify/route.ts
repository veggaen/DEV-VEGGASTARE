import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserById } from "@/data/user";
import { dbPrisma } from "@/lib/db";
import { ChainFamily } from "@prisma/client";
import { type Address, type Hex, getAddress, verifyMessage } from "viem";

const verifyChallengeSchema = z.object({
	challengeId: z.string().trim().min(1).max(200),
	signature: z.string().trim().min(1).max(512),
	label: z.string().trim().min(1).max(64).optional(),
});

export async function POST(req: NextRequest) {
	const me = await MyLibUserAuth();
	if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const dbUser = await getUserById(me.id);
	if (!dbUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!dbUser.web3ModeEnabled) {
		return NextResponse.json({ error: "Enable Web3 mode first." }, { status: 403 });
	}

	const bodyResult = await parseJsonOrError(req, verifyChallengeSchema);
	if (!bodyResult.ok) return bodyResult.response;

	const { challengeId, signature, label } = bodyResult.data;

	const challenge = await dbPrisma.walletVerificationChallenge.findUnique({
		where: { id: challengeId },
	});

	if (!challenge || challenge.userId !== dbUser.id) {
		return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
	}

	if (challenge.family !== ChainFamily.EVM) {
		return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
	}

	if (challenge.usedAt) {
		return NextResponse.json({ error: "Challenge already used" }, { status: 400 });
	}

	const hasExpired = new Date(challenge.expires) < new Date();
	if (hasExpired) {
		return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
	}

	let address: Address;
	try {
		address = getAddress(challenge.address) as Address;
	} catch {
		return NextResponse.json({ error: "Invalid address" }, { status: 400 });
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
		return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
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

	return NextResponse.json({ ok: true, wallet }, { status: 200 });
}
