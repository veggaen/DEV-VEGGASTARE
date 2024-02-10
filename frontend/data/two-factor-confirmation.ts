import { dbPrisma } from '@/lib/db';

export const getTwoFactorConfirmationByUserId = async (userId: string) => {
    try {
        const twoFactorConfirmation = await dbPrisma.twoFactorConfirmation.findUnique({
            where: { userId }
        });

        return twoFactorConfirmation;
    } catch {
        return null;
    }
}