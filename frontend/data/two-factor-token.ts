import { db } from '@/lib/db'

export const getTwoFactortokenByToken = async (token: string) => {
    try{
        const twoFactorToken = await db.twoFactorToken.findUnique({
            where: { token }
        })

        return twoFactorToken;
    } catch {
        return null;
    }
};

export const getTwoFactortokenByEmail = async (email: string) => {
    try{
        const twoFactorToken = await db.twoFactorToken.findFirst({
            where: { email }
        })

        return twoFactorToken;
    } catch {
        return null;
    }
};