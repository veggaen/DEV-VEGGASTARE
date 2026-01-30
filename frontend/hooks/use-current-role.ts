import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";

export const UseCurrentRole = (): UserRole | undefined => {
    const session = useSession();

    return session.data?.user?.role;
};