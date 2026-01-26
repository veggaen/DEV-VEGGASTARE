import { dbPrisma } from "@/lib/db";

export const getSecurityActionTokenByToken = async (token: string) => {
	try {
		const actionToken = await dbPrisma.securityActionToken.findUnique({
			where: { token },
		});
		return actionToken;
	} catch {
		return null;
	}
};
