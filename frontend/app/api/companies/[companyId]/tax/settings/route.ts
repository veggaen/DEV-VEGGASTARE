import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonOrError } from '@/lib/api-validate';

const ToggleSchema = z.object({
  enabled: z.boolean(),
  vatRegistered: z.boolean().optional(),
  vatNumber: z.string().regex(/^NO\d{9}MVA$/, 'VAT number must be format NO123456789MVA').optional().nullable(),
});

/**
 * PATCH /api/companies/[companyId]/tax/settings
 * Toggle tax helper on/off and update VAT registration
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;

  // Only owner/manager can toggle
  const employee = await dbPrisma.employee.findUnique({
    where: { userId_companyId: { userId: session.id, companyId } },
  });
  if (!employee || (employee.role !== 'OWNER' && employee.role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Only owner/manager can change tax settings' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, ToggleSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { enabled, vatRegistered, vatNumber } = bodyResult.data;

  const company = await dbPrisma.company.update({
    where: { id: companyId },
    data: {
      taxHelperEnabled: enabled ? 'ENABLED' : 'DISABLED',
      ...(vatRegistered !== undefined ? { vatRegistered } : {}),
      ...(vatNumber !== undefined ? { vatNumber: vatNumber || null } : {}),
    },
    select: {
      id: true,
      name: true,
      taxHelperEnabled: true,
      vatRegistered: true,
      vatNumber: true,
      orgType: true,
    },
  });

  return NextResponse.json(company);
}
