/** @fileOverview Bounded demo-account provisioning through normal Auth.js sessions. @stability experimental */
import { randomUUID, createHmac } from "node:crypto";
import { dbPrisma } from "@/lib/db";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { DEMO_ID_PREFIX } from "@/lib/demo-policy";

export async function createDemoUser(request: Request) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const identifier = getClientIdentifier(request);
  if (!(await checkRateLimit(`demo:${identifier}`, "auth")).success) return null;
  // Durable bounds across serverless replicas; no raw IP is stored.
  const day = new Date().toISOString().slice(0, 10);
  const fingerprint = createHmac("sha256", secret).update(`${day}:${identifier}`).digest("hex").slice(0, 24);
  const prefix = `${DEMO_ID_PREFIX}${day}_${fingerprint}_`;
  return dbPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73421901)`;
    const [perVisitor, global] = await Promise.all([
      tx.user.count({ where: { id: { startsWith: prefix } } }),
      tx.user.count({ where: { id: { startsWith: `${DEMO_ID_PREFIX}${day}_` } } }),
    ]);
    if (perVisitor >= 5 || global >= 200) return null;
    return tx.user.create({ data: {
      id: `${prefix}${randomUUID()}`, name: "Demo visitor", role: "USER",
      web3ModeEnabled: false, emailDisplayMode: "HIDE",
      bio: "Isolated interview demo. No real purchases or public posting.",
    } });
  }, { timeout: 10_000 });
}
