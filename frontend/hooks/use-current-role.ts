import { useSession } from "next-auth/react";
import { UserRole } from "@/generated/prisma/browser";

export const UseCurrentRole = (): UserRole | undefined => {
    const session = useSession();

    return session.data?.user?.role;
};