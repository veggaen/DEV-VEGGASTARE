import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAddress } from "viem";
import { z } from "zod";
import { dbPrisma } from "@/lib/db";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * POST /api/auth/wallet/nonce
 *
 * PUBLIC (logged-out) — issues a one-time SIWE-style message for an EVM address
 * so a visitor can sign in / create an account with just their wallet. The
 * signature is later verified by the "wallet" Credentials provider in
 * auth.config.ts. (Linking a wallet to an existing account uses the separate,
 * authenticated /api/wallets/evm/challenge flow.)
 */

const BodySchema = z.object({
  address: z.string().trim().min(1).max(128),
});

export async function POST(req: NextRequest) {
  // Tight rate limit — this is an unauthenticated, abuse-prone endpoint.
  const rl = await checkRateLimit(getClientIdentifier(req), "gate");
  if (!rl.success) return rateLimitedResponse(rl);

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  let address: string;
  try {
    address = getAddress(parsed.data.address); // checksum + validate
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const addressKey = address.toLowerCase();

  const nonce = crypto.randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  const issuedAt = new Date();

  const message = [
    "VeggaStare wants you to sign in with your Ethereum account:",
    address,
    "",
    "Sign in to VeggaStare. This is a free, gasless signature — no transaction, no fees.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
  ].join("\n");

  // One active nonce per address.
  await dbPrisma.walletLoginNonce.deleteMany({ where: { address: addressKey } });
  await dbPrisma.walletLoginNonce.create({
    data: { address: addressKey, nonce, message, expires },
  });

  return NextResponse.json({ message, expires: expires.toISOString() });
}
