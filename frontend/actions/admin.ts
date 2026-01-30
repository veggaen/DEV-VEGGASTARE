'use server'

import { MyLibRoleAuth } from "@/lib/user-auth"
import { UserRole } from "@prisma/client";

type AdminResult = { success: string } | { error: string };

export const admin = async (): Promise<AdminResult> => {
  const role = await MyLibRoleAuth();

  if (role === UserRole.ADMIN) {
    return { success: "Allowed Server Action!" };
  }

  return { error: "Forbidden Server Action!" }
};