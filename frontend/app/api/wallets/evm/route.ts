import { NextResponse } from "next/server";

import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserById } from "@/data/user";
import { dbPrisma } from "@/lib/db";
import { ChainFamily } from "@prisma/client";

export async function GET() {
	const me = await MyLibUserAuth();
	if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const dbUser = await getUserById(me.id);
	if (!dbUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!dbUser.web3ModeEnabled) {
		return NextResponse.json({ error: "Enable Web3 mode first." }, { status: 403 });
	}

	const wallets = await dbPrisma.wallet.findMany({
		where: {
			ownerUserId: dbUser.id,
			ownerCompanyId: null,
			family: ChainFamily.EVM,
		},
		orderBy: [{ isDefault: "desc" }, { verifiedAt: "desc" }, { createdAt: "desc" }],
		select: {
			id: true,
			label: true,
			address: true,
			chainId: true,
			isDefault: true,
			verifiedAt: true,
			createdAt: true,
		},
	});

	return NextResponse.json({ wallets }, { status: 200 });
}
