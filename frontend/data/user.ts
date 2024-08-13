import { dbPrisma } from "@/lib/db";

const LOG_PREFIX = '[frontend/data/user.ts]'

export const getUserByEmail = async(email: string) => {
    if(!email) return null;
    try {
        const user = await dbPrisma.user.findUnique({ where: { email }});

        console.log(LOG_PREFIX, 'getUserByEmail(): ', user)
        return user
    } catch {
        return null;
    }
}

export const getUserById = async(id: string) => {
    if (!id) return null;
    try {
        const user = await dbPrisma.user.findUnique(
            { where: { id }
            }
        );
        console.log(LOG_PREFIX, 'getUserById(): ', user)
        return user
    } catch {
        return null;
    }
}

export const getUserByName = async(name: string) => {
    if (!name) return null;
    try {
        const user = await dbPrisma.user.findUnique({ where: { id: '', email: '', name }});

        console.log(LOG_PREFIX, 'getUserByName(): ', user)
        return user
    } catch {
        return null;
    }
}

export async function fetchUserManyDetails(userIds: string[]) {
  const users = await dbPrisma.user.findMany({
    where: {
      id: { in: userIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      referredBy: true,
    },
  });

  return users;
}

export const getUserMany = async() => {
    try {
        const userMany = await dbPrisma.user.findMany();
        console.log('userMany', userMany)

        return userMany
    } catch {
        return null;
    }
}