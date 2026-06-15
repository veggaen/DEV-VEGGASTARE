/**
 * @fileOverview POST /api/wallets/donate — Record an on-chain donation.
 *
 * After the client sends crypto to the system wallet and receives
 * a transaction hash, this route:
 *   1. Validates the wallet is verified + belongs to the session user
 *   2. Records the donation amount (increments donationTotalUsd)
 *   3. Recalculates the user's verification tier
 *
 * On-chain verification (checking the tx receipt for actual value) is
 * done asynchronously to avoid blocking the UX. The donation is
 * optimistically recorded, and a background job can reconcile later.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonOrError } from "@/lib/api-validate";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { recalculateVerificationTier } from "@/lib/verification-recalc";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from "@/lib/rate-limit";

const donateSchema = z.object({
  /** The DB wallet ID (cuid) */
  walletId: z.string().trim().min(1).max(100),
  /** Transaction hash from the on-chain send */
  txHash: z.string().trim().min(1).max(256),
  /** Amount in native token (e.g. "0.003" ETH) */
  nativeAmount: z.string().trim().min(1).max(100),
  /** Amount converted to USD at the time of donation */
  amountUsd: z.number().positive().max(10_000_000),
  /** Chain family ("EVM" | "SOLANA") */
  chainFamily: z.enum(["EVM", "SOLANA"]),
  /** Chain ID (for EVM) */
  chainId: z.number().int().positive().optional().nullable(),
  /** Token symbol (ETH, SOL, PLS, etc.) */
  tokenSymbol: z.string().trim().min(1).max(20),
});

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIdentifier(req), "wallet");
  if (!rl.success) return rateLimitedResponse(rl);

  const me = await MyLibUserAuth();
  if (!me?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!me.web3ModeEnabled) {
    return NextResponse.json({ error: "Enable Web3 mode first." }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, donateSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { walletId, txHash, nativeAmount, amountUsd, chainFamily, chainId, tokenSymbol } =
    bodyResult.data;

  // Verify the wallet belongs to the current user and is verified
  const wallet = await dbPrisma.wallet.findFirst({
    where: {
      id: walletId,
      ownerUserId: me.id,
      ownerCompanyId: null,
    },
    select: {
      id: true,
      address: true,
      verifiedAt: true,
      donationTotalUsd: true,
    },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  if (!wallet.verifiedAt) {
    return NextResponse.json(
      { error: "Wallet must be verified before donating" },
      { status: 400 },
    );
  }

  // Check for duplicate tx hash (prevent replay)
  const existingDonation = await dbPrisma.donation.findFirst({
    where: { txHash },
  });
  if (existingDonation) {
    return NextResponse.json(
      { error: "Donation with this transaction already recorded" },
      { status: 409 },
    );
  }

  // Record donation + increment wallet total atomically
  const [donation] = await dbPrisma.$transaction([
    dbPrisma.donation.create({
      data: {
        userId: me.id,
        walletId: wallet.id,
        walletAddress: wallet.address,
        txHash,
        nativeAmount,
        amountUsd,
        chainFamily,
        chainId: chainId ?? null,
        tokenSymbol,
        status: "PENDING_CONFIRMATION",
      },
    }),
    dbPrisma.wallet.update({
      where: { id: wallet.id },
      data: {
        donationTotalUsd: { increment: amountUsd },
      },
    }),
  ]);

  // Recalculate verification tier with updated donation total (fire-and-forget)
  recalculateVerificationTier(
    me.id,
    { hasWeb3Payment: true },
    `Donation $${amountUsd.toFixed(2)} via ${tokenSymbol}`,
  ).catch((err) => console.error("[donate] Tier recalc failed:", err));

  return NextResponse.json(
    {
      ok: true,
      donationId: donation.id,
      newTotalUsd: (wallet.donationTotalUsd ?? 0) + amountUsd,
    },
    { status: 201 },
  );
}
