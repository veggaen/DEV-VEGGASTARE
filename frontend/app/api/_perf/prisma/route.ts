import { auth } from "@/auth";
import { dbPrisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

function getPoolParams(urlString: string | undefined) {
	if (!urlString) return null;
	try {
		const url = new URL(urlString);
		const usesPgBouncer = url.searchParams.get("pgbouncer") === "true";
		const connectionLimitRaw = url.searchParams.get("connection_limit");
		const connectionLimitEffective =
			connectionLimitRaw ?? (usesPgBouncer ? "1" : null);

		return {
			usesPgBouncer,
			connectionLimit: connectionLimitEffective,
			poolTimeout: url.searchParams.get("pool_timeout"),
			connectTimeout: url.searchParams.get("connect_timeout"),
		};
	} catch {
		return null;
	}
}

async function time<T>(fn: () => Promise<T>) {
	const start = performance.now();
	await fn();
	return Math.round(performance.now() - start);
}

export async function GET() {
	const session = await auth();
	const role = session?.user?.role;

	const isDev = process.env.NODE_ENV !== "production";
	const isPrivileged = role === UserRole.OWNER || role === UserRole.ADMIN;
	if (!isDev && !isPrivileged) {
		return NextResponse.json({ message: "Forbidden" }, { status: 403 });
	}

	// One cold-ish query (may include first-connect / engine init), then warm.
	const select1ColdMs = await time(() => dbPrisma.$queryRaw`SELECT 1`);
	const select1WarmMs = await time(() => dbPrisma.$queryRaw`SELECT 1`);

	return NextResponse.json({
		ok: true,
		timings: {
			select1ColdMs,
			select1WarmMs,
		},
		pool: getPoolParams(process.env.DATABASE_URL),
	});
}
