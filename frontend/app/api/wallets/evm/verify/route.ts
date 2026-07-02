import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { ChainFamily } from "@/generated/prisma/browser";
import { type Address, type Hex, getAddress, verifyMessage } from "viem";
import { WalletErrorResponseSchema, WalletVerifyResponseSchema } from "@/lib/types/wallets";
import { sendWalletLinkedEmail } from "@/lib/mail";
import { recalculateVerificationTier } from "@/lib/verification-recalc";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from "@/lib/rate-limit";

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

/** Accepts EITHER a legacy challengeId OR a direct address+message payload. */
const verifyBodySchema = z.object({
	// Legacy challenge-ID mode
	challengeId: z.string().trim().min(1).max(200).optional(),
	// Direct-sign mode (client-generated SIWE message)
	address: z.string().trim().min(1).max(256).optional(),
	chainId: z.coerce.number().int().positive().optional().nullable(),
	message: z.string().trim().min(10).max(2000).optional(),
	// Common
	signature: z.string().trim().min(1).max(512),
	label: z.string().trim().min(1).max(64).optional(),
	// Connector metadata — saved so "Reown via Google" persists across sessions
	connectorType: z.string().trim().max(32).optional(),
	authProvider: z.string().trim().max(32).optional(),
	socialEmail: z.string().trim().email().max(256).optional(),
});

/* ------------------------------------------------------------------ */
/*  SIWE-like message parser                                           */
/* ------------------------------------------------------------------ */

