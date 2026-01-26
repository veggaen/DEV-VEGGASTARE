import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserById } from "@/data/user";
import { getTwoFactortokenByEmail } from "@/data/two-factor-token";
import { dbPrisma } from "@/lib/db";
import { sendTwoFactorTokenEmail } from "@/lib/mail";
import { generateTwoFactorToken } from "@/lib/tokens";
import { ChainFamily } from "@prisma/client";
import { getAddress } from "viem";

const createChallengeSchema = z.object({
	address: z.string().trim().min(1).max(256),
	chainId: z.coerce.number().int().positive().optional().nullable(),
	code: z.string().trim().min(1).max(10).optional().nullable(),
});

export async function POST(req: NextRequest) {
	const me = await MyLibUserAuth();
	if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const dbUser = await getUserById(me.id);
	if (!dbUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!dbUser.web3ModeEnabled) {
		return NextResponse.json({ error: "Enable Web3 mode first." }, { status: 403 });
	}

	const bodyResult = await parseJsonOrError(req, createChallengeSchema);
	if (!bodyResult.ok) return bodyResult.response;

	// 2FA-gate wallet linking when enabled. We keep this lightweight: a short-lived email code.
	if (dbUser.isTwoFactorEnabled) {
		const code = bodyResult.data.code;
		if (!code) {
			const twoFactorToken = await generateTwoFactorToken(dbUser.email ?? "");
			await sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token);
			return NextResponse.json({ twoFactor: true }, { status: 200 });
		}

		const twoFactorToken = await getTwoFactortokenByEmail(dbUser.email ?? "");
		if (!twoFactorToken) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
		if (twoFactorToken.token !== code) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
		const expired = new Date(twoFactorToken.expires) < new Date();
		if (expired) return NextResponse.json({ error: "Code expired" }, { status: 400 });
		await dbPrisma.twoFactorToken.delete({ where: { id: twoFactorToken.id } });
	}

	let address: string;
	try {
		address = getAddress(bodyResult.data.address);
	} catch {
		return NextResponse.json({ error: "Invalid address" }, { status: 400 });
	}

	const chainId = bodyResult.data.chainId ?? null;
	const nonce = crypto.randomBytes(16).toString("hex");
	const issuedAt = new Date();
	const expires = new Date(Date.now() + 10 * 60 * 1000);

	const origin =
		process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://www.veggat.com";

	const message = [
		"VeggaStare wants you to sign in with your Ethereum account:",
		address,
		"",
		"Link this wallet to your VeggaStare account.",
		"This is a gasless signature request.",
		"",
		`URI: ${origin}`,
		`Nonce: ${nonce}`,
		`Issued At: ${issuedAt.toISOString()}`,
		`Expiration Time: ${expires.toISOString()}`,
		chainId ? `Chain ID: ${chainId}` : undefined,
		"",
	].filter(Boolean).join("\n");

	// Keep at most one active challenge per user/address/family.
	await dbPrisma.walletVerificationChallenge.deleteMany({
		where: {
			userId: dbUser.id,
			family: ChainFamily.EVM,
			address,
			usedAt: null,
		},
	});

	const challenge = await dbPrisma.walletVerificationChallenge.create({
		data: {
			userId: dbUser.id,
			family: ChainFamily.EVM,
			address,
			chainId,
			solanaCluster: null,
			nonce,
			message,
			expires,
		},
	});

	return NextResponse.json(
		{
			challengeId: challenge.id,
			message: challenge.message,
			expires: challenge.expires,
		},
		{ status: 201 }
	);
}
