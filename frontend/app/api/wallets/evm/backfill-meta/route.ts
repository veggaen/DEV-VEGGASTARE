/**
 * @fileOverview Backfill connector metadata on old wallet records.
 *
 * When the frontend detects a drifted AUTH wallet (address changed across
 * sessions), it merges the display entries and fire-and-forgets this POST
 * to update the DB record with connectorType, authProvider, and socialEmail.
 *
 * This is NOT a security-sensitive mutation — it only writes nullable
 * metadata fields on a wallet the caller already owns.
 *
 * @stability maturing
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from "@/lib/rate-limit";

const bodySchema = z.object({
	walletId: z.string().trim().min(1).max(200),
	connectorType: z.string().trim().max(32).optional(),
	authProvider: z.string().trim().max(32).optional(),
	socialEmail: z.string().trim().email().max(256).optional(),
});

export async function POST(req: NextRequest) {
	const rl = await checkRateLimit(getClientIdentifier(req), "wallet");
	if (!rl.success) return rateLimitedResponse(rl);

	const me = await MyLibUserAuth();
	if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const bodyResult = await parseJsonOrError(req, bodySchema);
	if (!bodyResult.ok) return bodyResult.response;

	const { walletId, connectorType, authProvider, socialEmail } = bodyResult.data;

	// Ownership check — only update your own wallet
	const wallet = await dbPrisma.wallet.findFirst({
		where: { id: walletId, ownerUserId: me.id },
		select: { id: true, connectorType: true, authProvider: true, socialEmail: true },
	});

	if (!wallet) {
		return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
	}

	// Only write fields that are currently null (don't overwrite explicit values)
	const updates: Record<string, string> = {};
	if (connectorType && !wallet.connectorType) updates.connectorType = connectorType;
	if (authProvider && !wallet.authProvider) updates.authProvider = authProvider;
	if (socialEmail && !wallet.socialEmail) updates.socialEmail = socialEmail;

	if (Object.keys(updates).length > 0) {
		await dbPrisma.wallet.update({
			where: { id: wallet.id },
			data: updates,
		});
		console.log(
			"[backfill-meta] Updated wallet %s with %s",
			walletId,
			JSON.stringify(updates),
		);
	}

	return NextResponse.json({ ok: true }, { status: 200 });
}