function parseSiweMessage(raw: string) {
	const lines = raw.split("\n");
	if (!lines[0]?.startsWith("VeggaStare wants you to sign in")) return null;

	const messageAddress = lines[1]?.trim();
	if (!messageAddress) return null;

	const kv: Record<string, string> = {};
	for (const line of lines) {
		const m = line.match(/^(URI|Nonce|Issued At|Expiration Time|Chain ID):\s*(.+)$/);
		if (m) kv[m[1]] = m[2].trim();
	}

	if (!kv["URI"] || !kv["Nonce"] || !kv["Issued At"] || !kv["Expiration Time"]) return null;

	return {
		address: messageAddress,
		uri: kv["URI"],
		nonce: kv["Nonce"],
		issuedAt: new Date(kv["Issued At"]),
		expirationTime: new Date(kv["Expiration Time"]),
		chainId: kv["Chain ID"] ? parseInt(kv["Chain ID"], 10) : null,
	};
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function errorResponse(msg: string, status: number) {
	const dto = { error: msg };
	const parsed = WalletErrorResponseSchema.safeParse(dto);
	return NextResponse.json(parsed.success ? parsed.data : dto, { status });
}

export async function POST(req: NextRequest) {
	console.log("[api/wallets/evm/verify] POST received");
	// Rate-limit wallet verification attempts
	const rl = await checkRateLimit(getClientIdentifier(req), "wallet");
	if (!rl.success) return rateLimitedResponse(rl);

	const me = await MyLibUserAuth();
	if (!me?.id) return errorResponse("Unauthorized", 401);
	const meWithId = me as typeof me & { id: string };
	if (!me.web3ModeEnabled) return errorResponse("Enable Web3 mode first.", 403);

	const bodyResult = await parseJsonOrError(req, verifyBodySchema);
	if (!bodyResult.ok) return bodyResult.response;

	const {
		challengeId,
		address: rawAddress,
		chainId: rawChainId,
		message: rawMessage,
		signature,
		label,
		connectorType,
		authProvider,
		socialEmail,
	} = bodyResult.data;

	// Build connector metadata object (only non-empty values)
	const connMeta = {
		...(connectorType ? { connectorType } : {}),
		...(authProvider ? { authProvider } : {}),
		...(socialEmail ? { socialEmail } : {}),
	};

	/* ================================================================ */
	/*  Mode A: Legacy challenge-ID flow                                 */
	/* ================================================================ */
	if (challengeId) {
		const challenge = await dbPrisma.walletVerificationChallenge.findUnique({
			where: { id: challengeId },
		});

		if (!challenge || challenge.userId !== me.id) return errorResponse("Challenge not found", 404);
		if (challenge.family !== ChainFamily.EVM) return errorResponse("Invalid challenge", 400);
		if (challenge.usedAt) return errorResponse("Challenge already used", 400);
		if (new Date(challenge.expires) < new Date()) return errorResponse("Challenge expired", 400);

		let address: Address;
		try { address = getAddress(challenge.address) as Address; }
		catch { return errorResponse("Invalid address", 400); }

		let ok = false;
		try { ok = await verifyMessage({ address, message: challenge.message, signature: signature as Hex }); }
		catch { ok = false; }
		if (!ok) return errorResponse("Invalid signature", 400);

		await dbPrisma.walletVerificationChallenge.update({
			where: { id: challenge.id },
			data: { usedAt: new Date() },
		});

		return createOrUpdateWallet(address, challenge.chainId, label, meWithId, signature, connMeta);
	}

	/* ================================================================ */
	/*  Mode B: Direct-sign flow (client-generated SIWE message)         */
	/* ================================================================ */
	if (rawAddress && rawMessage) {
		// Parse the SIWE-like message
		const parsed = parseSiweMessage(rawMessage);
		if (!parsed) return errorResponse("Invalid message format", 400);

		// Validate address consistency
		let address: Address;
		try { address = getAddress(rawAddress) as Address; }
		catch { return errorResponse("Invalid address", 400); }

		let msgAddress: Address;
		try { msgAddress = getAddress(parsed.address) as Address; }
		catch { return errorResponse("Invalid address in message", 400); }

		if (address !== msgAddress) return errorResponse("Address mismatch", 400);

		// Validate URI matches expected origin
		const expectedOrigin =
			process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://www.veggat.com";
		if (parsed.uri !== expectedOrigin) {
			console.warn("[api/wallets/evm/verify] URI mismatch: expected %s, got %s", expectedOrigin, parsed.uri);
			return errorResponse("Invalid message origin", 400);
		}

		// Validate timestamps: issuedAt within last 10 min, not expired
		const now = new Date();
		const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
		if (parsed.issuedAt < tenMinAgo) return errorResponse("Message too old", 400);
		if (parsed.issuedAt > new Date(now.getTime() + 60 * 1000)) return errorResponse("Message from future", 400);
		if (parsed.expirationTime < now) return errorResponse("Message expired", 400);

		// Verify signature using viem (personal_sign via wagmi)
		let ok = false;
		try { ok = await verifyMessage({ address, message: rawMessage, signature: signature as Hex }); }
		catch { ok = false; }
		if (!ok) return errorResponse("Invalid signature", 400);

		console.log("[api/wallets/evm/verify] ✓ Direct-sign verified for %s", address);

		const chainId = rawChainId ?? parsed.chainId ?? null;
		return createOrUpdateWallet(address, chainId, label, meWithId, signature, connMeta);
	}

	return errorResponse("Provide either challengeId or address + message", 400);
}

/* ------------------------------------------------------------------ */
/*  Shared: create or update wallet record + send email                */
/* ------------------------------------------------------------------ */

async function createOrUpdateWallet(
	address: Address,
	chainId: number | null,
	label: string | undefined,
	me: { id: string; email?: string | null; name?: string | null },
	_signature: string,
	connMeta: { connectorType?: string; authProvider?: string; socialEmail?: string } = {},
) {
	const walletLabel =
		label ?? `Wallet ${address.slice(0, 6)}…${address.slice(address.length - 4)}`;

	const existingWallet = await dbPrisma.wallet.findFirst({
		where: {
			family: ChainFamily.EVM,
			address,
<<<<<<< HEAD
=======
			chainId,
>>>>>>> dev
			ownerUserId: me.id,
			ownerCompanyId: null,
		},
		orderBy: [{ isDefault: "desc" }, { verifiedAt: "desc" }, { createdAt: "desc" }],
	});

	const userPaymentState = await dbPrisma.user.findUnique({
		where: { id: me.id },
		select: { defaultReceivingWalletId: true },
	});
	const existingDefaultWallet = await dbPrisma.wallet.findFirst({
		where: {
			family: ChainFamily.EVM,
			ownerUserId: me.id,
			ownerCompanyId: null,
			isDefault: true,
			verifiedAt: { not: null },
		},
		select: { id: true },
	});
	const shouldBecomeDefault =
		!userPaymentState?.defaultReceivingWalletId && !existingDefaultWallet;

	const wallet = await dbPrisma.$transaction(async (tx) => {
		if (shouldBecomeDefault) {
			await tx.wallet.updateMany({
				where: {
					family: ChainFamily.EVM,
					ownerUserId: me.id,
					ownerCompanyId: null,
				},
				data: { isDefault: false },
			});
		}

		const savedWallet = existingWallet
			? await tx.wallet.update({
				where: { id: existingWallet.id },
				data: {
					label: existingWallet.label || walletLabel,
					chainId: chainId ?? existingWallet.chainId,
					verifiedAt: new Date(),
<<<<<<< HEAD
					...(shouldBecomeDefault ? { isDefault: true } : {}),
=======
>>>>>>> dev
					// Update connector metadata if provided (may have changed across sessions)
					...(connMeta.connectorType ? { connectorType: connMeta.connectorType } : {}),
					...(connMeta.authProvider ? { authProvider: connMeta.authProvider } : {}),
					...(connMeta.socialEmail ? { socialEmail: connMeta.socialEmail } : {}),
				},
			})
			: await tx.wallet.create({
				data: {
					label: walletLabel,
					family: ChainFamily.EVM,
					address,
					chainId,
					solanaCluster: null,
					ownerUserId: me.id,
					ownerCompanyId: null,
					isDefault: shouldBecomeDefault,
					verifiedAt: new Date(),
					// Persist connector metadata for cross-session display
					connectorType: connMeta.connectorType ?? null,
					authProvider: connMeta.authProvider ?? null,
					socialEmail: connMeta.socialEmail ?? null,
				},
			});

		if (shouldBecomeDefault) {
			await tx.user.update({
				where: { id: me.id },
				data: { defaultReceivingWalletId: savedWallet.id },
			});
		}

		return savedWallet;
	});

	// Send wallet linked confirmation email (fire-and-forget)
	if (me.email) {
		sendWalletLinkedEmail(me.email, {
			walletAddress: address,
			chainFamily: 'EVM',
			chainId,
			action: 'linked',
			userName: me.name,
		}).catch((err) => console.error('[wallet-verify] Failed to send linked email:', err));
	}

	// Recalculate verification tier (wallet linked = hasVerifiedWallet: true)
	recalculateVerificationTier(
		me.id,
		{ hasVerifiedWallet: true },
		'Wallet linked'
	).catch((err) => console.error('[wallet-verify] Failed to recalculate tier:', err));

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
