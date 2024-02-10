import { dbPrisma } from '@/lib/db'

export const getTwoFactortokenByToken = async (token: string) => {
    try{
        const twoFactorToken = await dbPrisma.twoFactorToken.findUnique({
            where: { token }
        })

        return twoFactorToken;
    } catch {
        return null;
    }
};

export const getTwoFactortokenByEmail = async (email: string) => {
    try{
        const twoFactorToken = await dbPrisma.twoFactorToken.findFirst({
            where: { email }
        })

        return twoFactorToken;
    } catch {
        return null;
    }
};