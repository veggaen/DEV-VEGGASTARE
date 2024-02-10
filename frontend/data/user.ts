import { dbPrisma } from "@/lib/db";

export const getUserByEmail = async(email: string) => {
    if(!email) return null;
    try {
        const user = await dbPrisma.user.findUnique({ where: { email }});

        return user
    } catch {
        return null;
    }
}

export const getUserById = async(id: string) => {
    if (!id) return null;
    try {
        const user = await dbPrisma.user.findUnique({ where: { id }});

        return user
    } catch {
        return null;
    }
}