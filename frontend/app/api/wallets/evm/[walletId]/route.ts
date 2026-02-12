import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserById } from "@/data/user";
import { getTwoFactortokenByEmail } from "@/data/two-factor-token";
import { dbPrisma } from "@/lib/db";
import { sendTwoFactorTokenEmail, sendWalletLinkedEmail } from "@/lib/mail";
import { generateTwoFactorToken } from "@/lib/tokens";
import { ChainFamily } from "@/generated/prisma/browser";
import { WalletErrorResponseSchema, WalletOkResponseSchema, WalletTwoFactorResponseSchema } from "@/lib/types/wallets";
import { recalculateVerificationTier } from "@/lib/verification-recalc";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from "@/lib/rate-limit";

const codeSchema = z.object({
	code: z.string().trim().min(1).max(10).optional().nullable(),
});

async function requireTwoFactorIfEnabled(user: { isTwoFactorEnabled: boolean; email: string | null }, code: string | null | undefined) {
	if (!user.isTwoFactorEnabled) return { ok: true as const };

	if (!code) {
		const twoFactorToken = await generateTwoFactorToken(user.email ?? "");
		await sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token);
		const dto = { twoFactor: true };
		const parsed = WalletTwoFactorResponseSchema.safeParse(dto);
		return {
			ok: false as const,
			response: NextResponse.json(parsed.success ? parsed.data : dto, { status: 200 }),
		};
	}

	const twoFactorToken = await getTwoFactortokenByEmail(user.email ?? "");
	if (!twoFactorToken) {
		const dto = { error: "Invalid code" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return { ok: false as const, response: NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 }) };
	}
	// SECURITY: constant-time comparison to prevent timing side-channel attacks
	const codeBuffer = Buffer.from(code.padEnd(10, '0'));
	const tokenBuffer = Buffer.from(twoFactorToken.token.padEnd(10, '0'));
	if (!crypto.timingSafeEqual(codeBuffer, tokenBuffer)) {
		const dto = { error: "Invalid code" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return { ok: false as const, response: NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 }) };
	}
	const expired = new Date(twoFactorToken.expires) < new Date();
	if (expired) {
		const dto = { error: "Code expired" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return { ok: false as const, response: NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 }) };
	}
	await dbPrisma.twoFactorToken.delete({ where: { id: twoFactorToken.id } });

	return { ok: true as const };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ walletId: string }> }) {
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

	const bodyResult = await parseJsonOrError(req, codeSchema);
	if (!bodyResult.ok) return bodyResult.response;

	const twoFactor = await requireTwoFactorIfEnabled(dbUser, bodyResult.data.code);
	if (!twoFactor.ok) return twoFactor.response;

	const { walletId } = await ctx.params;

	const wallet = await dbPrisma.wallet.findFirst({
		where: {
			id: walletId,
			ownerUserId: dbUser.id,
			ownerCompanyId: null,
			family: ChainFamily.EVM,
		},
	});

	if (!wallet) {
		const dto = { error: "Wallet not found" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 404 });
	}

	await dbPrisma.$transaction([
		dbPrisma.wallet.updateMany({
			where: { ownerUserId: dbUser.id, ownerCompanyId: null, family: ChainFamily.EVM },
			data: { isDefault: false },
		}),
		dbPrisma.wallet.update({ where: { id: wallet.id }, data: { isDefault: true } }),
	]);

	const dto = { ok: true as const };
	const parsed = WalletOkResponseSchema.safeParse(dto);
	return NextResponse.json(parsed.success ? parsed.data : dto, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ walletId: string }> }) {
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

	const bodyResult = await parseJsonOrError(req, codeSchema);
	if (!bodyResult.ok) return bodyResult.response;

	const twoFactor = await requireTwoFactorIfEnabled(dbUser, bodyResult.data.code);
	if (!twoFactor.ok) return twoFactor.response;

	const { walletId } = await ctx.params;

	const wallet = await dbPrisma.wallet.findFirst({
		where: {
			id: walletId,
			ownerUserId: dbUser.id,
			ownerCompanyId: null,
			family: ChainFamily.EVM,
		},
	});

	if (!wallet) {
		const dto = { error: "Wallet not found" };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 404 });
	}

	const assignedCount = await dbPrisma.product.count({ where: { receiverWalletId: wallet.id } });
	if (assignedCount > 0) {
		const dto = { error: "Wallet is assigned to one or more products. Remove it from products first." };
		const parsed = WalletErrorResponseSchema.safeParse(dto);
		return NextResponse.json(parsed.success ? parsed.data : dto, { status: 409 });
	}

	await dbPrisma.$transaction(async (tx) => {
		const wasDefault = wallet.isDefault;
		await tx.wallet.delete({ where: { id: wallet.id } });

		if (wasDefault) {
			const next = await tx.wallet.findFirst({
				where: { ownerUserId: dbUser.id, ownerCompanyId: null, family: ChainFamily.EVM },
				orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
			});
			if (next) {
				await tx.wallet.update({ where: { id: next.id }, data: { isDefault: true } });
			}
		}
	});

	// Recalculate hasVerifiedWallet: check if user still has any verified wallets
	const remainingVerified = await dbPrisma.wallet.count({
		where: { ownerUserId: dbUser.id, verifiedAt: { not: null } },
	});
	recalculateVerificationTier(
		dbUser.id,
		{ hasVerifiedWallet: remainingVerified > 0 },
		'Wallet unlinked'
	).catch((err) => console.error('[wallet-delete] recalc failed:', err));

	// Send wallet unlinked confirmation email (fire-and-forget)
	if (dbUser.email) {
		sendWalletLinkedEmail(dbUser.email, {
			walletAddress: wallet.address,
			chainFamily: 'EVM',
			chainId: wallet.chainId,
			action: 'unlinked',
			userName: dbUser.name,
		}).catch((err) => console.error('[wallet-delete] Failed to send unlinked email:', err));
	}

	const dto = { ok: true as const };
	const parsed = WalletOkResponseSchema.safeParse(dto);
	return NextResponse.json(parsed.success ? parsed.data : dto, { status: 200 });
}
