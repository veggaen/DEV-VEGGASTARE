import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserById } from "@/data/user";
import { getTwoFactortokenByEmail } from "@/data/two-factor-token";
import { dbPrisma } from "@/lib/db";
import { sendTwoFactorTokenEmail } from "@/lib/mail";
import { generateTwoFactorToken } from "@/lib/tokens";
import { ChainFamily } from "@prisma/client";

const codeSchema = z.object({
	code: z.string().trim().min(1).max(10).optional().nullable(),
});

async function requireTwoFactorIfEnabled(user: { isTwoFactorEnabled: boolean; email: string | null }, code: string | null | undefined) {
	if (!user.isTwoFactorEnabled) return { ok: true as const };

	if (!code) {
		const twoFactorToken = await generateTwoFactorToken(user.email ?? "");
		await sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token);
		return { ok: false as const, response: NextResponse.json({ twoFactor: true }, { status: 200 }) };
	}

	const twoFactorToken = await getTwoFactortokenByEmail(user.email ?? "");
	if (!twoFactorToken) {
		return { ok: false as const, response: NextResponse.json({ error: "Invalid code" }, { status: 400 }) };
	}
	if (twoFactorToken.token !== code) {
		return { ok: false as const, response: NextResponse.json({ error: "Invalid code" }, { status: 400 }) };
	}
	const expired = new Date(twoFactorToken.expires) < new Date();
	if (expired) {
		return { ok: false as const, response: NextResponse.json({ error: "Code expired" }, { status: 400 }) };
	}
	await dbPrisma.twoFactorToken.delete({ where: { id: twoFactorToken.id } });

	return { ok: true as const };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ walletId: string }> }) {
	const me = await MyLibUserAuth();
	if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const dbUser = await getUserById(me.id);
	if (!dbUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!dbUser.web3ModeEnabled) {
		return NextResponse.json({ error: "Enable Web3 mode first." }, { status: 403 });
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

	if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

	await dbPrisma.$transaction([
		dbPrisma.wallet.updateMany({
			where: { ownerUserId: dbUser.id, ownerCompanyId: null, family: ChainFamily.EVM },
			data: { isDefault: false },
		}),
		dbPrisma.wallet.update({ where: { id: wallet.id }, data: { isDefault: true } }),
	]);

	return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ walletId: string }> }) {
	const me = await MyLibUserAuth();
	if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const dbUser = await getUserById(me.id);
	if (!dbUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!dbUser.web3ModeEnabled) {
		return NextResponse.json({ error: "Enable Web3 mode first." }, { status: 403 });
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

	if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

	const assignedCount = await dbPrisma.product.count({ where: { receiverWalletId: wallet.id } });
	if (assignedCount > 0) {
		return NextResponse.json(
			{ error: "Wallet is assigned to one or more products. Remove it from products first." },
			{ status: 409 }
		);
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

	return NextResponse.json({ ok: true }, { status: 200 });
}
