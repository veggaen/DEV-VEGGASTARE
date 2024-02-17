import { MyLibRoleAuth } from "@/lib/user-auth";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  const role = await MyLibRoleAuth();

  if (role === UserRole.ADMIN) {
    // Perform additional actions for admin role
    // ...
    console.log(`[API/ADMIN] User role: ${role}`);

    return new NextResponse(null, { status: 200 });
  }

  // Perform additional actions for non-admin roles
  // ...

  return new NextResponse(null, { status: 403 });
}

