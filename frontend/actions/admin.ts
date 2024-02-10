'use server'

import { MyLibRoleAuth } from "@/lib/user-auth"
import { UserRole } from "@prisma/client";

export const admin = async () => {
  const role = await MyLibRoleAuth();

  if (role === UserRole.ADMIN) {
    return { success: "Allowed Server Action!" };
  }

  return { error: "Forbidden Server Action!" }
};