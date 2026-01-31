import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { CompanyOrgType } from "@prisma/client";
import { CompanyRegistrationPatchResponseSchema } from "@/lib/types/company";

const isDev = process.env.NODE_ENV !== 'production';
const LOG_PREFIX = '[frontend/app/api/companies/[companyId]/registration/route.ts]';

type CompanyParams = { companyId?: string; companyid?: string };

// Define valid org types as a const array to use with Zod
const validOrgTypes = ["ENK", "AS", "ANS", "DA", "SA", "FORENING", "NUF", "OTHER"] as const;

const bodySchema = z
  .object({
    orgType: z
      .enum(validOrgTypes)
      .optional()
      .nullable(),
    orgNumber: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length ? v : undefined))
      .refine((v) => v == null || /^\d{9}$/.test(v), {
        message: "orgNumber must be 9 digits",
      }),
    employmentNoticeDays: z.number().int().min(0).max(365).optional(),
  })
  .refine((v) => v.orgType != null || v.orgNumber != null || v.employmentNoticeDays != null, {
    message: "No fields to update",
  });

export async function PATCH(req: NextRequest, { params }: { params: Promise<CompanyParams> }) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const companyId = resolvedParams.companyId ?? resolvedParams.companyid;
  if (!companyId) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const company = await dbPrisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, ownerId: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const isPrivileged = session.role === "ADMIN" || session.role === "OWNER";
  const isOwner = company.ownerId === session.id;
  if (!isPrivileged && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const updated = await dbPrisma.company.update({
      where: { id: companyId },
      data: {
        orgType: parsed.data.orgType ?? undefined,
        orgNumber:
          parsed.data.orgNumber === undefined ? undefined : parsed.data.orgNumber ?? null,
        employmentNoticeDays: parsed.data.employmentNoticeDays,
      },
    });

    const dto = {
      success: true as const,
      company: {
        id: String(updated.id),
        orgType: (updated as any).orgType ?? null,
        orgNumber: (updated as any).orgNumber ?? null,
        employmentNoticeDays: (updated as any).employmentNoticeDays ?? null,
      },
    };

    const out = CompanyRegistrationPatchResponseSchema.safeParse(dto);
    if (!out.success) {
      console.error(LOG_PREFIX, 'Invalid PATCH DTO:', out.error);
      return NextResponse.json(
        { error: 'Internal Server Error', ...(isDev ? { issues: out.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(out.data, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to update company registration:", error);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}
