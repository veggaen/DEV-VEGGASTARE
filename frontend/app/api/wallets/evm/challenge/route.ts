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
import { ChainFamily } from "@/generated/prisma/browser";
import { getAddress } from "viem";
import {
	WalletChallengeCreatedResponseSchema,
	WalletErrorResponseSchema,
	WalletTwoFactorResponseSchema,
} from "@/lib/types/wallets";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from "@/lib/rate-limit";

const createChallengeSchema = z.object({
	address: z.string().trim().min(1).max(256),
	chainId: z.coerce.number().int().positive().optional().nullable(),
	code: z.string().trim().min(1).max(10).optional().nullable(),
});

export async function POST(req: NextRequest) {
	// Rate-limit wallet challenge creation (prevents spam & email bombing)
	const rl = await checkRateLimit(getClientIdentifier(req), "wallet");
	if (!rl.success) return rateLimitedResponse(rl);

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

	const bodyResult = await parseJsonOrError(req, createChallengeSchema);
	if (!bodyResult.ok) return bodyResult.response;

	// 2FA-gate wallet linking when enabled. We keep this lightweight: a short-lived email code.
	if (dbUser.isTwoFactorEnabled) {
		const code = bodyResult.data.code;
		if (!code) {
			const twoFactorToken = await generateTwoFactorToken(dbUser.email ?? "");
			await sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token);
			const dto = { twoFactor: true };
			const parsed = WalletTwoFactorResponseSchema.safeParse(dto);
			return NextResponse.json(parsed.success ? parsed.data : dto, { status: 200 });
		}

		const twoFactorToken = await getTwoFactortokenByEmail(dbUser.email ?? "");
		if (!twoFactorToken) {
			const dto = { error: "Invalid code" };
			const parsed = WalletErrorResponseSchema.safeParse(dto);
			return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
		}
		// SECURITY: constant-time comparison to prevent timing side-channel attacks
		const codeBuffer = Buffer.from(code.padEnd(10, '0'));
		const tokenBuffer = Buffer.from(twoFactorToken.token.padEnd(10, '0'));
		if (!crypto.timingSafeEqual(codeBuffer, tokenBuffer)) {
			const dto = { error: "Invalid code" };
			const parsed = WalletErrorResponseSchema.safeParse(dto);
			return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
		}
		const expired = new Date(twoFactorToken.expires) < new Date();
		if (expired) {
			const dto = { error: "Code expired" };
			const parsed = WalletErrorResponseSchema.safeParse(dto);
			return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
		}
		await dbPrisma.twoFactorToken.delete({ where: { id: twoFactorToken.id } });
	}

	let address: string;
	try {
		address = getAddress(bodyResult.data.address);
	} catch {
		const dto = { error: "Invalid address" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
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

	const dto = {
		challengeId: challenge.id,
		message: challenge.message,
		expires: challenge.expires.toISOString(),
	};

	const parsed = WalletChallengeCreatedResponseSchema.safeParse(dto);
	if (!parsed.success) {
		console.error('[api/wallets/evm/challenge] Invalid response DTO:', parsed.error.issues);
		return NextResponse.json(
			{
				error: 'Invalid response shape',
				issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
			},
			{ status: 500 }
		);
	}

	return NextResponse.json(parsed.data, { status: 201 });
}
