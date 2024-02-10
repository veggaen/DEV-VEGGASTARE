import { dbPrisma } from "@/lib/db";

export const getPasswordResetTokenByToken = async (token: string) => {
    try {
        const passwordResetToken = await dbPrisma.passwordResetToken.findUnique({
            where: { token },
        });
        return passwordResetToken;
    } catch {
        return null;
    }
};

export const getPasswordResetTokenByEmail = async (email: string) => {
    try {
        const passwordResetToken = await dbPrisma.passwordResetToken.findFirst({
            where: { email },
        });
        return passwordResetToken;
    } catch {
        return null;
    }
};

