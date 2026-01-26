'use server'

import { dbPrisma } from "@/lib/db";
import { getSecurityActionTokenByToken } from "@/data/security-action-token";
import { getTwoFactortokenByEmail } from "@/data/two-factor-token";
import { getUserById } from "@/data/user";
import { sendSecurityActionEmail, sendTwoFactorTokenEmail } from "@/lib/mail";
import { generateSecurityActionToken, generateTwoFactorToken } from "@/lib/tokens";
import { MyLibUserAuth } from "@/lib/user-auth";
import { SecurityActionType } from "@prisma/client";

export const MyRequestWeb3ModeSecurityAction = async (nextEnabled: boolean) => {
	const sessionUser = await MyLibUserAuth();
	if (!sessionUser?.id) return { error: "Not authorized!" };

	const dbUser = await getUserById(sessionUser.id);
	if (!dbUser?.id || !dbUser.email) return { error: "Not authorized!" };
	if (!dbUser.emailVerified) return { error: "Email must be verified first." };

	const action = nextEnabled
		? SecurityActionType.WEB3_MODE_ENABLE
		: SecurityActionType.WEB3_MODE_DISABLE;

	const actionToken = await generateSecurityActionToken({
		userId: dbUser.id,
		email: dbUser.email,
		action,
	});

	await sendSecurityActionEmail(dbUser.email, actionToken.token, action);

	if (dbUser.isTwoFactorEnabled) {
		const twoFactorToken = await generateTwoFactorToken(dbUser.email);
		await sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token);
	}

	return { success: "Confirmation email sent." };
};

export const MyConfirmSecurityAction = async (token: string, code?: string | null) => {
	const existingToken = await getSecurityActionTokenByToken(token);
	if (!existingToken) {
		return { error: "Token does not exist!" };
	}

	const hasExpired = new Date(existingToken.expires) < new Date();
	if (hasExpired) {
		return { error: "Token has expired!" };
	}

	const dbUser = await getUserById(existingToken.userId);
	if (!dbUser?.id || !dbUser.email) return { error: "Not authorized!" };

	if (dbUser.isTwoFactorEnabled) {
		if (!code) return { twoFactor: true };

		const twoFactorToken = await getTwoFactortokenByEmail(dbUser.email);
		if (!twoFactorToken) return { error: "Invalid code!" };
		if (twoFactorToken.token !== code) return { error: "Invalid code!" };

		const twoFactorExpired = new Date(twoFactorToken.expires) < new Date();
		if (twoFactorExpired) return { error: "Code has expired!" };

		await dbPrisma.twoFactorToken.delete({ where: { id: twoFactorToken.id } });
	}

	const nextWeb3ModeEnabled = existingToken.action === SecurityActionType.WEB3_MODE_ENABLE;

	await dbPrisma.user.update({
		where: { id: existingToken.userId },
		data: {
			web3ModeEnabled: nextWeb3ModeEnabled,
		},
	});

	await dbPrisma.securityActionToken.delete({
		where: { id: existingToken.id },
	});

	return { success: nextWeb3ModeEnabled ? "Web3 mode enabled!" : "Web3 mode disabled!" };
};
