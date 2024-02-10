import { dbPrisma } from "./db";

export const getAccountByUserId = async (userId: string) => {
    try {
        const account = await dbPrisma.account.findFirst({
            where: { userId }
        });

        return account;
    } catch {
        return null;
    }
}